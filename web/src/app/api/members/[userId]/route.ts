import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, sessions, users, dailyAgg } from "@/lib/db";
import { eq, gte, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = parseInt(params.userId);
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const since = new Date();
  since.setDate(since.getDate() - 28);

  const userSessions = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gte(sessions.startedAt, since)));

  const daily = await db
    .select()
    .from(dailyAgg)
    .where(and(eq(dailyAgg.userId, userId), gte(dailyAgg.date, since.toISOString().slice(0, 10))));

  const totalTokens = userSessions.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0);
  const totalCost = userSessions.reduce((s, r) => s + r.costUsd, 0);
  const oneShotEdits = userSessions.reduce((s, r) => s + r.oneShotEdits, 0);
  const totalEdits = userSessions.reduce((s, r) => s + r.totalEdits, 0);
  const oneShotRate = totalEdits > 0 ? Math.round((oneShotEdits / totalEdits) * 100) : 0;

  // streak: consecutive days with activity
  const activeDates = new Set(daily.filter(d => d.sessionsCount > 0).map(d => d.date));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (activeDates.has(key)) streak++;
    else break;
  }

  // project breakdown
  const projectMap: Record<string, number> = {};
  for (const s of userSessions) {
    projectMap[s.project] = (projectMap[s.project] ?? 0) + s.inputTokens + s.outputTokens;
  }

  return NextResponse.json({
    user: { id: user[0].id, name: user[0].name, avatarUrl: user[0].avatarUrl },
    summary: { totalTokens, totalCost, oneShotRate, sessionsCount: userSessions.length },
    daily: daily.map(d => ({ date: d.date, tokens: d.totalTokens, cost: d.totalCost })),
    streak,
    projects: Object.entries(projectMap).sort(([, a], [, b]) => b - a).map(([name, tokens]) => ({ name, tokens })),
  });
}
