import { NextRequest, NextResponse } from "next/server";
import { db, userSnapshots, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";

interface CodeburnActivity {
  name: string;
  sessions: number;
  cost: number;
  oneShotRate: number | null;
}

interface CodeburnReport {
  summary?: {
    totalCost?: number;
    totalSessions?: number;
    callsCount?: number;
    cacheHitPct?: number;
    avgTurns?: number;
  };
  activities?: CodeburnActivity[];
  daily?: Array<{ date: string; cost: number; sessions: number }>;
  projects?: Array<{ name: string; cost: number; sessions: number; avgCost: number }>;
  topSessions?: Array<{ id: string; date: string; project: string; cost: number; turns: number }>;
}

function computeOverallOneShot(activities: CodeburnActivity[]): number {
  const filtered = activities.filter((a) => a.oneShotRate !== null && a.sessions > 0);
  const totalSessions = filtered.reduce((s, a) => s + a.sessions, 0);
  if (totalSessions === 0) return 0;
  const weighted = filtered.reduce((s, a) => s + (a.oneShotRate! * a.sessions), 0);
  return weighted / totalSessions;
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await db
    .select()
    .from(users)
    .where(eq(users.apiKeyHash, crypto.createHash("sha256").update(apiKey).digest("hex")))
    .limit(1);

  if (!user[0]) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body: CodeburnReport = await req.json();

  const summary = body.summary ?? {};
  const activities = body.activities ?? [];

  const totalCost = summary.totalCost ?? 0;
  const sessionsCount = summary.totalSessions ?? 0;
  const callsCount = summary.callsCount ?? 0;
  const cacheHitPct = summary.cacheHitPct ?? 0;
  const overallOneShot = computeOverallOneShot(activities);

  await db
    .insert(userSnapshots)
    .values({
      userId: user[0].id,
      rawJson: body,
      totalCost,
      sessionsCount,
      callsCount,
      cacheHitPct,
      overallOneShot,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userSnapshots.userId],
      set: {
        rawJson: sql`excluded.raw_json`,
        totalCost: sql`excluded.total_cost`,
        sessionsCount: sql`excluded.sessions_count`,
        callsCount: sql`excluded.calls_count`,
        cacheHitPct: sql`excluded.cache_hit_pct`,
        overallOneShot: sql`excluded.overall_one_shot`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  await db
    .update(users)
    .set({ lastSyncedAt: new Date() })
    .where(eq(users.id, user[0].id));

  return NextResponse.json({ ok: true });
}
