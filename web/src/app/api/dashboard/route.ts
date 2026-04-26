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

interface DailyRow { date: string; cost: number; sessions: number }
interface Activity { name: string; sessions: number; cost: number; oneShotRate: number | null }
interface Project { name: string; cost: number; sessions: number; avgCost: number }
interface TopSession { id: string; date: string; project: string; cost: number; turns: number }

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
  turns?: number;
  calls?: number;
}

interface RawJson {
  overview?: { avgTurns?: number };
  summary?: { avgTurns?: number };
  daily?: DailyRow[];
  activities?: RawActivity[];
  projects?: RawProject[];
  topSessions?: RawTopSession[];
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

  const activities: Activity[] = (raw.activities ?? [])
    .filter((a) => a.oneShotRate != null)
    .map((a) => ({
      name: a.name ?? a.category ?? "Unknown",
      sessions: a.sessions ?? a.turns ?? 0,
      cost: a.cost ?? 0,
      // normalize 0-100 → 0-1 if value > 1
      oneShotRate: a.oneShotRate != null
        ? (a.oneShotRate > 1 ? a.oneShotRate / 100 : a.oneShotRate)
        : null,
    }));

  const projects: Project[] = (raw.projects ?? []).map((p) => {
    const cost = p.cost ?? 0;
    const sessions = p.sessions ?? p.calls ?? 0;
    return {
      name: p.name ?? "",
      cost,
      sessions,
      avgCost: p.avgCost ?? (sessions > 0 ? cost / sessions : 0),
    };
  });

  const topSessions: TopSession[] = (raw.topSessions ?? []).map((s) => ({
    id: s.id ?? s.sessionId ?? "",
    date: s.date ?? "",
    project: s.project ?? "",
    cost: s.cost ?? 0,
    turns: s.turns ?? s.calls ?? 0,
  }));

  const overview = raw.overview ?? raw.summary ?? {};

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
      cacheHitPct: snap[0].cacheHitPct,
      overallOneShot: snap[0].overallOneShot,
      avgTurns: overview.avgTurns ?? 0,
      allTimeCost: snap[0].totalCost,
      allTimeSessions: snap[0].sessionsCount,
    },
    daily: filteredDaily,
    activities,
    projects,
    topSessions,
  });
}
