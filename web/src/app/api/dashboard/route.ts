import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, userSnapshots, users, periodSnapshots } from "@/lib/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { isAdmin } from "@/lib/admin";

type Period = "today" | "week" | "month" | "all";

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
  daily?: Array<{ date: string; cost: number; sessions: number }>;
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
  if ("all" in r || "today" in r) {
    return (r[period] ?? r.all ?? {}) as RawPeriodData;
  }
  return r as RawPeriodData;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const period = (req.nextUrl.searchParams.get("period") ?? "week") as Period;
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
  if (weekOffset > 0 && period === "week") {
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

  return NextResponse.json({
    user: { name: user[0].name, lastSyncedAt: user[0].lastSyncedAt, timezone: user[0].timezone ?? null },
    overview: { cost: finalCost, sessions, calls, cacheHitPct, oneShotRate, activeDays, costPerCall: finalCostPerCall, outputInputRatio },
    daily,
    dailyTokens,
    activities,
    projects,
    topSessions,
    models,
    tools: toNameCalls(d.tools ?? []),
    shellCommands: toNameCalls(d.shellCommands ?? []),
    mcpServers: toNameCalls(d.mcpServers ?? []),
    availableSnapshots,
    snapshot: snapshotInfo,
  });
}
