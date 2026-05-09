import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, userSnapshots, users, periodSnapshots, dailyVisits, userBlocks } from "@/lib/db";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { isAdmin } from "@/lib/admin";

type Period = "today" | "month" | "8days" | "30days" | "all";

interface RawOverview {
  cost?: number;
  sessions?: number;
  calls?: number;
  cacheHitPercent?: number;
  totalCost?: number;
  totalSessions?: number;
  cacheHitPct?: number;
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
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalTokens?: number;
}

function getCcusageDaily(raw: unknown): CcusageDailyRow[] {
  if (typeof raw !== "object" || raw === null) return [];
  const r = raw as Record<string, unknown>;
  const cu = r.ccusageDaily as { daily?: CcusageDailyRow[] } | undefined;
  return cu?.daily ?? [];
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const period = (req.nextUrl.searchParams.get("period") ?? "8days") as Period;
  const requestedUserId = req.nextUrl.searchParams.get("userId");
  const weekOffset = parseInt(req.nextUrl.searchParams.get("weekOffset") ?? "0") || 0;
  const monthOffset = parseInt(req.nextUrl.searchParams.get("monthOffset") ?? "0") || 0;
  const dayOffset = parseInt(req.nextUrl.searchParams.get("dayOffset") ?? "0") || 0;

  let targetEmail = session.user.email!;
  if (requestedUserId) {
    if (!isAdmin(session.user.email!)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const targetUser = await db.select().from(users).where(eq(users.id, parseInt(requestedUserId))).limit(1);
    if (!targetUser[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
    targetEmail = targetUser[0].email;
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
    .where(eq(userSnapshots.userId, user[0].id))
    .limit(1);

  // Available snapshot list (always returned for dropdown population)
  const availableWeeklyRows = await db
    .select({ periodStart: periodSnapshots.periodStart, capturedAt: periodSnapshots.capturedAt })
    .from(periodSnapshots)
    .where(and(eq(periodSnapshots.userId, user[0].id), eq(periodSnapshots.periodType, "weekly")))
    .orderBy(desc(periodSnapshots.periodStart));
  const availableMonthlyRows = await db
    .select({ periodStart: periodSnapshots.periodStart, capturedAt: periodSnapshots.capturedAt })
    .from(periodSnapshots)
    .where(and(eq(periodSnapshots.userId, user[0].id), eq(periodSnapshots.periodType, "monthly")))
    .orderBy(desc(periodSnapshots.periodStart));
  const availableDailyRows = await db
    .select({ periodStart: periodSnapshots.periodStart, capturedAt: periodSnapshots.capturedAt })
    .from(periodSnapshots)
    .where(and(eq(periodSnapshots.userId, user[0].id), eq(periodSnapshots.periodType, "daily")))
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
      .where(and(eq(periodSnapshots.userId, user[0].id), eq(periodSnapshots.periodType, "weekly")))
      .orderBy(desc(periodSnapshots.periodStart))
      .limit(1)
      .offset(weekOffset - 1);
    if (rows[0]) snapshotRow = { periodType: "weekly", periodStart: rows[0].periodStart, capturedAt: rows[0].capturedAt, rawJson: rows[0].rawJson };
  } else if (monthOffset > 0 && period === "month") {
    const rows = await db
      .select()
      .from(periodSnapshots)
      .where(and(eq(periodSnapshots.userId, user[0].id), eq(periodSnapshots.periodType, "monthly")))
      .orderBy(desc(periodSnapshots.periodStart))
      .limit(1)
      .offset(monthOffset - 1);
    if (rows[0]) snapshotRow = { periodType: "monthly", periodStart: rows[0].periodStart, capturedAt: rows[0].capturedAt, rawJson: rows[0].rawJson };
  } else if (dayOffset > 0 && period === "today") {
    const rows = await db
      .select()
      .from(periodSnapshots)
      .where(and(eq(periodSnapshots.userId, user[0].id), eq(periodSnapshots.periodType, "daily")))
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
    : (ov.cacheHitPercent ?? ov.cacheHitPct ?? 0);

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
  const HEATMAP_MIN_WEEKS = 15;
  const HEATMAP_MAX_WEEKS = 26;
  const heatmapBase = new Date();
  const earliestDate = heatmapDailySource
    .map((r) => r.date)
    .filter((d): d is string => !!d)
    .sort()[0];
  const dataDays = earliestDate
    ? Math.floor((heatmapBase.getTime() - new Date(earliestDate).getTime()) / 86_400_000) + 1
    : 0;
  const targetWeeks = Math.max(
    HEATMAP_MIN_WEEKS,
    Math.min(HEATMAP_MAX_WEEKS, Math.ceil(dataDays / 7)),
  );
  const heatmapDays = targetWeeks * 7;
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
    .where(eq(dailyVisits.userId, user[0].id));
  const visitMap: Record<string, { count: number; dwell: number }> = {};
  for (const r of visitRows) visitMap[r.date] = { count: r.count, dwell: r.dwell };
  const visitEarliest = Object.keys(visitMap).sort()[0];
  const visitDataDays = visitEarliest
    ? Math.floor((heatmapBase.getTime() - new Date(visitEarliest).getTime()) / 86_400_000) + 1
    : 0;
  const visitWeeks = Math.max(
    HEATMAP_MIN_WEEKS,
    Math.min(HEATMAP_MAX_WEEKS, Math.ceil(visitDataDays / 7)),
  );
  const visitDays = visitWeeks * 7;
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

  // Apply ccusage-corrected cost to overview-derived metrics
  const finalCost = correctedTotalCost ?? cost;
  const finalCostPerCall = calls > 0 ? finalCost / calls : 0;

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

  return NextResponse.json({
    user: { name: user[0].name, lastSyncedAt: user[0].lastSyncedAt, timezone: user[0].timezone ?? null },
    overview: { cost: finalCost, sessions, calls, cacheHitPct, oneShotRate, activeDays, costPerCall: finalCostPerCall, outputInputRatio },
    daily,
    dailyTokens,
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
  });
}
