import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, userSnapshots, users } from "@/lib/db";
import { eq } from "drizzle-orm";

type Period = "today" | "week" | "month" | "all";

function sinceDate(period: Period): string {
  const now = new Date();
  if (period === "today") {
    return now.toISOString().slice(0, 10);
  }
  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  }
  if (period === "month") {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  }
  return "2000-01-01";
}

interface DailyRow { date: string; cost: number; sessions: number; calls?: number }
interface Activity { name: string; sessions: number; cost: number; oneShotRate: number | null }
interface Project { name: string; cost: number; sessions: number; avgCost: number }
interface TopSession { id: string; date: string; project: string; cost: number; turns: number }

interface RawJson {
  summary?: {
    totalCost?: number;
    totalSessions?: number;
    callsCount?: number;
    cacheHitPct?: number;
    avgTurns?: number;
  };
  daily?: DailyRow[];
  activities?: Activity[];
  projects?: Project[];
  topSessions?: TopSession[];
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

  const snap = await db
    .select()
    .from(userSnapshots)
    .where(eq(userSnapshots.userId, user[0].id))
    .limit(1);

  if (!snap[0]) {
    return NextResponse.json({
      user: { name: user[0].name, email: user[0].email, avatarUrl: user[0].avatarUrl, lastSyncedAt: user[0].lastSyncedAt },
      summary: null,
      daily: [],
      activities: [],
      projects: [],
      topSessions: [],
    });
  }

  const raw = snap[0].rawJson as RawJson;
  const allDaily: DailyRow[] = raw.daily ?? [];
  const activities: Activity[] = (raw.activities ?? []).filter((a) => a.oneShotRate !== null);
  const projects: Project[] = (raw.projects ?? []).map((p) => ({
    name: p.name ?? "",
    cost: p.cost ?? 0,
    sessions: p.sessions ?? 0,
    avgCost: p.avgCost ?? 0,
  }));
  const topSessions: TopSession[] = (raw.topSessions ?? []).map((s) => ({
    id: s.id ?? "",
    date: s.date ?? "",
    project: s.project ?? "",
    cost: s.cost ?? 0,
    turns: s.turns ?? 0,
  }));
  const summary = raw.summary ?? {};

  const filteredDaily = period === "all"
    ? allDaily
    : allDaily.filter((d) => d.date >= since);

  const periodCost = filteredDaily.reduce((s, d) => s + (d.cost ?? 0), 0);
  const periodSessions = filteredDaily.reduce((s, d) => s + (d.sessions ?? 0), 0);
  const activeDays = filteredDaily.filter((d) => d.cost > 0).length;

  return NextResponse.json({
    user: { name: user[0].name, email: user[0].email, avatarUrl: user[0].avatarUrl, lastSyncedAt: user[0].lastSyncedAt },
    summary: {
      totalCost: periodCost,
      sessionsCount: periodSessions,
      activeDays,
      // all-time metrics from snapshot
      cacheHitPct: snap[0].cacheHitPct,
      overallOneShot: snap[0].overallOneShot,
      avgTurns: summary.avgTurns ?? 0,
      allTimeCost: snap[0].totalCost,
      allTimeSessions: snap[0].sessionsCount,
    },
    daily: filteredDaily,
    activities,
    projects,
    topSessions,
  });
}
