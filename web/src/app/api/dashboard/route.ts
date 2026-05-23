export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, userSnapshots, users, periodSnapshots, dailyVisits, userBlocks, teamMembers, IS_LOCAL_MODE } from "@/lib/db";
import { getAuthedEmail } from "@/lib/local-user";
import { getEffectiveTeamId } from "@/lib/effective-team";
import { and, asc, desc, eq, gte, isNull, lt, inArray } from "drizzle-orm";
import { isAdmin } from "@/lib/admin";
import { computeDailyEfficiencyScore, computePowerIndex } from "@/lib/rules";
import {
  analyzePlanHealth,
  getPlanLimits,
  estimateTierFromMonthlyCost,
  type PlanTier,
} from "@/lib/plan-health";

type Period = "today" | "month" | "8days" | "30days" | "all";

interface RawOverview {
  cost?: number;
  sessions?: number;
  calls?: number;
  totalCost?: number;
  totalSessions?: number;
  tokens?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
}

interface RawActivity {
  name?: string;
  category?: string;
  sessions?: number;
  turns?: number;
  cost?: number;
  oneShotRate?: number | null;
}

interface RawProject {
  name?: string;
  path?: string;
  cost?: number;
  sessions?: number;
  calls?: number;
  avgCost?: number;
}

interface RawTopSession {
  id?: string;
  sessionId?: string;
  date?: string;
  project?: string;
  cost?: number;
  calls?: number;
  turns?: number;
}

