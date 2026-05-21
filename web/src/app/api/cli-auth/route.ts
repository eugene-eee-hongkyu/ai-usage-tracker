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
import { eq, and, isNull, asc } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    const callbackUrl = req.nextUrl.toString();
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`, req.url)
    );
  }

  const port = req.nextUrl.searchParams.get("port") ?? "9988";
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
  const existingDevice = await db
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
    await db
      .update(apiTokens)
      .set({ hash: apiKeyHash, scopes: ["ingest"] })
      .where(eq(apiTokens.id, existingDevice[0].id));
  } else {
    await db.insert(apiTokens).values({
      teamId,
      userId,
      name: deviceName,
      hash: apiKeyHash,
      scopes: ["ingest"],
    });
  }

  // Redirect to CLI's local server with the raw key (HTTP loopback, no plaintext over wire).
  const redirectUrl = `http://127.0.0.1:${port}/?apiKey=${apiKey}`;
  return NextResponse.redirect(redirectUrl);
}
