// GET /api/platform-admin/all-users — 모든 팀의 모든 사용자 + 오늘 metric + envInfo + sync 상태.
// Platform Admin (ADMIN_EMAIL) 만 접근. /platform-admin/all-users 카드 그리드의 데이터 소스.
//
// 응답 요약:
//   - 사용자별 오늘 (사용자 timezone strict today) ccusage daily 행에서 tokens/cost/cache hit/1-shot
//   - 마지막 sync 시각 + 색 신호 (1h 녹 / 6h 노 / 2d 빨)
//   - envInfo: hookEnabled, npmRootWritable, ccusage/codeburn/node/claude code 버전 + 핀 매칭 ✓/⚠
//   - device count (active api_tokens)
//   - planSavings: 오늘 ccusage cost vs Plan tier 의 일별 amortized cost
//
// 정렬: 팀명 → 사용자명. 비활동 (today.tokens=0 or 없음) 사용자는 같은 팀 안에서 맨 뒤.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { db, users, teamMembers, teams, userSnapshots, apiTokens, IS_LOCAL_MODE } from "@/lib/db";
import { eq, and, gt, isNull, or, sql } from "drizzle-orm";
import { getPlanLimits, type PlanTier } from "@/lib/plan-health";
import { PINNED } from "@/lib/pinned-versions";
import { getCcusageDaily } from "@/lib/ccusage-row";

export const dynamic = "force-dynamic";

interface EnvInfo {
  platform?: string;
  osArch?: string;
  nodeVersion?: string;
  nodeMajor?: number;
  nodeManager?: string;
  npmRoot?: string;
  npmRootWritable?: boolean;
  codeburnVersion?: string | null;
  ccusageVersion?: string | null;
  claudeCodeVersion?: string | null;
  codexCodeVersion?: string | null;
  hookEnabled?: boolean;
  cliVersion?: string;
  installMethod?: string;
}

// 핀 매칭 안전망: ccusage v19 출력 '19.0.2' / v20 출력 'ccusage 20.0.6' 처럼 도구가
// version 출력 포맷 바꾸면 string match 실패. submit.mjs 의 semverOnly 가 신규 sync
// 부터 정정하지만, 옛 metadata 남아있는 사용자 안전망으로 endsWith 한 번 더 시도.
// 예: 'ccusage 20.0.6'.endsWith('20.0.6') = true.
function pinMatches(metadataVer: string | null, pin: string): boolean | null {
  if (metadataVer === null) return null;
  return metadataVer === pin || metadataVer.endsWith(pin);
}

function ccusageMissing(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) return false;
  return (raw as Record<string, unknown>).ccusageMissing === true;
}

// 사용자 timezone 기준 오늘 (YYYY-MM-DD). 빈/잘못된 tz 면 UTC fallback.
function todayInTz(tz: string | null): string {
  const t = tz ?? "UTC";
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: t });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// sync 색 신호. 1h 이내 녹 / 6h 이내 노 / 그 외 빨 / null 이면 none.
function syncColor(lastSyncedAt: Date | null): "green" | "yellow" | "red" | "none" {
  if (!lastSyncedAt) return "none";
  const hours = (Date.now() - lastSyncedAt.getTime()) / 3_600_000;
  if (hours <= 1) return "green";
  if (hours <= 6) return "yellow";
  return "red";
}