interface RawModel {
  name?: string;
  cost?: number;
  calls?: number;
  inputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

interface RawNameCalls { name?: string; calls?: number }

interface RawPeriodData {
  overview?: RawOverview;
  summary?: RawOverview;
  daily?: Array<{ date: string; cost: number; sessions: number; calls?: number }>;
  activities?: RawActivity[];
  projects?: RawProject[];
  topSessions?: RawTopSession[];
  models?: RawModel[];
  tools?: RawNameCalls[];
  shellCommands?: RawNameCalls[];
  mcpServers?: RawNameCalls[];
}

interface CcusageDailyRow {
  date?: string;
  period?: string;  // ccusage 19.x breaking change: row field 'date' → 'period'. 양쪽 모두 호환 위해 정의.
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalTokens?: number;
}

// ccusage 19.x 에서 daily row 의 키가 'date' → 'period' 로 breaking change.
// 본 함수에서 normalize 하여 caller 가 항상 `.date` 사용 가능.
function normalizeCcusageRow(row: CcusageDailyRow): CcusageDailyRow {
  return { ...row, date: row.date ?? row.period };
}

function getCcusageDaily(raw: unknown): CcusageDailyRow[] {
  if (typeof raw !== "object" || raw === null) return [];
  const r = raw as Record<string, unknown>;
  const cu = r.ccusageDaily as { daily?: CcusageDailyRow[] } | undefined;
  return (cu?.daily ?? []).map(normalizeCcusageRow);
}

function getPeriodData(raw: unknown, period: string): RawPeriodData {
  if (typeof raw !== "object" || raw === null) return {};
  const r = raw as Record<string, unknown>;
  // 8days uses codeburn's rolling-week storage key (rawJson.week).
  if (period === "8days") {
    return ((r.week as RawPeriodData | undefined) ?? {}) as RawPeriodData;
  }
  if ("all" in r || "today" in r) {
    return (r[period] ?? r.all ?? {}) as RawPeriodData;
  }
  return r as RawPeriodData;
}

export async function GET(req: NextRequest) {
  // 로컬 모드면 NextAuth session 우회, 단일 사용자 자동 보장.
  const session = IS_LOCAL_MODE ? null : await getServerSession(authOptions);
  const authedEmail = await getAuthedEmail(session?.user?.email);
  if (!authedEmail)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const period = (req.nextUrl.searchParams.get("period") ?? "8days") as Period;
  const requestedUserId = req.nextUrl.searchParams.get("userId");
  const weekOffset = parseInt(req.nextUrl.searchParams.get("weekOffset") ?? "0") || 0;
  const monthOffset = parseInt(req.nextUrl.searchParams.get("monthOffset") ?? "0") || 0;
  const dayOffset = parseInt(req.nextUrl.searchParams.get("dayOffset") ?? "0") || 0;

  // team 격리 결정. LOCAL_MODE 는 single-tenant 라 team 무의미 → null 허용.
  // platform owner 가 viewAs cookie 박은 경우 그 team, 일반 user 는 currentTeamId.
  const effectiveTeamId = IS_LOCAL_MODE
    ? null
    : await getEffectiveTeamId(session, req);
  if (!IS_LOCAL_MODE && !effectiveTeamId) {
    return NextResponse.json({ error: "no_team" }, { status: 403 });
  }

  let targetEmail = authedEmail;
  if (requestedUserId) {
    // 로컬 모드는 단일 사용자라 멤버 view 가 의미 없음 — 무시하고 본인 데이터로 폴백.
    if (!IS_LOCAL_MODE && !isAdmin(authedEmail)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (!IS_LOCAL_MODE) {
      // target user 가 effectiveTeam 멤버인지 검증 — cross-tenant 노출 차단.
      const targetMembership = await db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, effectiveTeamId!),
            eq(teamMembers.userId, parseInt(requestedUserId)),
            isNull(teamMembers.deletedAt)
          )
        )
        .limit(1);
      if (!targetMembership[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

      const targetUser = await db.select().from(users).where(eq(users.id, parseInt(requestedUserId))).limit(1);
      if (!targetUser[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
      targetEmail = targetUser[0].email;
    }
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, targetEmail))
    .limit(1);
  if (!user[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const snap = await db
    .select()
    .from(userSnapshots)
    .where(
      IS_LOCAL_MODE
        ? eq(userSnapshots.userId, user[0].id)
        : and(eq(userSnapshots.userId, user[0].id), eq(userSnapshots.teamId, effectiveTeamId!))
    )
    .limit(1);

  // team_id scope helper (LOCAL_MODE 면 undefined → and() 가 무시).
  const teamScope = IS_LOCAL_MODE ? undefined : eq(periodSnapshots.teamId, effectiveTeamId!);
  const userSnapTeamScope = IS_LOCAL_MODE ? undefined : eq(userSnapshots.teamId, effectiveTeamId!);
  const dailyVisitsTeamScope = IS_LOCAL_MODE ? undefined : eq(dailyVisits.teamId, effectiveTeamId!);
  const userBlocksTeamScope = IS_LOCAL_MODE ? undefined : eq(userBlocks.teamId, effectiveTeamId!);

  // Available snapshot list (always returned for dropdown population)
  const availableWeeklyRows = await db
    .select({ periodStart: periodSnapshots.periodStart, capturedAt: periodSnapshots.capturedAt })
    .from(periodSnapshots)
    .where(and(eq(periodSnapshots.userId, user[0].id), eq(periodSnapshots.periodType, "weekly"), teamScope))
    .orderBy(desc(periodSnapshots.periodStart));
  const availableMonthlyRows = await db
    .select({ periodStart: periodSnapshots.periodStart, capturedAt: periodSnapshots.capturedAt })
    .from(periodSnapshots)
    .where(and(eq(periodSnapshots.userId, user[0].id), eq(periodSnapshots.periodType, "monthly"), teamScope))
    .orderBy(desc(periodSnapshots.periodStart));
  const availableDailyRows = await db
    .select({ periodStart: periodSnapshots.periodStart, capturedAt: periodSnapshots.capturedAt })
    .from(periodSnapshots)
    .where(and(eq(periodSnapshots.userId, user[0].id), eq(periodSnapshots.periodType, "daily"), teamScope))
    .orderBy(desc(periodSnapshots.periodStart));

  const availableSnapshots = {
    weekly: availableWeeklyRows.map((r) => ({ periodStart: r.periodStart, capturedAt: r.capturedAt })),
    monthly: availableMonthlyRows.map((r) => ({ periodStart: r.periodStart, capturedAt: r.capturedAt })),
    daily: availableDailyRows.map((r) => ({ periodStart: r.periodStart, capturedAt: r.capturedAt })),
  };

  // Load snapshot if requested
  let snapshotRow: { periodType: string; periodStart: string; capturedAt: Date; rawJson: unknown } | null = null;
  if (weekOffset > 0 && period === "8days") {
    const rows = await db
      .select()
      .from(periodSnapshots)
      .where(and(eq(periodSnapshots.userId, user[0].id), eq(periodSnapshots.periodType, "weekly"), teamScope))
      .orderBy(desc(periodSnapshots.periodStart))
      .limit(1)
      .offset(weekOffset - 1);
    if (rows[0]) snapshotRow = { periodType: "weekly", periodStart: rows[0].periodStart, capturedAt: rows[0].capturedAt, rawJson: rows[0].rawJson };
  } else if (monthOffset > 0 && period === "month") {
    const rows = await db
      .select()
      .from(periodSnapshots)
      .where(and(eq(periodSnapshots.userId, user[0].id), eq(periodSnapshots.periodType, "monthly"), teamScope))
      .orderBy(desc(periodSnapshots.periodStart))
      .limit(1)
      .offset(monthOffset - 1);
    if (rows[0]) snapshotRow = { periodType: "monthly", periodStart: rows[0].periodStart, capturedAt: rows[0].capturedAt, rawJson: rows[0].rawJson };
  } else if (dayOffset > 0 && period === "today") {
    const rows = await db
      .select()
      .from(periodSnapshots)
      .where(and(eq(periodSnapshots.userId, user[0].id), eq(periodSnapshots.periodType, "daily"), teamScope))
      .orderBy(desc(periodSnapshots.periodStart))
      .limit(1)
      .offset(dayOffset - 1);
    if (rows[0]) snapshotRow = { periodType: "daily", periodStart: rows[0].periodStart, capturedAt: rows[0].capturedAt, rawJson: rows[0].rawJson };
  }

  // Suppress unused import warning when snapshots feature isn't yet exercised
  void asc;

  if (!snap[0]) {
    return NextResponse.json({
      user: { name: user[0].name, lastSyncedAt: user[0].lastSyncedAt, timezone: user[0].timezone ?? null },
      overview: null,
      daily: [],
      activities: [],
      projects: [],
      topSessions: [],
      availableSnapshots,
    });
  }

  const d: RawPeriodData = snapshotRow
    ? (snapshotRow.rawJson as RawPeriodData) ?? {}
    : getPeriodData(snap[0].rawJson, period);
  const ov = d.overview ?? d.summary ?? {};

  const cost = ov.cost ?? ov.totalCost ?? 0;
  const sessions = ov.sessions ?? ov.totalSessions ?? 0;
  const calls = ov.calls ?? 0;
  const tRead = ov.tokens?.cacheRead ?? 0;
  const tWrite = ov.tokens?.cacheWrite ?? 0;
  const tInput = ov.tokens?.input ?? 0;
  const tOutput = ov.tokens?.output ?? 0;
  const outputInputRatio = tInput > 0 ? tOutput / tInput : 0;
  const cacheHitPct = (tRead + tWrite + tInput) > 0
    ? (tRead / (tRead + tWrite + tInput)) * 100
    : 0;

  // period="today" 면 사용자 timezone 기준 strict today (오늘 하루) 의 ccusage 행으로
  // 핵심 KPI (cost / tokens / cacheHit / outputInputRatio) override. codeburn 의
  // today period 가 UTC 기준이라 KST/SGT 사용자에서 어제 + 오늘 spillover 가 생기는
  // 문제를 회피해, hero KPI 가 "오늘 = 오늘 하루" 와 일치하게 함.
  const strictTodayCc = (() => {
    if (period !== "today") return null;
    const tz = user[0].timezone ?? "UTC";
    let todayDate: string;
    try {
      todayDate = new Date().toLocaleDateString("en-CA", { timeZone: tz });
    } catch {
      todayDate = new Date().toISOString().slice(0, 10);
    }
    const ccDaily = (snapshotRow ? getCcusageDaily(snapshotRow.rawJson) : getCcusageDaily(snap[0].rawJson));
    const row = ccDaily.find((r) => r.date === todayDate);
    if (!row) return null;
    const totalCost = (row as { totalCost?: number }).totalCost ?? 0;
    const inputTokens = row.inputTokens ?? 0;
    const outputTokens = row.outputTokens ?? 0;
    const cacheReadTokens = row.cacheReadTokens ?? 0;
    const cacheCreationTokens = row.cacheCreationTokens ?? 0;
    const totalTokens = row.totalTokens ?? (inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens);
    return {
      date: todayDate,
      cost: totalCost,
      totalTokens,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
    };
  })();

  const allActivities = d.activities ?? [];
  const activitiesWithRate = allActivities.filter((a) => a.oneShotRate != null);
  const totalTurns = activitiesWithRate.reduce((s, a) => s + (a.turns ?? a.sessions ?? 1), 0);
  const weightedOneShot = activitiesWithRate.reduce(
    (s, a) => s + ((a.oneShotRate! / 100) * (a.turns ?? a.sessions ?? 1)),
    0
  );
  const oneShotRate = totalTurns > 0 ? weightedOneShot / totalTurns : 0;

  // ccusage daily — snapshots also carry filtered ccusageDaily after first promote
  const ccusageRows = snapshotRow
    ? getCcusageDaily(snapshotRow.rawJson)
    : getCcusageDaily(snap[0].rawJson);
  const ccusageMap: Record<string, { tokens: number; cost: number }> = {};
  for (const r of ccusageRows) {
    if (r.date) ccusageMap[r.date] = {
      tokens: r.totalTokens ?? 0,
      cost: (r as { totalCost?: number }).totalCost ?? 0,
    };
  }

  // Override codeburn daily cost with ccusage calendar-day cost (codeburn week
  // truncates the boundary day mid-hour, ccusage gives the full day total)
  let rawDaily = d.daily ?? [];

  // "오늘" 보정: codeburn은 UTC 기준 today를 리턴하므로 SGT/KST 사용자에서
  // 자정~UTC 자정 사이엔 어제 날짜가 들어옴. ccusage의 max 날짜가 더 미래면
  // 그 행을 사용자 로컬 today로 채택.
  if (period === "today" && !snapshotRow && ccusageRows.length > 0) {
    const sortedCc = [...ccusageRows]
      .filter((r) => !!r.date)
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    const latestCc = sortedCc[sortedCc.length - 1];
    const latestCb = rawDaily[rawDaily.length - 1]?.date;
    if (latestCc?.date && (!latestCb || latestCc.date > latestCb)) {
      rawDaily = [{
        date: latestCc.date,
        cost: (latestCc as { totalCost?: number }).totalCost ?? 0,
        sessions: 0,
      }];
    }
  }

  const daily = rawDaily.map((day) => ({
    ...day,
    cost: ccusageMap[day.date]?.cost ?? day.cost,
  }));
  const activeDays = daily.filter((day) => day.cost > 0).length;

  const dailyTokens = daily.map((day) => ({
    date: day.date,
    totalTokens: ccusageMap[day.date]?.tokens ?? 0,
  }));

  // Recompute period totals from ccusage-corrected daily (only override if ccusage data exists)
  const ccusageHasData = Object.keys(ccusageMap).length > 0;
  const correctedTotalCost = ccusageHasData
    ? daily.reduce((s, day) => s + day.cost, 0)
    : null;

  // Heatmap (period 무관). ccusage 우선, 없으면 codeburn all daily.
  // 길이는 사용자 데이터 시작일에 맞춰 15주~26주 사이에서 동적 결정:
  //   - 데이터가 14주 이하 → 15주 (최소, 신규 사용자 자연스럽게)
  //   - 데이터가 15~26주  → 데이터 전부 보임
  //   - 데이터가 26주 초과 → 26주 (최대, half-width 카드 시각적 한계)
  const heatmapDailySource: Array<{ date?: string; totalCost?: number; cost?: number }> =
    ccusageRows.length > 0
      ? ccusageRows
      : (((snap[0].rawJson as Record<string, unknown>).all as { daily?: Array<{ date?: string; cost?: number }> } | undefined)?.daily ?? []);
  const heatmapMap: Record<string, number> = {};
  for (const r of heatmapDailySource) {
    if (!r.date) continue;
    heatmapMap[r.date] = (r as { totalCost?: number; cost?: number }).totalCost ?? r.cost ?? 0;
  }
  // 활동·체류 히트맵 모두 24주 고정 — 데이터 양 무관 일관 카드 크기, 신규
  // 사용자도 동일 시각. 활동 없는 날은 level 0 (배경색) 으로 자연 표시.
  // 26주는 너무 빽빽 → 24주 (짝수, 카드 폭과 균형).
  const HEATMAP_WEEKS = 24;
  const heatmapBase = new Date();
  const earliestDate = heatmapDailySource
    .map((r) => r.date)
    .filter((d): d is string => !!d)
    .sort()[0];
  const dataDays = earliestDate
    ? Math.floor((heatmapBase.getTime() - new Date(earliestDate).getTime()) / 86_400_000) + 1
    : 0;
  void dataDays; // 옛 가변 로직 잔재 — 의도된 silence.
  const heatmapDays = HEATMAP_WEEKS * 7;
  const heatmapDaily: Array<{ date: string; cost: number }> = [];
  for (let i = heatmapDays - 1; i >= 0; i--) {
    const d2 = new Date(heatmapBase);
    d2.setDate(d2.getDate() - i);
    const key = d2.toISOString().slice(0, 10);
    heatmapDaily.push({ date: key, cost: heatmapMap[key] ?? 0 });
  }

  // Visit/Dwell heatmap: target user 의 daily_visits (heatmap 과 동일한
  // 15~26주 적응형). 색은 dwell 기준 (실제 머문 시간), tooltip 의 count 는
  // 분 단위. visit count 는 별도 visitCount 필드로 함께 노출 (팀 페이지
  // engagement 컬럼 등에서도 사용 가능).
  const visitRows = await db
    .select({
      date: dailyVisits.date,
      count: dailyVisits.count,
      dwell: dailyVisits.totalDwellSeconds,
    })
    .from(dailyVisits)
    .where(and(eq(dailyVisits.userId, user[0].id), dailyVisitsTeamScope));
  const visitMap: Record<string, { count: number; dwell: number }> = {};
  for (const r of visitRows) visitMap[r.date] = { count: r.count, dwell: r.dwell };
  const visitEarliest = Object.keys(visitMap).sort()[0];
  const visitDataDays = visitEarliest
    ? Math.floor((heatmapBase.getTime() - new Date(visitEarliest).getTime()) / 86_400_000) + 1
    : 0;
  void visitDataDays; // 옛 가변 로직 잔재
  const visitDays = HEATMAP_WEEKS * 7;
  const visitDaily: Array<{ date: string; visitCount: number; dwellSec: number }> = [];
  for (let i = visitDays - 1; i >= 0; i--) {
    const d2 = new Date(heatmapBase);
    d2.setDate(d2.getDate() - i);
    const key = d2.toISOString().slice(0, 10);
    const m = visitMap[key];
    visitDaily.push({ date: key, visitCount: m?.count ?? 0, dwellSec: m?.dwell ?? 0 });
  }

  // Build path lookup for topSessions
  const projectPathMap: Record<string, string> = {};
  for (const p of d.projects ?? []) {
    if (p.name && p.path) projectPathMap[p.name] = p.path;
  }

  const projects = (d.projects ?? []).map((p) => {
    const c = p.cost ?? 0;
    const s = p.sessions ?? p.calls ?? 0;
    return {
      name: p.name ?? "",
      path: p.path ?? "",
      cost: c,
      sessions: s,
      avgCost: p.avgCost ?? (s > 0 ? c / s : 0),
    };
  });

  const topSessions = (d.topSessions ?? []).map((s) => ({
    id: s.id ?? s.sessionId ?? "",
    date: s.date ?? "",
    project: s.project ?? "",
    projectPath: projectPathMap[s.project ?? ""] ?? "",
    cost: s.cost ?? 0,
    calls: s.calls ?? s.turns ?? 0,
  }));

  const activities = allActivities.map((a) => ({
    name: a.name ?? a.category ?? "Unknown",
    turns: a.turns ?? a.sessions ?? 0,
    cost: a.cost ?? 0,
    oneShotRate: a.oneShotRate != null
      ? (a.oneShotRate > 1 ? a.oneShotRate / 100 : a.oneShotRate)
      : null,
  }));

  const models = (d.models ?? []).map((m) => {
    const input = m.inputTokens ?? 0;
    const cacheRead = m.cacheReadTokens ?? 0;
    const cacheWrite = m.cacheWriteTokens ?? 0;
    const denom = input + cacheRead + cacheWrite;
    const cacheHit = denom > 0 ? (cacheRead / denom) * 100 : 0;
    return { name: m.name ?? "", cost: m.cost ?? 0, calls: m.calls ?? 0, cacheHitPct: cacheHit };
  });

  const toNameCalls = (arr: RawNameCalls[]) =>
    arr.map((x) => ({ name: x.name ?? "", calls: x.calls ?? 0 }));

  // Snapshot metadata: capture time + actual data range
  let snapshotInfo: {
    type: "weekly" | "monthly" | "daily";
    periodStart: string;
    capturedAt: string;
    dataRangeStart: string | null;
    dataRangeEnd: string | null;
  } | null = null;
  if (snapshotRow) {
    const sortedDaily = [...daily].sort((a, b) => a.date.localeCompare(b.date));
    const t = snapshotRow.periodType === "monthly" ? "monthly" : snapshotRow.periodType === "daily" ? "daily" : "weekly";
    snapshotInfo = {
      type: t,
      periodStart: snapshotRow.periodStart,
      capturedAt: snapshotRow.capturedAt.toISOString(),
      dataRangeStart: sortedDaily[0]?.date ?? null,
      dataRangeEnd: sortedDaily[sortedDaily.length - 1]?.date ?? null,
    };
  }

  // ─── 일일 효율 점수 + 90일 잔디 + cache 90% streak (period 무관, 항상 현재) ───
  // ccusage daily 의 토큰 분해 + codeburn "all".daily 의 cost/calls/oneShotRate 결합.
  // oneShotRate: codeburn 0.9.8+ 만 노출. 0.9.7 이하 또는 chat-only day 는 null →
  // computeDailyEfficiencyScore 가 cache 85 + cost 15 fallback 으로 자동 처리.
  const codeburnAllDaily = ((snap[0].rawJson as Record<string, unknown>).all as
    | { daily?: Array<{ date?: string; cost?: number; calls?: number; oneShotRate?: number | null }> }
    | undefined)?.daily ?? [];
  const cbDailyMap: Record<string, { cost: number; calls: number; oneShotRate: number | null }> = {};
  for (const r of codeburnAllDaily) {
    if (r.date) {
      cbDailyMap[r.date] = {
        cost: r.cost ?? 0,
        calls: r.calls ?? 0,
        oneShotRate: r.oneShotRate ?? null,
      };
    }
  }
  const cuDailyMap: Record<string, { input: number; cacheRead: number; cacheWrite: number; output: number; total: number }> = {};
  for (const r of ccusageRows) {
    if (r.date) {
      const input = r.inputTokens ?? 0;
      const cacheRead = r.cacheReadTokens ?? 0;
      const cacheWrite = r.cacheCreationTokens ?? 0;
      const output = r.outputTokens ?? 0;
      cuDailyMap[r.date] = {
        input,
        cacheRead,
        cacheWrite,
        output,
        // ccusage 의 totalTokens 가 있으면 그대로, 없으면 합산
        total: r.totalTokens ?? (input + cacheRead + cacheWrite + output),
      };
    }
  }

  // 24주 (168일) — 활동·체류 히트맵 (HEATMAP_WEEKS=24) 와 동일 시각 균형.
  // 응답 크기 ~1.87× (90→168), Vercel 한도 안전.
  const SCORE_DAYS = 168;
  const scoreSeries: Array<{
    date: string;
    score: number | null;
    cacheHitPct: number | null;
    oneShotRate: number | null;
    costPerCall: number | null;
    totalTokens: number | null;
  }> = [];
  const scoreBase = new Date();
  for (let i = SCORE_DAYS - 1; i >= 0; i--) {
    const d2 = new Date(scoreBase);
    d2.setDate(d2.getDate() - i);
    const key = d2.toISOString().slice(0, 10);
    const cu = cuDailyMap[key];
    const cb = cbDailyMap[key];
    if (!cu || !cb || cb.calls === 0) {
      scoreSeries.push({ date: key, score: null, cacheHitPct: null, oneShotRate: null, costPerCall: null, totalTokens: null });
      continue;
    }
    const totalDenom = cu.input + cu.cacheRead + cu.cacheWrite;
    const dayCacheHitPct = totalDenom > 0 ? (cu.cacheRead / totalDenom) * 100 : 0;
    const dayCostPerCall = cb.calls > 0 ? cb.cost / cb.calls : 0;
    const dayScore = computeDailyEfficiencyScore(dayCacheHitPct, dayCostPerCall, cb.oneShotRate, cu.total);
    scoreSeries.push({
      date: key,
      score: dayScore,
      cacheHitPct: dayCacheHitPct,
      oneShotRate: cb.oneShotRate,
      costPerCall: dayCostPerCall,
      totalTokens: cu.total,
    });
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const yesterdayKey = (() => {
    const d2 = new Date();
    d2.setDate(d2.getDate() - 1);
    return d2.toISOString().slice(0, 10);
  })();
  const todayEntry = scoreSeries.find((s) => s.date === todayKey);
  const yesterdayEntry = scoreSeries.find((s) => s.date === yesterdayKey);
  const todayScore = todayEntry?.score ?? null;
  const yesterdayScore = yesterdayEntry?.score ?? null;
  const scoreDelta = todayScore !== null && yesterdayScore !== null
    ? todayScore - yesterdayScore
    : null;

  // Period 별 efficiency score = scoreSeries (daily) 를 period window 로 필터 후
  // 평균. EFFICIENCY 카드 배지에서 사용. period=today 면 단일 entry → 게이지와 동일값.
  // 다른 period 는 "이 기간 평균 일효율".
  const periodWindow = (() => {
    const today = new Date();
    const todayY = today.toISOString().slice(0, 10);
    switch (period) {
      case "today":
        return { start: todayY, end: todayY };
      case "month": {
        const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
          .toISOString().slice(0, 10);
        return { start: monthStart, end: todayY };
      }
      case "8days": {
        const start = new Date(today);
        start.setDate(start.getDate() - 7);
        return { start: start.toISOString().slice(0, 10), end: todayY };
      }
      case "30days": {
        const start = new Date(today);
        start.setDate(start.getDate() - 29);
        return { start: start.toISOString().slice(0, 10), end: todayY };
      }
      case "all":
      default:
        return { start: "0000-01-01", end: todayY };
    }
  })();
  const periodScoreEntries = scoreSeries.filter(
    (s) => s.date >= periodWindow.start && s.date <= periodWindow.end && s.score !== null,
  );
  const periodScore = periodScoreEntries.length > 0
    ? Math.round(periodScoreEntries.reduce((acc, s) => acc + (s.score ?? 0), 0) / periodScoreEntries.length)
    : null;

  // cache hit ≥ 90% streak. 활동 없는 날은 스킵 (보류), 활동 + cache<90 = 리셋.
  let cacheStreak = 0;
  for (let i = scoreSeries.length - 1; i >= 0; i--) {
    const s2 = scoreSeries[i];
    if (s2.cacheHitPct === null) continue;
    if (s2.cacheHitPct >= 90) cacheStreak += 1;
    else break;
  }

  // 팀 랭킹 (이번 주 cache hit 기준). period 무관, 본인 화면에서만 노출 (sneer 방지).
  const sevenDaysAgoKey = (() => {
    const d2 = new Date();
    d2.setDate(d2.getDate() - 7);
    return d2.toISOString().slice(0, 10);
  })();
  // team 랭킹 — effectiveTeam 멤버만. LOCAL_MODE 면 single-user, ranking 무의미하지만 호환.
  const rankMemberIdRows = IS_LOCAL_MODE
    ? []
    : await db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, effectiveTeamId!), isNull(teamMembers.deletedAt)));
  const rankMemberIds = rankMemberIdRows.map((r) => r.userId);
  const allUsersForRank = IS_LOCAL_MODE
    ? await db.select().from(users)
    : rankMemberIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, rankMemberIds))
      : [];
  const allSnapsForRank = IS_LOCAL_MODE
    ? await db.select().from(userSnapshots)
    : rankMemberIds.length > 0
      ? await db
          .select()
          .from(userSnapshots)
          .where(and(inArray(userSnapshots.userId, rankMemberIds), userSnapTeamScope))
      : [];
  const snapMapAll = new Map(allSnapsForRank.map((s2) => [s2.userId, s2]));
  const memberCacheHits: Array<{ userId: number; cacheHitPct: number }> = [];
  for (const u of allUsersForRank) {
    const s2 = snapMapAll.get(u.id);
    if (!s2) continue;
    const ccu = (s2.rawJson as Record<string, unknown>).ccusageDaily as
      | { daily?: Array<{ date?: string; period?: string; inputTokens?: number; cacheReadTokens?: number; cacheCreationTokens?: number }> }
      | undefined;
    // ccusage 19.x: row 키 'date' → 'period'. 양쪽 fallback.
    const recent = (ccu?.daily ?? [])
      .map((d) => ({ ...d, date: d.date ?? d.period }))
      .filter((d) => d.date && d.date >= sevenDaysAgoKey);
    const tRead = recent.reduce((s3, d) => s3 + (d.cacheReadTokens ?? 0), 0);
    const tIn = recent.reduce((s3, d) => s3 + (d.inputTokens ?? 0), 0);
    const tWrite = recent.reduce((s3, d) => s3 + (d.cacheCreationTokens ?? 0), 0);
    const denom = tRead + tIn + tWrite;
    if (denom === 0) continue;
    memberCacheHits.push({ userId: u.id, cacheHitPct: (tRead / denom) * 100 });
  }
  memberCacheHits.sort((a, b) => b.cacheHitPct - a.cacheHitPct);
  const myRankIdx = memberCacheHits.findIndex((m) => m.userId === user[0].id);
  const myCacheHitWeek = myRankIdx >= 0 ? memberCacheHits[myRankIdx].cacheHitPct : null;
  const teamAvgCacheHitWeek = memberCacheHits.length > 0
    ? memberCacheHits.reduce((s2, m) => s2 + m.cacheHitPct, 0) / memberCacheHits.length
    : 0;
  const teamRank = myRankIdx >= 0 && myCacheHitWeek !== null
    ? {
        position: myRankIdx + 1,
        total: memberCacheHits.length,
        selfCacheHitPct: myCacheHitWeek,
        teamAvgCacheHitPct: teamAvgCacheHitWeek,
      }
    : null;

