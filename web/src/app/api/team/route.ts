import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, sessions, users } from "@/lib/db";
import { gte } from "drizzle-orm";
import { computeTodayMvpScore, generateMvpBlurb } from "@/lib/rules";

type Period = "today" | "week" | "month" | "all";

function sinceDate(period: Period): Date {
  const now = new Date();
  if (period === "today") return new Date(now.toDateString());
  if (period === "week") { const d = new Date(now); d.setDate(d.getDate() - 6); return d; }
  if (period === "month") { const d = new Date(now); d.setDate(d.getDate() - 29); return d; }
  return new Date("2000-01-01");
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const period = (req.nextUrl.searchParams.get("period") ?? "week") as Period;
  const since = sinceDate(period);

  const allUsers = await db.select().from(users);
  const allSessions = await db
    .select()
    .from(sessions)
    .where(gte(sessions.startedAt, since));

  const memberStats = allUsers.map((u) => {
    const userSessions = allSessions.filter((s) => s.userId === u.id);
    const totalTokens = userSessions.reduce((acc, s) => acc + s.inputTokens + s.outputTokens, 0);
    const totalCost = userSessions.reduce((acc, s) => acc + s.costUsd, 0);
    const oneShotEdits = userSessions.reduce((acc, s) => acc + s.oneShotEdits, 0);
    const totalEdits = userSessions.reduce((acc, s) => acc + s.totalEdits, 0);
    const oneShotRate = totalEdits > 0 ? Math.round((oneShotEdits / totalEdits) * 100) : 0;
    const mvpScore = computeTodayMvpScore(totalTokens, oneShotRate);
    const topProject = Object.entries(
      userSessions.reduce((acc, s) => {
        acc[s.project] = (acc[s.project] ?? 0) + s.inputTokens + s.outputTokens;
        return acc;
      }, {} as Record<string, number>)
    ).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "unknown";

    return { userId: u.id, name: u.name, avatarUrl: u.avatarUrl, totalTokens, totalCost, oneShotRate, mvpScore, topProject, sessionsCount: userSessions.length };
  });

  const byTokens = [...memberStats].sort((a, b) => b.totalTokens - a.totalTokens);
  const byEfficiency = [...memberStats].sort((a, b) => b.oneShotRate - a.oneShotRate);
  const mvpCandidate = [...memberStats].sort((a, b) => b.mvpScore - a.mvpScore)[0];

  const mvp = mvpCandidate
    ? {
        ...mvpCandidate,
        blurb: generateMvpBlurb(mvpCandidate.name, mvpCandidate.topProject, mvpCandidate.oneShotRate),
      }
    : null;

  // project leaderboard
  const projectStats: Record<string, Array<{ userId: number; name: string; tokens: number }>> = {};
  for (const s of allSessions) {
    if (!projectStats[s.project]) projectStats[s.project] = [];
    const u = allUsers.find((u) => u.id === s.userId);
    if (!u) continue;
    const existing = projectStats[s.project].find((p) => p.userId === s.userId);
    if (existing) existing.tokens += s.inputTokens + s.outputTokens;
    else projectStats[s.project].push({ userId: s.userId, name: u.name, tokens: s.inputTokens + s.outputTokens });
  }
  for (const k of Object.keys(projectStats)) {
    projectStats[k].sort((a, b) => b.tokens - a.tokens);
  }

  return NextResponse.json({ mvp, byTokens, byEfficiency, projects: projectStats });
}