export async function GET(req: NextRequest) {
  if (IS_LOCAL_MODE) {
    return NextResponse.json({ error: "not_available_local" }, { status: 501 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Multi-provider Phase 2: provider Tabs.
  const provider = req.nextUrl.searchParams.get("provider") === "codex" ? "codex" : "claude";

  // 모든 (deleted/suspended 제외) 사용자 + 팀 + snapshot + 가장 최근 사용 api_token.
  // 멀티팀 사용자는 team_members 행 수만큼 등장 (현재 코드베이스 의도 — 각 (user, team) 쌍 별도 카드).
  //
  // 2026-06-01: device 별 카드 의도 유지 (사용자 결정 — '여러 장비 쓰더라도 장비별로
  // 잘 설치되어 있는지 health check'). M6f Phase 2 후 user_snapshots 가 token_id 별
  // N row → 한 user N 카드 자연 device 별 분리. tokensByToken 으로 device 별 metadata
  // 매핑해야 두 카드가 자기 device 정보 표시 (이전 tokensByUser 패턴은 모든 카드에
  // 같은 first metadata 적용해 영진님 두 카드 모두 Windows metadata 로 보이던 회귀).
  const rows = await db
    .select({
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      userTz: users.timezone,
      userPlanTier: users.planTier,
      lastSyncedAt: users.lastSyncedAt,
      teamId: teams.id,
      teamName: teams.name,
      tokenId: userSnapshots.tokenId,
      rawJson: userSnapshots.rawJson,
    })
    .from(users)
    .innerJoin(teamMembers, and(eq(teamMembers.userId, users.id), isNull(teamMembers.deletedAt)))
    .innerJoin(teams, and(eq(teams.id, teamMembers.teamId), isNull(teams.deletedAt)))
    // Multi-provider Phase 2: provider param 으로 분기.
    .leftJoin(userSnapshots, and(eq(userSnapshots.userId, users.id), eq(userSnapshots.teamId, teams.id), eq(userSnapshots.provider, provider)))
    .where(and(
      isNull(users.deletedAt),
      isNull(users.suspendedAt),
      sql`${teams.type} = 'normal'`,
    ));

  // device 별 카드 health check 의도 — token_id 기준 metadata 매핑 (이전 tokensByUser
  // 는 user 단위 first metadata 라 multi-device 사용자의 두 카드가 같은 metadata 표시
  // 회귀). 추가로 userId 별 device count (모든 카드 공통 표시) 도 같이 모음.
  const tokenRows = await db
    .select({
      tokenId: apiTokens.id,
      userId: apiTokens.userId,
      metadata: apiTokens.metadata,
      lastUsedAt: apiTokens.lastUsedAt,
    })
    .from(apiTokens)
    .where(isNull(apiTokens.revokedAt))
    .orderBy(apiTokens.userId, sql`${apiTokens.lastUsedAt} DESC NULLS LAST`);

  const tokensByToken = new Map<number, EnvInfo | null>();
  const tokensByUser = new Map<number, { count: number; firstMetadata: EnvInfo | null }>();
  for (const t of tokenRows) {
    tokensByToken.set(t.tokenId, (t.metadata as EnvInfo | null) ?? null);
    const cur = tokensByUser.get(t.userId) ?? { count: 0, firstMetadata: null };
    cur.count += 1;
    if (cur.firstMetadata === null) cur.firstMetadata = (t.metadata as EnvInfo | null) ?? null;
    tokensByUser.set(t.userId, cur);
  }

  // 각 (user, team) 행 가공.
  type CardData = {
    userId: number;
    teamId: number;
    teamName: string;
    name: string;
    email: string;
    lastSyncedAt: string | null;
    syncColor: "green" | "yellow" | "red" | "none";
    planTier: PlanTier;
    today: {
      tokens: number;
      cost: number;
      cacheHitPct: number | null;
      oneShotRate: number | null;
    } | null;
    planSavings: {
      tierLabel: string;
      actualCost: number;
      planCostToday: number;
      savingsAmount: number;
      savingsPct: number;
    } | null;
    env: {
      hookEnabled: boolean | null;
      ccusageMissing: boolean;
      npmRootWritable: boolean | null;
      deviceCount: number;
      codeburnVersion: string | null;
      codeburnPinMatch: boolean | null;
      ccusageVersion: string | null;
      ccusagePinMatch: boolean | null;
      nodeVersion: string | null;
      nodeManager: string | null;
      claudeCodeVersion: string | null;
      codexCodeVersion: string | null;
      cliVersion: string | null;
      cliPinMatch: boolean | null;
      platform: string | null;
      osArch: string | null;
    };
  };

  const cards: CardData[] = rows.map((r) => {
    const todayDate = todayInTz(r.userTz);
    const ccDaily = getCcusageDaily(r.rawJson);
    const todayRow = ccDaily.find((row) => row.date === todayDate);

    const today = todayRow
      ? (() => {
        const input = todayRow.inputTokens ?? 0;
        const cacheRead = todayRow.cacheReadTokens ?? 0;
        const cacheCreation = todayRow.cacheCreationTokens ?? 0;
        const denom = cacheRead + cacheCreation + input;
        const cacheHitPct = denom > 0 ? (cacheRead / denom) * 100 : null;
        // 1-shot rate 는 codeburn d.activities 가 있어야 정확 — ccusage 에 동등 metric 없음.
        // 오늘 = single day 라 codeburn 의 today.activities 가 사용 가능하지만 카드는
        // 단순화. activities 가 있으면 가중 평균, 없으면 null.
        let oneShotRate: number | null = null;
        const raw = r.rawJson as Record<string, unknown> | null;
        const todayBucket = raw?.today as { activities?: Array<{ oneShotRate?: number | null; turns?: number; sessions?: number }> } | undefined;
        const activities = todayBucket?.activities ?? [];
        const withRate = activities.filter((a) => a.oneShotRate != null);
        if (withRate.length > 0) {
          const totalTurns = withRate.reduce((s, a) => s + (a.turns ?? a.sessions ?? 1), 0);
          const weighted = withRate.reduce(
            (s, a) => s + ((a.oneShotRate! / 100) * (a.turns ?? a.sessions ?? 1)),
            0
          );
          oneShotRate = totalTurns > 0 ? (weighted / totalTurns) * 100 : null;
        }
        return {
          tokens: todayRow.totalTokens ?? 0,
          cost: todayRow.totalCost ?? 0,
          cacheHitPct,
          oneShotRate,
        };
      })()
      : null;

    // Plan 절감 — declared tier 만 사용 (추정 안 함, 카드 단순화).
    const declared = r.userPlanTier as PlanTier;
    const planSavings = (() => {
      if (!declared) return null;
      const limits = getPlanLimits(declared as Exclude<PlanTier, null>);
      if (!limits || limits.monthlyPriceUsd === 0) return null;
      const planCostToday = limits.monthlyPriceUsd / 30;
      const actualCost = today?.cost ?? 0;
      const savingsAmount = actualCost - planCostToday;
      const savingsPct = actualCost > 0
        ? Math.round((savingsAmount / actualCost) * 100)
        : 0;
      return {
        tierLabel: limits.label,
        actualCost,
        planCostToday,
        savingsAmount,
        savingsPct,
      };
    })();

    const userTokens = tokensByUser.get(r.userId) ?? { count: 0, firstMetadata: null };
    // device 별 카드: row 의 token_id 가 있으면 그 device 의 metadata 사용.
    // snapshot 없는 user (token_id null) 는 fallback 으로 user 의 첫 metadata.
    const env = (r.tokenId !== null ? tokensByToken.get(r.tokenId) : null) ?? userTokens.firstMetadata ?? {};

    const codeburnVersion = env.codeburnVersion ?? null;
    const ccusageVersion = env.ccusageVersion ?? null;
    const cliVersion = env.cliVersion ?? null;
    const codexCodeVersion = env.codexCodeVersion ?? null;
    const codeburnPinMatch = pinMatches(codeburnVersion, PINNED.CODEBURN);
    const ccusagePinMatch = pinMatches(ccusageVersion, PINNED.CCUSAGE);
    const cliPinMatch = pinMatches(cliVersion, PINNED.USAGE_TRACKER_RECOMMENDED);

    return {
      userId: r.userId,
      teamId: r.teamId,
      teamName: r.teamName,
      name: r.userName,
      email: r.userEmail,
      lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
      syncColor: syncColor(r.lastSyncedAt),
      planTier: declared,
      today,
      planSavings,
      env: {
        hookEnabled: env.hookEnabled ?? null,
        ccusageMissing: ccusageMissing(r.rawJson),
        npmRootWritable: env.npmRootWritable ?? null,
        deviceCount: userTokens.count,
        codeburnVersion,
        codeburnPinMatch,
        ccusageVersion,
        ccusagePinMatch,
        nodeVersion: env.nodeVersion ?? null,
        nodeManager: env.nodeManager ?? null,
        claudeCodeVersion: env.claudeCodeVersion ?? null,
        codexCodeVersion,
        cliVersion,
        cliPinMatch,
        platform: env.platform ?? null,
        osArch: env.osArch ?? null,
      },
    };
  });

  // 정렬: 팀명 → 활동여부 (활동 먼저) → 이름 (가나다, 한국어 locale).
  const collator = new Intl.Collator("ko");
  cards.sort((a, b) => {
    if (a.teamName !== b.teamName) return collator.compare(a.teamName, b.teamName);
    const aActive = (a.today?.tokens ?? 0) > 0 ? 0 : 1;
    const bActive = (b.today?.tokens ?? 0) > 0 ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return collator.compare(a.name, b.name);
  });

  // hasCodexData / hasClaudeData = 전체 사용자 중 provider 별 의미 있는 사용 1+.
  // provider segmented control 의 disabled chip 분기에 사용.
  async function checkProviderUsage(prov: "claude" | "codex"): Promise<boolean> {
    const rows = await db
      .select({ id: userSnapshots.id })
      .from(userSnapshots)
      .where(and(
        eq(userSnapshots.provider, prov),
        or(gt(userSnapshots.totalCost, 0), gt(userSnapshots.sessionsCount, 0)),
      ))
      .limit(1);
    return rows.length > 0;
  }
  const hasCodexData = await checkProviderUsage("codex");
  const hasClaudeData = await checkProviderUsage("claude");

  return NextResponse.json({ users: cards, hasCodexData, hasClaudeData });
}