  // snapshot 모드 (지난주/지난달 등) 면 점수 섹션 숨김 — historical 분석 모드와
  // self-motivation 모드 분리. UI 의 conditional 이 null 받으면 자동 hide.
  const efficiencyScore = snapshotRow ? null : {
    today: todayScore,
    yesterday: yesterdayScore,
    delta: scoreDelta,
    streak: cacheStreak,
    daily: scoreSeries,
    teamRank,
  };

  // Apply ccusage-corrected cost to overview-derived metrics.
  // period="today" 면 strict today (사용자 timezone 기준 오늘 행) ccusage 값으로 override.
  const finalCost = strictTodayCc
    ? strictTodayCc.cost
    : (correctedTotalCost ?? cost);
  const finalCostPerCall = calls > 0 ? finalCost / calls : 0;

  // period="today" 면 cacheHitPct / outputInputRatio / avgDailyTokens 도 ccusage 의
  // 오늘 행 기반으로 재계산. sessions / calls / oneShotRate 는 ccusage 에 동등한
  // 일별 metric 이 없어 codeburn (2일 spillover 가능) 유지.
  const finalCacheHitPct = strictTodayCc
    ? ((strictTodayCc.cacheReadTokens + strictTodayCc.cacheCreationTokens + strictTodayCc.inputTokens) > 0
      ? (strictTodayCc.cacheReadTokens / (strictTodayCc.cacheReadTokens + strictTodayCc.cacheCreationTokens + strictTodayCc.inputTokens)) * 100
      : 0)
    : cacheHitPct;
  const finalOutputInputRatio = strictTodayCc
    ? (strictTodayCc.inputTokens > 0 ? strictTodayCc.outputTokens / strictTodayCc.inputTokens : 0)
    : outputInputRatio;
  const finalAvgDailyTokens = strictTodayCc
    ? strictTodayCc.totalTokens   // strict today = 단일 일이라 avg = total
    : (activeDays > 0 ? (tRead + tWrite + tInput + tOutput) / activeDays : 0);

