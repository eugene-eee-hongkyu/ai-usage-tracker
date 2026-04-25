import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, sessions, dailyAgg, users } from "@/lib/db";
import { eq, gte, sql, and, asc } from "drizzle-orm";
import { generateSuggestions } from "@/lib/rules";

type Period = "today" | "week" | "month" | "all";

function sinceDate(period: Period): Date {
  const now = new Date();
  if (period === "today") return new Date(now.toDateString());
  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return d;
  }
  if (period === "month") {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    return d;
  }
  return new Date("2000-01-01");
}

// Local YYYY-MM-DD string (avoids UTC shift when comparing daily_agg.date strings)
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const period = (req.nextUrl.searchParams.get("period") ?? "week") as Period;
  const since = sinceDate(period);

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);
  if (!user[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const userId = user[0].id;

  // daily chart — use same period as summary
  const chartSince = sinceDate(period);
  const dailyRows = await db
    .select()
    .from(dailyAgg)
    .where(and(eq(dailyAgg.userId, userId), gte(dailyAgg.date, localDateStr(chartSince))))
    .orderBy(asc(dailyAgg.date));

  // aggregate for period
  const periodSessions = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gte(sessions.startedAt, since)));

  const totalTokens = periodSessions.reduce(
    (s, r) => s + r.inputTokens + r.outputTokens + r.cacheRead + r.cacheWrite,
    0
  );
  const inputTokens = periodSessions.reduce((s, r) => s + r.inputTokens, 0);
  const outputTokens = periodSessions.reduce((s, r) => s + r.outputTokens, 0);
  const totalCost = periodSessions.reduce((s, r) => s + r.costUsd, 0);
  const cacheRead = periodSessions.reduce((s, r) => s + r.cacheRead, 0);
  const cacheWrite = periodSessions.reduce((s, r) => s + r.cacheWrite, 0);
  const oneShotEdits = periodSessions.reduce((s, r) => s + r.oneShotEdits, 0);
  const totalEdits = periodSessions.reduce((s, r) => s + r.totalEdits, 0);
  const oneShotRate = totalEdits > 0 ? Math.round((oneShotEdits / totalEdits) * 100) : 0;
  const cacheHitRate =
    cacheRead + cacheWrite > 0
      ? Math.round((cacheRead / (cacheRead + cacheWrite)) * 100)
      : 0;

  // model breakdown
  const modelMap: Record<string, { tokens: number; cost: number }> = {};
  for (const s of periodSessions) {
    const key = s.model.toLowerCase().includes("opus")
      ? "Opus"
      : s.model.toLowerCase().includes("haiku")
      ? "Haiku"
      : "Sonnet";
    if (!modelMap[key]) modelMap[key] = { tokens: 0, cost: 0 };
    modelMap[key].tokens += s.inputTokens + s.outputTokens + s.cacheRead + s.cacheWrite;
    modelMap[key].cost += s.costUsd;
  }

  // project breakdown
  const projectMap: Record<string, { tokens: number; cost: number; oneShotEdits: number; totalEdits: number }> = {};
  for (const s of periodSessions) {
    if (!projectMap[s.project]) projectMap[s.project] = { tokens: 0, cost: 0, oneShotEdits: 0, totalEdits: 0 };
    projectMap[s.project].tokens += s.inputTokens + s.outputTokens;
    projectMap[s.project].cost += s.costUsd;
    projectMap[s.project].oneShotEdits += s.oneShotEdits;
    projectMap[s.project].totalEdits += s.totalEdits;
  }

  const suggestions = generateSuggestions({
    totalTokens,
    totalCost,
    sessionsCount: periodSessions.length,
    oneShotEdits,
    totalEdits,
    cacheRead,
    cacheWrite,
    opusTokens: modelMap["Opus"]?.tokens ?? 0,
    sonnetTokens: modelMap["Sonnet"]?.tokens ?? 0,
    haikuTokens: modelMap["Haiku"]?.tokens ?? 0,
    avgRetries: 0,
    activeHours: 0,
  });

  // Platform averages for comparison.
  // Real-time aggregation — fine for ≤100 users.
  // For scale (1k+ users), move to a pre-aggregated daily table updated by cron.
  const allPeriodSessions = await db
    .select({ userId: sessions.userId, costUsd: sessions.costUsd, cacheRead: sessions.cacheRead, startedAt: sessions.startedAt })
    .from(sessions)
    .where(gte(sessions.startedAt, since));

  const pMap: Record<number, { cost: number; days: Set<string>; cacheRead: number }> = {};
  for (const s of allPeriodSessions) {
    if (!pMap[s.userId]) pMap[s.userId] = { cost: 0, days: new Set(), cacheRead: 0 };
    pMap[s.userId].cost += s.costUsd;
    pMap[s.userId].days.add(new Date(s.startedAt).toISOString().slice(0, 10));
    pMap[s.userId].cacheRead += s.cacheRead;
  }
  const pEntries = Object.values(pMap);
  const platformUserCount = pEntries.length;
  const platformAvgDailyCost = platformUserCount > 0
    ? pEntries.reduce((sum, u) => sum + u.cost / Math.max(u.days.size, 1), 0) / platformUserCount
    : 0;
  const platformAvgCacheSaving = platformUserCount > 0
    ? pEntries.reduce((sum, u) => sum + (u.cacheRead / 1_000_000) * 2.70, 0) / platformUserCount
    : 0;

  return NextResponse.json({
    user: { name: user[0].name, email: user[0].email, avatarUrl: user[0].avatarUrl, lastSyncedAt: user[0].lastSyncedAt },
    summary: { totalTokens, inputTokens, outputTokens, totalCost, oneShotRate, cacheHitRate, sessionsCount: periodSessions.length, totalEdits, cacheRead },
    platformAvg: { userCount: platformUserCount, dailyCost: platformAvgDailyCost, cacheSavingUsd: platformAvgCacheSaving },
    daily: dailyRows,
    models: modelMap,
    projects: projectMap,
    suggestions,
  });
}
