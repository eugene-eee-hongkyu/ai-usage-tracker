import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, userSnapshots, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/admin";

interface DailyRow { date: string; cost: number; sessions: number }
interface ProjectRow { name: string; cost: number; sessions: number; avgCost: number }

interface RawProject {
  name?: string;
  cost?: number;
  sessions?: number;
  calls?: number;
  avgCost?: number;
}

interface RawOverview {
  cacheHitPercent?: number;
  cacheHitPct?: number;
  tokens?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
}

interface RawPeriodBlock {
  overview?: RawOverview;
  summary?: RawOverview;
  daily?: DailyRow[];
  projects?: RawProject[];
}

interface RawJson {
  all?: RawPeriodBlock;
  overview?: RawOverview;
  summary?: RawOverview;
  daily?: DailyRow[];
  projects?: RawProject[];
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
  const block: RawPeriodBlock = raw.all ?? raw;
  const allDaily: DailyRow[] = block.daily ?? [];
  const projects: ProjectRow[] = (block.projects ?? []).map((p) => {
    const cost = p.cost ?? 0;
    const sessions = p.sessions ?? p.calls ?? 0;
    return {
      name: p.name ?? "",
      cost,
      sessions,
      avgCost: p.avgCost ?? (sessions > 0 ? cost / sessions : 0),
    };
  });

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

  const ov = block.overview ?? block.summary ?? {};
  const tRead = ov.tokens?.cacheRead ?? 0;
  const tWrite = ov.tokens?.cacheWrite ?? 0;
  const tInput = ov.tokens?.input ?? 0;
  const cacheHitPct = (tRead + tWrite + tInput) > 0
    ? (tRead / (tRead + tWrite + tInput)) * 100
    : (ov.cacheHitPercent ?? ov.cacheHitPct ?? snap[0].cacheHitPct ?? 0);

  return NextResponse.json({
    user: { id: user[0].id, name: user[0].name, avatarUrl: user[0].avatarUrl },
    summary: {
      totalCost: snap[0].totalCost,
      sessionsCount: snap[0].sessionsCount,
      cacheHitPct,
    },
    daily: recentDaily.map((d) => ({ date: d.date, cost: d.cost, sessions: d.sessions })),
    streak,
    projects: projects.sort((a, b) => b.cost - a.cost).slice(0, 10),
    canViewFullDashboard: isAdmin(session.user.email!),
  });
}
