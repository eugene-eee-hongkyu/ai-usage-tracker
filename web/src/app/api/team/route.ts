import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, userSnapshots, users } from "@/lib/db";
import { computeEfficiencyScore } from "@/lib/rules";

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

interface RawPeriodData {
  overview?: RawOverview;
  summary?: RawOverview;
  activities?: RawActivity[];
  projects?: RawProject[];
  topSessions?: RawTopSession[];
  daily?: Array<{ date: string; cost: number; sessions?: number }>;
}

function getPeriodData(raw: unknown, period: string): RawPeriodData {
  if (typeof raw !== "object" || raw === null) return {};
  const r = raw as Record<string, unknown>;
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
  const n = period === "today" ? 1 : period === "week" ? 7 : 30;
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

  // Accumulators for team-level aggregations
  const activityAgg = new Map<string, { totalCost: number; totalTurns: number; members: Set<number> }>();
  const dailyMemberMap = new Map<string, Record<string, number>>();
  const allTopSessions: Array<{ userId: number; userName: string; id: string; date: string; project: string; cost: number; calls: number }> = [];

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

      if (sessionsCount === 0) return null;

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
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  const byEfficiency = [...memberStats].sort((a, b) => b.efficiencyScore - a.efficiencyScore);
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

  return NextResponse.json({
    byEfficiency,
    bySessions,
    teamSummary,
    daily,
    teamActivities,
    dailyByMember,
    memberNames,
    topSessions,
  });
}