  // Active blocks — ccusage blocks 기반 wall-clock 집계.
  // gap/active-without-end 는 ingest 단계에서 이미 필터됨.
  // period 따라 윈도우 변경: today=null(미표시), month=달 시작, 8days/30days=상대,
  // all=90일(retention 한계).
  const blocksWindowStart = (() => {
    const now = new Date();
    switch (period) {
      case "today": return null;
      case "month": return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      case "8days": return new Date(now.getTime() - 8 * 86_400_000);
      case "30days": return new Date(now.getTime() - 30 * 86_400_000);
      case "all": return new Date(now.getTime() - 90 * 86_400_000);
      default: return new Date(now.getTime() - 30 * 86_400_000);
    }
  })();
  const blockRows = blocksWindowStart
    ? await db
        .select()
        .from(userBlocks)
        .where(and(
          eq(userBlocks.userId, user[0].id),
          gte(userBlocks.startedAt, blocksWindowStart),
          userBlocksTeamScope,
        ))
        .orderBy(asc(userBlocks.startedAt))
    : [];

  const minutesArr = blockRows.map((b) => b.minutes);
  const sortedMinutes = [...minutesArr].sort((a, b) => a - b);
  const medianMinutes = sortedMinutes.length === 0
    ? 0
    : sortedMinutes.length % 2
      ? sortedMinutes[Math.floor(sortedMinutes.length / 2)]
      : (sortedMinutes[sortedMinutes.length / 2 - 1] + sortedMinutes[sortedMinutes.length / 2]) / 2;
  const totalBlockMinutes = minutesArr.reduce((s, m) => s + m, 0);
  const totalBlockTokens = blockRows.reduce((s, b) => s + Number(b.totalTokens ?? 0), 0);
  const tokensPerMinute = totalBlockMinutes > 0 ? totalBlockTokens / totalBlockMinutes : 0;

