// Thin HTTP wrapper. 인증 + userId 확정 → runIngest() 호출.
// 핵심 로직은 [lib/sync/run-ingest.ts] 로 추출되어 향후 CLI in-process binary 도 같은 함수 호출 가능.

import { NextRequest, NextResponse } from "next/server";
import { db, users, teamMembers, apiTokens, IS_LOCAL_MODE } from "@/lib/db";
import { ensureLocalUser } from "@/lib/local-user";
import { runIngest } from "@/lib/sync/run-ingest";
import { trackServer, EVENTS_SERVER } from "@/lib/analytics/mixpanel-server";
import { eq, and, isNull, asc, sql } from "drizzle-orm";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  // 로컬 단독 모드 (.pkg/.msi 인스톨러) — API key 인증 우회, 단일 사용자 자동 보장.
  let userRow: Array<{
    id: number;
    timezone: string | null;
    suspendedAt: Date | null;
    deletedAt: Date | null;
    lastSyncedAt: Date | null;
  }>;
  let matchedTokenId: number | null = null;
  if (IS_LOCAL_MODE) {
    const u = await ensureLocalUser();
    userRow = [{ id: u.id, timezone: u.timezone, suspendedAt: null, deletedAt: null, lastSyncedAt: null }];
  } else {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const hash = crypto.createHash("sha256").update(apiKey).digest("hex");
    const tokenRow = await db
      .select({
        tokenId: apiTokens.id,
        userId: users.id,
        timezone: users.timezone,
        suspendedAt: users.suspendedAt,
        deletedAt: users.deletedAt,
        lastSyncedAt: users.lastSyncedAt,
      })
      .from(apiTokens)
      .innerJoin(users, eq(users.id, apiTokens.userId))
      .where(and(eq(apiTokens.hash, hash), isNull(apiTokens.revokedAt)))
      .limit(1);
    if (!tokenRow[0]) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    matchedTokenId = tokenRow[0].tokenId;
    userRow = [
      {
        id: tokenRow[0].userId,
        timezone: tokenRow[0].timezone,
        suspendedAt: tokenRow[0].suspendedAt,
        deletedAt: tokenRow[0].deletedAt,
        lastSyncedAt: tokenRow[0].lastSyncedAt,
      },
    ];
  }

  if (!userRow[0]) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // admin 이 suspend/delete 한 사용자의 launchd 가 계속 ingest 못 하게 차단.
  if (userRow[0].deletedAt) return NextResponse.json({ error: "deleted" }, { status: 403 });
  if (userRow[0].suspendedAt) return NextResponse.json({ error: "suspended" }, { status: 403 });

  // Phase 4.2 (M6a): teamId 확정. CLI ingest 는 session 없으니 team_members 의 첫 행.
  // LOCAL_MODE 면 team_id=1 (iskra.world, ensureLocalUser 가 자동 가입 처리는 별도).
  let teamId: number;
  if (IS_LOCAL_MODE) {
    teamId = 1; // local-user 흐름은 단일 팀
  } else {
    const memberRow = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, userRow[0].id), isNull(teamMembers.deletedAt)))
      .orderBy(asc(teamMembers.joinedAt))
      .limit(1);
    if (!memberRow[0]) return NextResponse.json({ error: "no_team" }, { status: 403 });
    teamId = memberRow[0].teamId;
  }

  // 첫 ingest 감지 — runIngest 는 끝에 users.last_synced_at 을 set 하므로,
  // 그 전에 캡처한 값으로 판정. LOCAL_MODE 는 Mixpanel 비활성 (token 미세팅) 이고
  // 단일 사용자라 funnel 개념 없음 — gate 로 server-side fire 건너뜀.
  const wasFirstIngest = !IS_LOCAL_MODE && userRow[0].lastSyncedAt === null;

  const body = await req.json();
  await runIngest(userRow[0].id, teamId, matchedTokenId, userRow[0].timezone, body);

  // M6e: 매칭된 token 의 last_used_at + metadata 갱신. fallback (users 단일 hash)
  // 경로면 matchedTokenId=null 이라 skip — 옛 CLI 가 metadata 안 보내도 안전.
  //
  // 2026-05-30 v0.3.2 (oreo 회귀): metadata 에 envInfo 외 partial 진단 정보 함께 저장.
  // - lastIngestTelemetry: 최근 100-200 줄 누적 실패 events (codeburn/ccusage/HTTP/network)
  // - lastClaudeFailPeriods / lastCodexFailPeriods: 이번 ingest 에서 실패한 codeburn period
  // - lastIngestAt: 이번 ingest 시각 (마지막 fail 시점과 별개)
  // 모두 nullable, 옛 CLI body 면 비어 정상.
  const envInfo = (body as { envInfo?: unknown })?.envInfo;
  const recentTelemetry = (body as { recentTelemetry?: unknown })?.recentTelemetry;
  const claudeFailPeriods = (body as { claudeFailPeriods?: unknown })?.claudeFailPeriods;
  const codexFailPeriods = (body as { codexFailPeriods?: unknown })?.codexFailPeriods;
  if (matchedTokenId !== null) {
    const metadataUpdate: { lastUsedAt: Date; metadata?: unknown } = { lastUsedAt: new Date() };
    const mergedMetadata: Record<string, unknown> = {};
    if (envInfo && typeof envInfo === "object") {
      Object.assign(mergedMetadata, envInfo as Record<string, unknown>);
    }
    if (Array.isArray(recentTelemetry)) {
      mergedMetadata.lastIngestTelemetry = recentTelemetry;
    }
    if (Array.isArray(claudeFailPeriods) && claudeFailPeriods.length > 0) {
      mergedMetadata.lastClaudeFailPeriods = claudeFailPeriods;
    } else {
      mergedMetadata.lastClaudeFailPeriods = null;
    }
    if (Array.isArray(codexFailPeriods) && codexFailPeriods.length > 0) {
      mergedMetadata.lastCodexFailPeriods = codexFailPeriods;
    } else {
      mergedMetadata.lastCodexFailPeriods = null;
    }
    mergedMetadata.lastIngestAt = new Date().toISOString();
    if (Object.keys(mergedMetadata).length > 0) {
      metadataUpdate.metadata = mergedMetadata;
    }
    await db.update(apiTokens).set(metadataUpdate).where(eq(apiTokens.id, matchedTokenId));
  }

  // 가입 → 실제 사용 funnel 의 마지막 노드. distinct_id 는 user.id (client 측
  // identifyUser 와 동일) — 같은 사용자의 client/server event 가 Mixpanel 에서
  // 같은 row 로 통합. fire-and-forget, response 안 막음.
  if (wasFirstIngest) {
    const env = envInfo as Record<string, unknown> | undefined;
    // 디바이스 수 — multi-device 사용자 분석용.
    const deviceCountRow = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(apiTokens)
      .where(and(eq(apiTokens.userId, userRow[0].id), isNull(apiTokens.revokedAt)));
    trackServer(EVENTS_SERVER.SETUP_COMPLETE, userRow[0].id, {
      cli_version: env?.cliVersion ?? null,
      claude_code_version: env?.claudeCodeVersion ?? null,
      platform: env?.platform ?? null,
      node_version: env?.nodeVersion ?? null,
      install_method: env?.installMethod ?? null,
      device_count: deviceCountRow[0]?.c ?? 1,
    });
  }

  return NextResponse.json({ ok: true });
}
