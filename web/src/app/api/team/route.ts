import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, userSnapshots, users } from "@/lib/db";
import { computeEfficiencyScore, generateMvpBlurb } from "@/lib/rules";

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
  oneShotRate?: number | null;
}

interface RawProject {
  name?: string;
  path?: string;
  cost?: number;
}

interface RawPeriodData {
  overview?: RawOverview;
  summary?: RawOverview;
  activities?: RawActivity[];
  projects?: RawProject[];
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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const period = (req.nextUrl.searchParams.get("period") ?? "all") as Period;

  const allUsers = await db.select().from(users);
  const allSnaps = await db.select().from(userSnapshots);

  const snapMap = new Map(allSnaps.map((s) => [s.userId, s]));

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

      if (period === "all") {
        totalCost = snap.totalCost;
        sessionsCount = snap.sessionsCount;
        overallOneShot = snap.overallOneShot;
        const d = getPeriodData(snap.rawJson, "all");
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
        const d = getPeriodData(snap.rawJson, period);
        const ov = d.overview ?? d.summary ?? {};
        totalCost = ov.cost ?? ov.totalCost ?? 0;
        sessionsCount = ov.sessions ?? ov.totalSessions ?? 0;
        cacheHitPct = ov.cacheHitPercent ?? ov.cacheHitPct ?? 0;
        overallOneShot = computeOneShotRate(d.activities ?? []);
        callsCount = ov.calls ?? 0;
        const tIn = ov.tokens?.input ?? 0;
        const tOut = ov.tokens?.output ?? 0;
        outputInputRatio = tIn > 0 ? tOut / tIn : 1;
        topProject = (d.projects ?? []).sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0]?.name ?? "unknown";
      }

      if (sessionsCount === 0) return null;

      const efficiencyScore = computeEfficiencyScore(overallOneShot, cacheHitPct, totalCost, sessionsCount, callsCount, outputInputRatio);

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
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  const byOneShotRate = [...memberStats].sort((a, b) => b.overallOneShot - a.overallOneShot);
  const byEfficiency = [...memberStats].sort((a, b) => b.efficiencyScore - a.efficiencyScore);
  const bySessions = [...memberStats].sort((a, b) => b.sessionsCount - a.sessionsCount);

  const mvpCandidate = byEfficiency[0] ?? null;
  const mvp = mvpCandidate
    ? {
        ...mvpCandidate,
        blurb: generateMvpBlurb(
          mvpCandidate.name,
          mvpCandidate.topProject,
          mvpCandidate.cacheHitPct,
          mvpCandidate.sessionsCount > 0 ? mvpCandidate.totalCost / mvpCandidate.sessionsCount : 0
        ),
      }
    : null;

  return NextResponse.json({ mvp, byOneShotRate, byEfficiency, bySessions });
}