  const distribution = { lt30: 0, m30to60: 0, h1to2: 0, h2to4: 0, h4plus: 0 };
  for (const m of minutesArr) {
    if (m < 30) distribution.lt30++;
    else if (m < 60) distribution.m30to60++;
    else if (m < 120) distribution.h1to2++;
    else if (m < 240) distribution.h2to4++;
    else distribution.h4plus++;
  }

  let longest: { minutes: number; startedAt: string | null } = { minutes: 0, startedAt: null };
  for (const b of blockRows) {
    if (b.minutes > longest.minutes) {
      longest = { minutes: b.minutes, startedAt: b.startedAt.toISOString() };
    }
  }
  const blockActiveDays = new Set(
    blockRows.map((b) => b.startedAt.toISOString().slice(0, 10))
  ).size;

  // 직전 동일 길이 윈도우 트렌드 비교용 (period === "all" 은 retention 한계로
  // prev 없음). prev 윈도우 = [start - length, start).
  let prevTrend: {
    countDeltaPct: number | null;
    avgMinutesDeltaPct: number | null;
    tokensPerMinuteDeltaPct: number | null;
    hasPrevData: boolean;
  } | null = null;
  if (blocksWindowStart && period !== "all") {
    const windowMs = Date.now() - blocksWindowStart.getTime();
    const prevStart = new Date(blocksWindowStart.getTime() - windowMs);
    const prevEnd = blocksWindowStart;
    const prevRows = await db
      .select({ minutes: userBlocks.minutes, totalTokens: userBlocks.totalTokens })
      .from(userBlocks)
      .where(and(
        eq(userBlocks.userId, user[0].id),
        gte(userBlocks.startedAt, prevStart),
        lt(userBlocks.startedAt, prevEnd),
        userBlocksTeamScope,
      ));
    const prevCount = prevRows.length;
    const prevTotalMin = prevRows.reduce((s, r) => s + r.minutes, 0);
    const prevTotalTok = prevRows.reduce((s, r) => s + Number(r.totalTokens ?? 0), 0);
    const prevAvgMin = prevCount ? prevTotalMin / prevCount : 0;
    const prevTokPerMin = prevTotalMin > 0 ? prevTotalTok / prevTotalMin : 0;
    const pct = (cur: number, prev: number): number | null => {
      if (prev === 0) return cur === 0 ? null : null; // "new" 케이스 — UI 에서 다르게 표기 가능하나 단순화
      return Math.round(((cur - prev) / prev) * 100);
    };
    prevTrend = {
      countDeltaPct: pct(blockRows.length, prevCount),
      avgMinutesDeltaPct: pct(blockRows.length ? totalBlockMinutes / blockRows.length : 0, prevAvgMin),
      tokensPerMinuteDeltaPct: pct(tokensPerMinute, prevTokPerMin),
      hasPrevData: prevCount > 0,
    };
  }

