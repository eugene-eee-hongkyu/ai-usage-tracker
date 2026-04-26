import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, userSnapshots, users } from "@/lib/db";
import { eq } from "drizzle-orm";

interface DailyRow { date: string; cost: number; sessions: number }
interface ProjectRow { name: string; cost: number; sessions: number; avgCost: number }

interface RawJson {
  summary?: { totalCost?: number; totalSessions?: number; cacheHitPct?: number };
  daily?: DailyRow[];
  projects?: ProjectRow[];
}

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

  const snap = await db
    .select()
    .from(userSnapshots)
    .where(eq(userSnapshots.userId, userId))
    .limit(1);

  if (!snap[0]) {
    return NextResponse.json({
      user: { id: user[0].id, name: user[0].name, avatarUrl: user[0].avatarUrl },
      summary: { totalCost: 0, sessionsCount: 0, cacheHitPct: 0 },
      daily: [],
      streak: 0,
      projects: [],
    });
  }

  const raw = snap[0].rawJson as RawJson;
  const allDaily: DailyRow[] = raw.daily ?? [];
  const projects: ProjectRow[] = (raw.projects ?? []).map((p) => ({
    name: p.name ?? "",
    cost: p.cost ?? 0,
    sessions: p.sessions ?? 0,
    avgCost: p.avgCost ?? 0,
  }));

  // 4 weeks of daily for heatmap
  const since = new Date();
  since.setDate(since.getDate() - 27);
  const sinceStr = since.toISOString().slice(0, 10);
  const recentDaily = allDaily.filter((d) => d.date >= sinceStr);

  // streak: consecutive days with activity from today backward
  const activeDateSet = new Set(allDaily.filter((d) => d.cost > 0).map((d) => d.date));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (activeDateSet.has(key)) streak++;
    else break;
  }

  return NextResponse.json({
    user: { id: user[0].id, name: user[0].name, avatarUrl: user[0].avatarUrl },
    summary: {
      totalCost: snap[0].totalCost,
      sessionsCount: snap[0].sessionsCount,
      cacheHitPct: snap[0].cacheHitPct,
    },
    daily: recentDaily.map((d) => ({ date: d.date, cost: d.cost, sessions: d.sessions })),
    streak,
    projects: projects.sort((a, b) => b.cost - a.cost).slice(0, 10),
  });
}
