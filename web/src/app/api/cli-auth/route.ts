// GET /api/cli-auth?port=9988[&device=<hostname>]
//
// 동작:
//   1) NextAuth 로 user 식별
//   2) team_members 첫 행으로 team_id 결정
//   3) 새 API key (32 byte random) 생성 — hash 만 DB 저장
//   4) api_tokens INSERT (user 별 N개 가능 — 노트북마다 별도 토큰)
//   5) http://127.0.0.1:{port}/?apiKey={raw} 로 redirect → CLI 로컬 서버가 받음
//
// 변경 (2026-05-21, M6e): users.api_key_hash 단일 컬럼 UPDATE 에서 api_tokens
// 멀티 row INSERT 로 전환. 같은 사용자가 노트북 N대에서 init 해도 각 노트북이
// 독립된 토큰을 가짐. ingest 매칭은 api_tokens.hash 기반.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, users, teamMembers, apiTokens } from "@/lib/db";
import { eq, and, isNull, asc, sql } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // 보안 감사 (2026-05-28, H4): cross-site CSRF 차단.
  // 이 endpoint 는 GET 인데 새 API 토큰을 발급 + 127.0.0.1:<port> 로 redirect 하는
  // 부수효과를 가진다. NextAuth session cookie 가 SameSite=Lax 라 cross-site GET
  // 의 top-level navigation (예: 공격자 페이지의 `<a href="...api/cli-auth">click</a>`
  // 또는 `window.location = ...`) 에는 cookie 가 그대로 전달 → 피해자 모르게 신규
  // 토큰 발급되어 127.0.0.1:port 의 악성 로컬 프로세스가 raw apiKey 캡쳐 가능.
  //
  // 방어: Sec-Fetch-Site 가 'none' (주소창 직접 입력 / CLI 의 `open <url>`) 또는
  // 'same-origin' 일 때만 통과. 'cross-site' / 'same-site' (다른 도메인의 링크
  // 클릭) 은 차단. Sec-Fetch-Site 헤더는 Chrome 76+, Firefox 90+, Safari 16+ 지원
  // — CLI 가 띄우는 시스템 브라우저는 모두 modern.
  //
  // 헤더가 없는 (legacy/curl/test) 케이스는 통과시키되 audit log 남김. CLI 정상
  // 흐름은 헤더 없는 케이스가 흔치 않음 (사용자가 시스템 브라우저로 navigation).
  // 정식 fix (POST + CSRF token) 는 CLI 양쪽 코드 변경 필요해 별도 phase.
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "none" && fetchSite !== "same-origin") {
    return NextResponse.json(
      { error: "csrf_blocked", hint: "Open this URL directly from the CLI prompt, not from another website." },
      { status: 403 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    const callbackUrl = req.nextUrl.toString();
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`, req.url)
    );
  }

  // port 검증 — 정수 + valid 범위만 허용. `?port=9988@evil.com` 같은 URL
  // user-info injection 으로 raw apiKey 가 외부 도메인에 leak 되는 걸 차단
  // (브라우저가 `http://127.0.0.1:<port>` 의 port 자리를 user-info 로 해석).
  const portRaw = req.nextUrl.searchParams.get("port") ?? "9988";
  const port = parseInt(portRaw, 10);
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || String(port) !== portRaw) {
    return NextResponse.json({ error: "invalid_port" }, { status: 400 });
  }
  // CLI 가 init 시 ?device=<hostname> 전달. 비어있으면 자동 라벨.
  const deviceQuery = req.nextUrl.searchParams.get("device")?.trim();

  const userRow = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);
  if (!userRow[0]) return NextResponse.json({ error: "user not found" }, { status: 404 });
  const userId = userRow[0].id;

  // team_members 첫 행 (가입 순). multi-team 도입 (M6b 후속) 전까지 current team.
  const memberRow = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(and(eq(teamMembers.userId, userId), isNull(teamMembers.deletedAt)))
    .orderBy(asc(teamMembers.joinedAt))
    .limit(1);
  if (!memberRow[0]) return NextResponse.json({ error: "no team" }, { status: 403 });
  const teamId = memberRow[0].teamId;

  // 라벨 결정 — query 가 있으면 그대로, 없으면 "Device #N" 자동 번호.
  let deviceName: string;
  if (deviceQuery && deviceQuery.length > 0 && deviceQuery.length <= 64) {
    deviceName = deviceQuery;
  } else {
    const existing = await db
      .select({ id: apiTokens.id })
      .from(apiTokens)
      .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)));
    deviceName = `Device #${existing.length + 1}`;
  }

  const apiKey = crypto.randomBytes(32).toString("hex");
  const apiKeyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

  // UPSERT — 같은 (user_id, name) 의 active row 있으면 hash 갱신, 없으면 INSERT.
  // 같은 노트북에서 install.sh 다시 돌려도 device 행 1개 유지 (옛 hash 무효화 + 새 hash).
  // 다른 노트북 (다른 hostname) 이면 새 행. 사용자가 의도적으로 같은 label 로 등록하려면
  // ?device=<custom> 으로 명시 가능.
  //
  // 동시 init race — 동일 device 에서 install.sh 두 번 빠르게 트리거 시 SELECT
  // → UPDATE/INSERT 사이에 다른 요청이 INSERT 해버려 같은 (user_id, name) 의
  // active 토큰이 2개 만들어지던 부정합. transaction + advisory lock (user_id 단위)
  // 으로 직렬화 — read-committed 라도 같은 user 의 cli-auth 호출은 1개씩 처리.
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${userId})`);
    const existingDevice = await tx
      .select({ id: apiTokens.id })
      .from(apiTokens)
      .where(
        and(
          eq(apiTokens.userId, userId),
          eq(apiTokens.name, deviceName),
          isNull(apiTokens.revokedAt)
        )
      )
      .limit(1);
    if (existingDevice[0]) {
      await tx
        .update(apiTokens)
        .set({ hash: apiKeyHash, scopes: ["ingest"] })
        .where(eq(apiTokens.id, existingDevice[0].id));
    } else {
      await tx.insert(apiTokens).values({
        teamId,
        userId,
        name: deviceName,
        hash: apiKeyHash,
        scopes: ["ingest"],
      });
    }
  });

  // Redirect to CLI's local server with the raw key (HTTP loopback, no plaintext over wire).
  // email 도 같이 — 사용자가 "어떤 OAuth 계정으로 로그인했는지" 콘솔/브라우저 페이지에서
  // 즉시 확인 (의도와 다른 계정으로 로그인했으면 바로 인지하고 재실행).
  const params = new URLSearchParams({ apiKey, email: session.user.email, device: deviceName });
  const redirectUrl = `http://127.0.0.1:${port}/?${params.toString()}`;
  return NextResponse.redirect(redirectUrl);
}