  // 패턴 분류. median 우선, 그 다음 분포 비율로 보정.
  // 5개 미만이면 단발형 (tooFewData 와 별개로 5~9 도 신호 약함).
  const totalBlocks = blockRows.length;
  let pattern: "몰입형" | "분산형" | "균형형" | "단발형" = "균형형";
  if (totalBlocks < 10) {
    pattern = "단발형";
  } else if (medianMinutes >= 240 || distribution.h4plus / totalBlocks >= 0.5) {
    pattern = "몰입형";
  } else if (medianMinutes < 60 || (distribution.lt30 + distribution.m30to60) / totalBlocks >= 0.5) {
    pattern = "분산형";
  }

  // period === "today" 면 카드 자체 미표시 (blocks=null).
  // 그 외 기간에서 블록 5개 미만이면 tooFewData=true 로 카드는 보이되 안내 문구.
  const blocks = period === "today"
    ? null
    : {
        count: blockRows.length,
        activeDays: blockActiveDays,
        avgMinutes: blockRows.length ? Math.round(totalBlockMinutes / blockRows.length) : 0,
        medianMinutes: Math.round(medianMinutes),
        maxMinutes: longest.minutes,
        longestStartedAt: longest.startedAt,
        tokensPerMinute: Math.round(tokensPerMinute),
        totalMinutes: totalBlockMinutes,
        totalTokens: totalBlockTokens,
        distribution,
        tooFewData: blockRows.length < 5,
        pattern,
        trend: prevTrend,
      };

