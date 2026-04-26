import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, userSnapshots, users } from "@/lib/db";
import { computeEfficiencyScore, generateMvpBlurb } from "@/lib/rules";

export async function GET(req: NextRequest) {
  void req;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const allUsers = await db.select().from(users);
  const allSnaps = await db.select().from(userSnapshots);

  const snapMap = new Map(allSnaps.map((s) => [s.userId, s]));

  const memberStats = allUsers
    .map((u) => {
      const snap = snapMap.get(u.id);
      if (!snap) return null;

      const totalCost = snap.totalCost;
      const sessionsCount = snap.sessionsCount;
      const cacheHitPct = snap.cacheHitPct;
      const overallOneShot = snap.overallOneShot;
      const efficiencyScore = computeEfficiencyScore(overallOneShot, cacheHitPct, totalCost, sessionsCount);

      const raw = snap.rawJson as { projects?: Array<{ name: string; cost: number; sessions: number }> };
      const topProject = (raw.projects ?? []).sort((a, b) => b.cost - a.cost)[0]?.name ?? "unknown";

      return {
        userId: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
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
