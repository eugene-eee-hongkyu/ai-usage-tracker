import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, userSnapshots, users, dailyVisits, userBlocks } from "@/lib/db";
import { analyzePlanHealth, summarizeTeamPlans, type PlanTier } from "@/lib/plan-health";
import { computeEfficiencyScore, computeDailyEfficiencyScore } from "@/lib/rules";
import { isAdmin } from "@/lib/admin";
import { gte } from "drizzle-orm";

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
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

interface RawNameCalls { name?: string; calls?: number }

interface RawPeriodData {
  overview?: RawOverview;
  summary?: RawOverview;
  activities?: RawActivity[];
  projects?: RawProject[];
  topSessions?: RawTopSession[];
  daily?: Array<{ date: string; cost: number; sessions?: number; calls?: number }>;
  models?: RawModel[];
  tools?: RawNameCalls[];
  shellCommands?: RawNameCalls[];
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

function computeOneShotRate(activities: RawActivity[]): number {
  const withRate = activities.filter((a) => a.oneShotRate != null);
  const totalTurns = withRate.reduce((s, a) => s + (a.turns ?? a.sessions ?? 1), 0);
  const weighted = withRate.reduce(
    (s, a) => s + ((a.oneShotRate! / 100) * (a.turns ?? a.sessions ?? 1)),
    0
  );
  return totalTurns > 0 ? weighted / totalTurns : 0;
}

function computePrevCostPerSession(
  allDaily: Array<{ date: string; cost: number; sessions?: number }>,
  period: Period
): number | null {
  if (period === "all") return null;
  const n = period === "today" ? 1 : period === "8days" ? 8 : 30;
  const sorted = [...allDaily].sort((a, b) => b.date.localeCompare(a.date));
  const prev = sorted.slice(n, n * 2);
  const cost = prev.reduce((s, d) => s + d.cost, 0);
  const sessions = prev.reduce((s, d) => s + (d.sessions ?? 0), 0);
  return sessions > 0 ? cost / sessions : null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const period = (req.nextUrl.searchParams.get("period") ?? "all") as Period;

  const allUsers = await db.select().from(users);
  const allSnaps = await db.select().from(userSnapshots);

  const snapMap = new Map(allSnaps.map((s) => [s.userId, s]));

  // 이번 달 visit/dwell 집계 (UTC 기준 YYYY-MM-01 부터). engagement 카드의
  // monthVisits/avgDwellSec 표시용.
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;
  const visitsThisMonth = await db
    .select({
      userId: dailyVisits.userId,
      count: dailyVisits.count,
      dwell: dailyVisits.totalDwellSeconds,
    })
    .from(dailyVisits)
    .where(gte(dailyVisits.date, monthStart));
  const visitAgg = new Map<number, { count: number; dwell: number }>();
  for (const r of visitsThisMonth) {
    const cur = visitAgg.get(r.userId) ?? { count: 0, dwell: 0 };
    cur.count += r.count;
    cur.dwell += r.dwell;
    visitAgg.set(r.userId, cur);
  }

  // user_blocks 기반 멤버별 분당 토큰 집계. period 별 윈도우는 dashboard 와 동일.
  // today 면 빈 Map (효율성 테이블에 0 표시되거나 ─ 으로 표기).
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
        .select({
          userId: userBlocks.userId,
          minutes: userBlocks.minutes,
          totalTokens: userBlocks.totalTokens,
        })
        .from(userBlocks)
        .where(gte(userBlocks.startedAt, blocksWindowStart))
    : [];
  const blocksAgg = new Map<number, { totalMinutes: number; totalTokens: number; count: number }>();
  for (const r of blockRows) {
    const cur = blocksAgg.get(r.userId) ?? { totalMinutes: 0, totalTokens: 0, count: 0 };
    cur.totalMinutes += r.minutes;
    cur.totalTokens += Number(r.totalTokens ?? 0);
    cur.count += 1;
    blocksAgg.set(r.userId, cur);
  }

  // Accumulators for team-level aggregations
  const activityAgg = new Map<string, { totalCost: number; totalTurns: number; members: Set<number> }>();
  const dailyMemberMap = new Map<string, Record<string, number>>();
  const allTopSessions: Array<{ userId: number; userName: string; id: string; date: string; project: string; cost: number; calls: number }> = [];
  const modelAgg = new Map<string, { cost: number; calls: number; cacheRead: number; cacheWrite: number; input: number }>();
  const toolAgg = new Map<string, number>();
  const shellAgg = new Map<string, number>();

  const memberStats = allUsers
    .map((u) => {
      const snap = snapMap.get(u.id);
      if (!snap) return null;

      let totalCost: number;
      let sessionsCount: number;
      let cacheHitPct: number;
      let overallOneShot: number;
      let callsCount: number;
      let outputInputRatio: number;
      let topProject: string;

      const d = getPeriodData(snap.rawJson, period);
      const dAll = getPeriodData(snap.rawJson, "all");

      // Stale month/day check — codeburn에서 4월 데이터를 받은 멤버가 다른 멤버와
      // 함께 "이번달"로 집계되면 May와 April이 섞인다. 첫 daily 날짜가 현재
      // month/day와 다르면 그 멤버를 0으로 처리하고 활동 집계에서 제외.
      const firstDailyDate = (d.daily ?? [])[0]?.date;
      const nowUtc = new Date().toISOString();
      const currentMonthKey = nowUtc.slice(0, 7);   // "YYYY-MM"
      const currentDayKey = nowUtc.slice(0, 10);    // "YYYY-MM-DD"
      const isStale = (() => {
        if (!firstDailyDate) return false;
        if (period === "month") return !firstDailyDate.startsWith(currentMonthKey);
        if (period === "today") return firstDailyDate !== currentDayKey;
        return false;
      })();

      const ccusageMissing =
        (snap.rawJson as Record<string, unknown> | null)?.ccusageMissing === true;

      const v = visitAgg.get(u.id) ?? { count: 0, dwell: 0 };
      const monthVisits = v.count;
      const avgDwellSec = v.count > 0 ? Math.round(v.dwell / v.count) : 0;

      if (isStale) {
        return {
          userId: u.id,
          name: u.name,
          avatarUrl: u.avatarUrl,
          lastSyncedAt: u.lastSyncedAt?.toISOString() ?? null,
          totalCost: 0,
          totalTokens: 0,
          sessionsCount: 0,
          cacheHitPct: 0,
          overallOneShot: 0,
          efficiencyScore: 0,
          topProject: "",
          callsCount: 0,
          outputInputRatio: 0,
          prevCostPerSession: null,
          ccusageMissing,
          monthVisits,
          avgDwellSec,
          tokensPerMinute: null,
        };
      }

      // ccusage daily tokens — sum by dates that appear in this period's daily array
      const periodDates = new Set((d.daily ?? []).map((day) => day.date));
      const ccusageDaily =
        ((snap.rawJson as Record<string, unknown>).ccusageDaily as
          | { daily?: Array<{ date?: string; totalTokens?: number }> }
          | undefined)?.daily ?? [];
      const totalTokens = ccusageDaily
        .filter((row) => row.date && periodDates.has(row.date))
        .reduce((s, row) => s + (row.totalTokens ?? 0), 0);

      if (period === "all") {
        totalCost = snap.totalCost;
        sessionsCount = snap.sessionsCount;
        overallOneShot = snap.overallOneShot;
        const ov = d.overview ?? d.summary ?? {};
        callsCount = ov.calls ?? snap.callsCount;
        const tIn = ov.tokens?.input ?? 0;
        const tOut = ov.tokens?.output ?? 0;
        const tRead = ov.tokens?.cacheRead ?? 0;
        const tWrite = ov.tokens?.cacheWrite ?? 0;
        cacheHitPct = (tRead + tWrite + tIn) > 0
          ? (tRead / (tRead + tWrite + tIn)) * 100
          : snap.cacheHitPct;
        outputInputRatio = tIn > 0 ? tOut / tIn : 1;
        topProject = (d.projects ?? []).sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0]?.name ?? "unknown";
      } else {
        const ov = d.overview ?? d.summary ?? {};
        totalCost = ov.cost ?? ov.totalCost ?? 0;
        sessionsCount = ov.sessions ?? ov.totalSessions ?? 0;
        overallOneShot = computeOneShotRate(d.activities ?? []);
        callsCount = ov.calls ?? 0;
        const tIn = ov.tokens?.input ?? 0;
        const tOut = ov.tokens?.output ?? 0;
        const tRead = ov.tokens?.cacheRead ?? 0;
        const tWrite = ov.tokens?.cacheWrite ?? 0;
        cacheHitPct = (tRead + tWrite + tIn) > 0
          ? (tRead / (tRead + tWrite + tIn)) * 100
          : (ov.cacheHitPercent ?? ov.cacheHitPct ?? 0);
        outputInputRatio = tIn > 0 ? tOut / tIn : 1;
        topProject = (d.projects ?? []).sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0]?.name ?? "unknown";
      }

      // Trend: prev period $/session from all-time daily data
      const allDailyData = dAll.daily ?? [];
      const prevCostPerSession = computePrevCostPerSession(allDailyData, period);

      // Aggregate activities for team view
      for (const a of d.activities ?? []) {
        const name = a.name ?? a.category ?? "Unknown";
        const cost = a.cost ?? 0;
        const turns = a.turns ?? a.sessions ?? 0;
        if (!activityAgg.has(name)) {
          activityAgg.set(name, { totalCost: 0, totalTurns: 0, members: new Set() });
        }
        const entry = activityAgg.get(name)!;
        entry.totalCost += cost;
        entry.totalTurns += turns;
        entry.members.add(u.id);
      }

      // Aggregate daily by member — key by id to handle duplicate names
      const memberKey = `${u.name}__${u.id}`;
      for (const day of d.daily ?? []) {
        if (!dailyMemberMap.has(day.date)) {
          dailyMemberMap.set(day.date, {});
        }
        const existing = dailyMemberMap.get(day.date)!;
        existing[memberKey] = (existing[memberKey] ?? 0) + day.cost;
      }

      // Aggregate by model
      for (const m of d.models ?? []) {
        const name = m.name ?? "unknown";
        const entry = modelAgg.get(name) ?? { cost: 0, calls: 0, cacheRead: 0, cacheWrite: 0, input: 0 };
        entry.cost += m.cost ?? 0;
        entry.calls += m.calls ?? 0;
        entry.cacheRead += m.cacheReadTokens ?? 0;
        entry.cacheWrite += m.cacheWriteTokens ?? 0;
        entry.input += m.inputTokens ?? 0;
        modelAgg.set(name, entry);
      }

      // Aggregate tools and shell commands
      for (const t of d.tools ?? []) {
        if (t.name) toolAgg.set(t.name, (toolAgg.get(t.name) ?? 0) + (t.calls ?? 0));
      }
      for (const s of d.shellCommands ?? []) {
        if (s.name) shellAgg.set(s.name, (shellAgg.get(s.name) ?? 0) + (s.calls ?? 0));
      }

      const efficiencyScore = computeEfficiencyScore(overallOneShot, cacheHitPct, totalCost, sessionsCount, callsCount, outputInputRatio);

      for (const s of d.topSessions ?? []) {
        allTopSessions.push({
          userId: u.id,
          userName: u.name,
          id: s.id ?? s.sessionId ?? "",
          date: s.date ?? "",
          project: s.project ?? "",
          cost: s.cost ?? 0,
          calls: s.calls ?? s.turns ?? 0,
        });
      }

      const blocksOfUser = blocksAgg.get(u.id);
      const tokensPerMinute = blocksOfUser && blocksOfUser.totalMinutes > 0
        ? Math.round(blocksOfUser.totalTokens / blocksOfUser.totalMinutes)
        : null;

      // 사용량 (token volume) — 개인 EFFICIENCY 카드의 "사용량" 과 동일 정의.
      // period 내 활성일 = d.daily 중 cost > 0 인 날. totalTokens / activeDays.
      const memberActiveDays = (d.daily ?? []).filter((day) => (day.cost ?? 0) > 0).length;
      const avgDailyTokens = memberActiveDays > 0 ? totalTokens / memberActiveDays : 0;

      return {
        userId: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        lastSyncedAt: u.lastSyncedAt?.toISOString() ?? null,
        totalCost,
        sessionsCount,
        cacheHitPct,
        overallOneShot,
        efficiencyScore,
        topProject,
        callsCount,
        outputInputRatio,
        prevCostPerSession,
        totalTokens,
        avgDailyTokens,
        ccusageMissing,
        monthVisits,
        avgDwellSec,
        tokensPerMinute,
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  const byEfficiency = [...memberStats].sort((a, b) => b.efficiencyScore - a.efficiencyScore);

  // Team Plan Health — 멤버별 plan 적정성. 어드민만 UI 노출 (응답엔 항상 포함).
  // 30일 윈도우 user_blocks 별도 조회 (period 와 무관).
  const planBlocksWindowStart = new Date(Date.now() - 30 * 86_400_000);
  const planBlockRows = await db
    .select({
      userId: userBlocks.userId,
      totalTokens: userBlocks.totalTokens,
      startedAt: userBlocks.startedAt,
    })
    .from(userBlocks)
    .where(gte(userBlocks.startedAt, planBlocksWindowStart));
  const planBlocksByUser = new Map<number, Array<{ totalTokens: number; startedAt: Date }>>();
  for (const r of planBlockRows) {
    const arr = planBlocksByUser.get(r.userId) ?? [];
    arr.push({ totalTokens: Number(r.totalTokens ?? 0), startedAt: r.startedAt });
    planBlocksByUser.set(r.userId, arr);
  }
  const memberHealthList: Array<{ userId: number; name: string; health: ReturnType<typeof analyzePlanHealth> }> = [];
  for (const u of allUsers) {
    const snap = snapMap.get(u.id);
    const blocks = planBlocksByUser.get(u.id) ?? [];
    const health = analyzePlanHealth({
      blocks,
      declaredTier: (u.planTier ?? null) as PlanTier,
      cacheHitPct: snap?.cacheHitPct ?? undefined,
      oneShotRate: snap?.overallOneShot != null ? snap.overallOneShot * 100 : undefined,
      windowDays: 30,
    });
    memberHealthList.push({ userId: u.id, name: u.name, health });
  }
  const teamPlanHealth = summarizeTeamPlans(memberHealthList);

  const bySessions = [...memberStats].sort((a, b) => b.sessionsCount - a.sessionsCount);

  const teamSummary = {
    totalCost: memberStats.reduce((s, m) => s + m.totalCost, 0),
    totalSessions: memberStats.reduce((s, m) => s + m.sessionsCount, 0),
    activeMemberCount: memberStats.length,
    avgCacheHitPct: memberStats.length > 0
      ? memberStats.reduce((s, m) => s + m.cacheHitPct, 0) / memberStats.length
      : 0,
    avgOneShotRate: memberStats.length > 0
      ? memberStats.reduce((s, m) => s + m.overallOneShot, 0) / memberStats.length
      : 0,
  };

  // Team daily (sum across all members)
  const dailyMap = new Map<string, number>();
  for (const [date, memberCosts] of dailyMemberMap.entries()) {
    dailyMap.set(date, Object.values(memberCosts).reduce((s, v) => s + v, 0));
  }
  const daily = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cost]) => ({ date, cost }));

  // Team activities (top 10 by turns)
  // memberKeys are "name__userId" to handle duplicate display names
  const memberNames = byEfficiency.map((m) => `${m.name}__${m.userId}`);
  const teamActivities = [...activityAgg.entries()]
    .map(([name, { totalCost, totalTurns, members }]) => ({
      name,
      totalCost,
      totalTurns,
      memberCount: members.size,
    }))
    .sort((a, b) => b.totalTurns - a.totalTurns)
    .slice(0, 10);

  // Daily by member (for stacked area)
  const allDates = [...dailyMemberMap.keys()].sort();
  const dailyByMember = allDates.map((date) => {
    const row: Record<string, number | string> = { date };
    for (const name of memberNames) {
      row[name] = dailyMemberMap.get(date)?.[name] ?? 0;
    }
    return row;
  });

  const topSessions = allTopSessions
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 15);

  const teamModels = [...modelAgg.entries()]
    .map(([name, agg]) => {
      const denom = agg.input + agg.cacheRead + agg.cacheWrite;
      const cacheHitPct = denom > 0 ? (agg.cacheRead / denom) * 100 : 0;
      return { name, cost: agg.cost, calls: agg.calls, cacheHitPct };
    })
    .sort((a, b) => b.cost - a.cost);

  const teamTools = [...toolAgg.entries()]
    .map(([name, calls]) => ({ name, calls }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 10);

  const teamShellCommands = [...shellAgg.entries()]
    .map(([name, calls]) => ({ name, calls }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 10);

  // Industry comparison (최근 30일).
  // 외부 (Anthropic/엔터/ccusage) 와 비교할 우리 팀 통계:
  //  - active day cost: 각 (멤버, 활성일) 의 cost 분포 → avg, p50/75/90, max
  //  - per-dev monthly: 각 멤버의 최근 30일 합 → avg, max
  // 데이터 source: ccusage daily 우선, 없으면 codeburn all.daily (heatmap 과 동일).
  const today30 = new Date();
  const thirtyAgo = new Date(today30);
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const thirtyAgoYmd = thirtyAgo.toISOString().slice(0, 10);

  const teamActiveDayCosts: number[] = [];
  const perDevMonthly: number[] = [];
  for (const u of allUsers) {
    const snap = snapMap.get(u.id);
    if (!snap) continue;
    const raw = snap.rawJson as Record<string, unknown>;
    const ccusage = (raw.ccusageDaily as { daily?: Array<{ date?: string; totalCost?: number }> } | undefined)?.daily ?? [];
    const codeburn = ((raw.all as { daily?: Array<{ date?: string; cost?: number }> } | undefined)?.daily) ?? [];
    const source: Array<{ date?: string; totalCost?: number; cost?: number }> =
      ccusage.length > 0 ? ccusage : codeburn;
    let userMonthSum = 0;
    for (const row of source) {
      if (!row.date || row.date < thirtyAgoYmd) continue;
      const cost = row.totalCost ?? row.cost ?? 0;
      if (cost > 0) {
        teamActiveDayCosts.push(cost);
        userMonthSum += cost;
      }
    }
    if (userMonthSum > 0) perDevMonthly.push(userMonthSum);
  }
  teamActiveDayCosts.sort((a, b) => a - b);
  const pct = (arr: number[], p: number) =>
    arr.length === 0 ? 0 : arr[Math.floor((arr.length - 1) * p)];
  const sum = (arr: number[]) => arr.reduce((s, c) => s + c, 0);
  const industryComparison = {
    windowDays: 30,
    activeDayCount: teamActiveDayCosts.length,
    activeDayAvg: teamActiveDayCosts.length > 0
      ? sum(teamActiveDayCosts) / teamActiveDayCosts.length
      : 0,
    activeDayP50: pct(teamActiveDayCosts, 0.5),
    activeDayP75: pct(teamActiveDayCosts, 0.75),
    activeDayP90: pct(teamActiveDayCosts, 0.9),
    activeDayMax: teamActiveDayCosts.length > 0
      ? teamActiveDayCosts[teamActiveDayCosts.length - 1]
      : 0,
    perDevMonthAvg: perDevMonthly.length > 0
      ? sum(perDevMonthly) / perDevMonthly.length
      : 0,
    perDevMonthMax: perDevMonthly.length > 0 ? Math.max(...perDevMonthly) : 0,
  };

  // ─── 팀 효율 점수 (개인 점수 시스템과 동일 공식, 30일 풀링 집계) ───
  // 모든 멤버의 ccusage 토큰 + codeburn cost/calls/edit·oneShotTurns 를 합쳐
  // 단일 cache hit / cost-per-call / oneShotRate 산출 → computeDailyEfficiencyScore.
  // 개인 점수는 self-motivation, 팀 점수는 team identity. 같은 공식 다른 의미.
  let teamCacheRead = 0, teamCacheWrite = 0, teamInput = 0, teamOutput = 0;
  let teamCost30 = 0, teamCalls30 = 0;
  let teamEditTurns = 0, teamOneShotTurns = 0;
  const teamActiveMembers = new Set<number>();
  for (const u of allUsers) {
    const snap = snapMap.get(u.id);
    if (!snap) continue;
    const raw = snap.rawJson as Record<string, unknown>;
    const ccu = (raw.ccusageDaily as { daily?: Array<{ date?: string; inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheCreationTokens?: number }> } | undefined)?.daily ?? [];
    const cb = ((raw.all as { daily?: Array<{ date?: string; cost?: number; calls?: number; editTurns?: number; oneShotTurns?: number }> } | undefined)?.daily) ?? [];
    let userHadActivity = false;
    for (const r of ccu) {
      if (!r.date || r.date < thirtyAgoYmd) continue;
      teamCacheRead += r.cacheReadTokens ?? 0;
      teamCacheWrite += r.cacheCreationTokens ?? 0;
      teamInput += r.inputTokens ?? 0;
      teamOutput += r.outputTokens ?? 0;
      userHadActivity = true;
    }
    for (const r of cb) {
      if (!r.date || r.date < thirtyAgoYmd) continue;
      teamCost30 += r.cost ?? 0;
      teamCalls30 += r.calls ?? 0;
      teamEditTurns += r.editTurns ?? 0;
      teamOneShotTurns += r.oneShotTurns ?? 0;
    }
    if (userHadActivity) teamActiveMembers.add(u.id);
  }
  const teamCacheDenom = teamCacheRead + teamCacheWrite + teamInput;
  const teamCacheHitPct = teamCacheDenom > 0 ? (teamCacheRead / teamCacheDenom) * 100 : 0;
  const teamCostPerCall = teamCalls30 > 0 ? teamCost30 / teamCalls30 : 0;
  // codeburn 0.9.7 ↓ 또는 모든 멤버가 chat-only → null. computeDailyEfficiencyScore
  // 가 cache 85 + cost 15 fallback 으로 자동 처리.
  const teamOneShotRate = teamEditTurns > 0 ? (teamOneShotTurns / teamEditTurns) * 100 : null;
  // 팀 토큰 평균 — 활성 멤버당 일평균 (활성 멤버 × 30일 윈도우 기준).
  // 개인 점수와 동일 scale 로 비교 가능. 0 = 팀 전체 안 씀, 10/10 = 평균 멤버가 heavy day.
  const teamTokensTotal = teamCacheRead + teamCacheWrite + teamInput + teamOutput;
  const teamAvgDailyTokens = teamActiveMembers.size > 0
    ? teamTokensTotal / (teamActiveMembers.size * 30)
    : 0;
  const teamScoreValue = teamCacheDenom > 0
    ? computeDailyEfficiencyScore(teamCacheHitPct, teamCostPerCall, teamOneShotRate, teamAvgDailyTokens)
    : null;

  const teamScore = {
    score: teamScoreValue,
    cacheHitPct: teamCacheHitPct,
    costPerCall: teamCostPerCall,
    memberCount: byEfficiency.length,
    windowDays: 30,
  };

  return NextResponse.json({
    byEfficiency,
    bySessions,
    teamSummary,
    daily,
    teamActivities,
    dailyByMember,
    memberNames,
    topSessions,
    teamModels,
    teamTools,
    teamShellCommands,
    industryComparison,
    teamScore,
    teamPlanHealth,
    isAdminUser: isAdmin(session.user.email),
  });
}