  // period → days 환산. all 은 retention 한계 (90일) 로 cap.
  const periodDays = (() => {
    const now = new Date();
    switch (period) {
      case "today": return 1;
      case "8days": return 8;
      case "month": {
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        return Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 86_400_000));
      }
      case "30days": return 30;
      case "all": return 90;
      default: return 30;
    }
  })();

  // Plan Health & Power Index — period 비례 정규화. window 도 period 기반.
  const planBlocksWindowStart = (() => {
    const now = new Date();
    switch (period) {
      case "today": return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      case "month": return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      case "8days": return new Date(now.getTime() - 8 * 86_400_000);
      case "30days": return new Date(now.getTime() - 30 * 86_400_000);
      case "all": return new Date(now.getTime() - 90 * 86_400_000);
      default: return new Date(now.getTime() - 30 * 86_400_000);
    }
  })();
  const planBlockRows = await db
    .select({
      totalTokens: userBlocks.totalTokens,
      startedAt: userBlocks.startedAt,
      costUsd: userBlocks.costUsd,
    })
    .from(userBlocks)
    .where(and(
      eq(userBlocks.userId, user[0].id),
      gte(userBlocks.startedAt, planBlocksWindowStart),
      userBlocksTeamScope,
    ));
  // cost-based verdict 신호 — period 의 API 환산 비용.
  // ccusage cost = PAYG 가격 환산. plan price 와 비교해 Plan ROI 평가.
  const planBlocksMonthlyCost = planBlockRows.reduce((s, b) => s + Number(b.costUsd ?? 0), 0);
  const planHealth = analyzePlanHealth({
    blocks: planBlockRows.map((b) => ({
      totalTokens: Number(b.totalTokens ?? 0),
      startedAt: b.startedAt,
    })),
    declaredTier: (user[0].planTier ?? null) as PlanTier,
    // period 의 cacheHitPct (overview 에서 계산된 값 사용 — period 정확도 ↑).
    // snap[0].cacheHitPct (누적 평균) 보다 period 의 실제 값이 정확.
    cacheHitPct: cacheHitPct > 0 ? cacheHitPct : undefined,
    oneShotRate: snap[0]?.overallOneShot ? snap[0].overallOneShot * 100 : undefined,
    windowDays: periodDays,
    monthlyCostUsd: planBlocksMonthlyCost,
  });

  // Period 단위 ccusage daily 집계 — totalWindowTokens / cache hit / non-cache 의
  // 단일 출처. 이전엔 user_blocks 합 (+ overview fallback) 으로 5h 단위, codeburn
  // cacheHit 로 비례 분해했으나 단위 혼재 + "오늘 = N tokens" 가 hero (ccusage
  // daily) 와 다른 숫자 표시되는 혼란 발생. ccusage daily 로 통일 (2026-05-22 결정).
  const ccusagePeriodAgg = (() => {
    if (strictTodayCc) {
      return {
        totalTokens: strictTodayCc.totalTokens,
        inputTokens: strictTodayCc.inputTokens,
        outputTokens: strictTodayCc.outputTokens,
        cacheReadTokens: strictTodayCc.cacheReadTokens,
        cacheCreationTokens: strictTodayCc.cacheCreationTokens,
      };
    }
    const periodDates = new Set(dailyTokens.map((d) => d.date));
    const rows = ccusageRows.filter((r) => r.date && periodDates.has(r.date));
    return {
      totalTokens: rows.reduce((s, r) => s + (r.totalTokens ?? 0), 0),
      inputTokens: rows.reduce((s, r) => s + (r.inputTokens ?? 0), 0),
      outputTokens: rows.reduce((s, r) => s + (r.outputTokens ?? 0), 0),
      cacheReadTokens: rows.reduce((s, r) => s + (r.cacheReadTokens ?? 0), 0),
      cacheCreationTokens: rows.reduce((s, r) => s + (r.cacheCreationTokens ?? 0), 0),
    };
  })();
  const totalWindowTokens = ccusagePeriodAgg.totalTokens;
  // period 내 활성일 = ccusage daily 의 활동 일자 수. periodDays 로 cap (boundary 방어).
  const effectiveActiveDays = Math.min(periodDays, activeDays);

  // cache hit / non-cache — ccusage daily 의 cache 필드로 직접 계산.
  const ccCacheDenom =
    ccusagePeriodAgg.cacheReadTokens +
    ccusagePeriodAgg.cacheCreationTokens +
    ccusagePeriodAgg.inputTokens;
  const cacheHitPctForPeriod = ccCacheDenom > 0
    ? (ccusagePeriodAgg.cacheReadTokens / ccCacheDenom) * 100
    : null;
  const nonCacheTotalWindowTokens = ccusagePeriodAgg.totalTokens > 0
    ? ccusagePeriodAgg.inputTokens + ccusagePeriodAgg.outputTokens
    : null;
  // realUsagePct — 5h cap 단위 분석. ccusage daily 통일로 산정 불가, 항상 null.
  const realUsagePct = null;
  // blockCountInPeriod — 응답 shape 유지용 (user_blocks 데이터는 ingest 가 계속
  // 누적, 향후 카드 부활 시 즉시 사용 가능). UI 에선 더 이상 표시 안 함.
  const blockCountInPeriod = planBlockRows.length;

  // priceForPeriod — 월 요금을 period 일수에 비례 배분.
  // tier 미입력 사용자도 추정 (P90 + cost) 으로 단가 계산. UI 에서 (추정) 명시.
  //   estimateTier 우선순위: declaredTier > P90 추정 > cost 추정 (max 채택)
  const declaredLimits = planHealth.declaredLimits;
  let effectiveLimits = declaredLimits;
  let isEstimatedTier = false;
  if (!effectiveLimits) {
    // 30일 cost (period 무관 anchor) 별도 query 후 종합 추정.
    const cost30dStart = new Date(Date.now() - 30 * 86_400_000);
    const cost30dRows = await db
      .select({ costUsd: userBlocks.costUsd })
      .from(userBlocks)
      .where(and(
        eq(userBlocks.userId, user[0].id),
        gte(userBlocks.startedAt, cost30dStart),
        userBlocksTeamScope,
      ));
    const monthlyCost30d = cost30dRows.reduce((s, r) => s + Number(r.costUsd ?? 0), 0);
    // P90 token 신호는 cache 포함이라 단위 안 맞아 폐기 — cost 단독 추정.
    const combined = estimateTierFromMonthlyCost(monthlyCost30d);
    if (combined !== "unknown") {
      effectiveLimits = getPlanLimits(combined);
      isEstimatedTier = true;
    }
  }
  const monthlyPriceUsd = effectiveLimits?.monthlyPriceUsd ?? null;
  const priceForPeriod = monthlyPriceUsd !== null
    ? (monthlyPriceUsd * periodDays) / 30
    : null;

  // API tier (PAYG) 사용자 추천 플랜 — UsageHero 의 토큰 단가 자리에 표시.
  // 지난 30일 실제 cost 기준 cheapest plan 추천 + 절감액 계산. plan 가격이 API 비용
  // 보다 비싸면 (= 사용량 적음) 'low' edge case → API 종량제 유지 권장.
  type ApiRecommendation = {
    monthlyCost30d: number;
    recommendedTier: Exclude<PlanTier, null> | "api";
    recommendedTierLabel: string;
    planMonthlyPrice: number;
    savingsAmount: number;
    savingsPct: number;
    // "high" 분기 제거 (2026-05-22). 옛 분기는 cost > $400 → "Max 20x 한도
    // 자주 도달 위험" 메시지였으나, cache leverage 사용자별 5×~100× 다양해서
    // monthlyCost30d 가 부풀려진 cache 친 cost 라 한도 도달과 무관. eugene
    // 5h 0번 / 1주 1번 사례로 misleading 확인 → low | normal 만.
    edgeCase: "low" | "normal";
  };
  let apiRecommendation: ApiRecommendation | null = null;
  if (declaredLimits?.tier === "api") {
    // 30일 cost — userBlocks 합산. 위 isEstimatedTier 블록에서 이미 계산했을 수도
    // 있으나 declaredLimits 가 있어 거기 안 들어감. 별도 query.
    const cost30dStart = new Date(Date.now() - 30 * 86_400_000);
    const cost30dRows = await db
      .select({ costUsd: userBlocks.costUsd })
      .from(userBlocks)
      .where(and(
        eq(userBlocks.userId, user[0].id),
        gte(userBlocks.startedAt, cost30dStart),
        userBlocksTeamScope,
      ));
    const monthlyCost30d = cost30dRows.reduce((s, r) => s + Number(r.costUsd ?? 0), 0);
    const recommended = estimateTierFromMonthlyCost(monthlyCost30d);
    if (monthlyCost30d < 20 || recommended === "unknown") {
      // 사용량이 Pro 최저 (\$20/월) 보다 적음 — 어떤 plan 도 종량제보다 비쌈.
      apiRecommendation = {
        monthlyCost30d,
        recommendedTier: "api",
        recommendedTierLabel: "API 종량제 유지",
        planMonthlyPrice: 0,
        savingsAmount: 0,
        savingsPct: 0,
        edgeCase: "low",
      };
    } else {
      const recLimits = getPlanLimits(recommended);
      const savings = monthlyCost30d - recLimits.monthlyPriceUsd;
      const savingsPct = monthlyCost30d > 0 ? Math.round((savings / monthlyCost30d) * 100) : 0;
      apiRecommendation = {
        monthlyCost30d,
        recommendedTier: recommended,
        recommendedTierLabel: recLimits.label,
        planMonthlyPrice: recLimits.monthlyPriceUsd,
        savingsAmount: savings,
        savingsPct,
        edgeCase: "normal",
      };
    }
  }

  // Power Index — period 비례 정규화. fallback 적용된 값 사용.
  const powerActiveDays = effectiveActiveDays;
  const powerAvgDailyTokens = effectiveActiveDays > 0 ? totalWindowTokens / effectiveActiveDays : 0;
  const powerIndexValue = computePowerIndex(powerActiveDays, powerAvgDailyTokens, periodDays);

  // 일별 토큰 단가 (plan amortized) — team route 의 dailyUnitCostByMember 와 동일 공식.
  // = (monthlyPrice/30) / 일별 토큰 × 1M. tier 미입력·추정 모두 포함, UI 에서 isEstimatedTier 로 시각 구분.
  // ccusage 의 daily 토큰 기반 (dailyTokens 와 동일 date 키).
  const usdPerDay = monthlyPriceUsd !== null ? monthlyPriceUsd / 30 : null;
  const dailyPlanUnitCost = dailyTokens.map((d) => ({
    date: d.date,
    unitCost:
      usdPerDay !== null && d.totalTokens > 0
        ? (usdPerDay / d.totalTokens) * 1_000_000
        : null,
  }));

  return NextResponse.json({
    user: { name: user[0].name, lastSyncedAt: user[0].lastSyncedAt, timezone: user[0].timezone ?? null, planTier: user[0].planTier ?? null },
    overview: {
      cost: finalCost,
      sessions,
      calls,
      cacheHitPct: finalCacheHitPct,
      oneShotRate,
      activeDays,
      costPerCall: finalCostPerCall,
      outputInputRatio: finalOutputInputRatio,
      // 기간 평균 일별 total tokens (cache reads 포함). EFFICIENCY 배지의 token 신호용.
      avgDailyTokens: finalAvgDailyTokens,
      // period="today" 면 hero 카드용 strict today total tokens (오늘 하루만).
      // null 이면 frontend 가 chartTokenData.reduce() fallback 사용.
      totalTokensStrictToday: strictTodayCc?.totalTokens ?? null,
      // period scoreSeries 평균 (period=today 면 단일 entry = 게이지 값과 일치).
      // 배지가 사용 — 게이지와 영원히 동기화.
      periodScore,
    },
    planHealth: {
      ...planHealth,
      // declaredLimits 가 null 이면 추정 effectiveLimits 로 override.
      // UI 에서 isEstimatedTier 로 (추정) 시각 구분.
      declaredLimits: effectiveLimits ?? planHealth.declaredLimits,
      isEstimatedTier,
      totalWindowTokens,    // fallback 적용된 값으로 override
      nonCacheTotalWindowTokens,
      realUsagePct,
      blockCountInPeriod,
      cacheHitPctForPeriod,
      priceForPeriod,
      periodDays,
      // API tier (PAYG) 사용자 추천. 다른 tier 면 null.
      apiRecommendation,
      // 본전 회수 (이번 달 단위, period 무관) — 사용자 인터뷰 "월 요금제
      // 뽕 뽑기" 핵심 framing. monthlyPriceUsd 있을 때만 (declared 또는
      // 추정 tier). API tier / tier 미입력 / activity 0 은 null.
      monthRecovery: (() => {
        const price = effectiveLimits?.monthlyPriceUsd ?? null;
        if (!price || price <= 0) return null;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthStartYmd = monthStart.toISOString().slice(0, 10);
        const todayYmd = now.toISOString().slice(0, 10);
        const monthRows = ccusageRows
          .filter((r) => r.date && r.date >= monthStartYmd && r.date <= todayYmd)
          .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
        const daysElapsed = now.getDate();
        const daysTotal = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        if (monthRows.length === 0) {
          return {
            monthlyPriceUsd: price,
            monthCostUsd: 0,
            recoveryPct: 0,
            breakEvenDate: null as string | null,
            monthDaysElapsed: daysElapsed,
            monthDaysTotal: daysTotal,
            remainingEstimateUsd: 0,
          };
        }
        let cumulative = 0;
        let breakEvenDate: string | null = null;
        for (const r of monthRows) {
          const c = (r as { totalCost?: number }).totalCost ?? 0;
          cumulative += c;
          if (breakEvenDate === null && cumulative >= price) {
            breakEvenDate = r.date!;
          }
        }
        const avgDaily = cumulative / daysElapsed;
        const remaining = avgDaily * (daysTotal - daysElapsed);
        return {
          monthlyPriceUsd: price,
          monthCostUsd: cumulative,
          recoveryPct: Math.round((cumulative / price) * 100),
          breakEvenDate,
          monthDaysElapsed: daysElapsed,
          monthDaysTotal: daysTotal,
          remainingEstimateUsd: remaining,
        };
      })(),
    },
    powerIndex: {
      score: powerIndexValue,
      activeDays: powerActiveDays,
      avgDailyTokens: Math.round(powerAvgDailyTokens),
      periodDays,
    },
    daily,
    dailyTokens,
    dailyPlanUnitCost,
    heatmapDaily,
    visitDaily,
    activities,
    projects,
    topSessions,
    models,
    tools: toNameCalls(d.tools ?? []),
    shellCommands: toNameCalls(d.shellCommands ?? []),
    mcpServers: toNameCalls(d.mcpServers ?? []),
    availableSnapshots,
    snapshot: snapshotInfo,
    blocks,
    efficiencyScore,
  });
}
