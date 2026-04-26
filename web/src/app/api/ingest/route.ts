import { NextRequest, NextResponse } from "next/server";
import { db, userSnapshots, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";

interface CodeburnActivity {
  name?: string;
  category?: string;
  sessions?: number;
  turns?: number;
  cost: number;
  oneShotRate: number | null; // 0-100 scale
}

interface CodeburnOverview {
  cost?: number;
  sessions?: number;
  calls?: number;
  cacheHitPercent?: number;
  // legacy field names
  totalCost?: number;
  totalSessions?: number;
  callsCount?: number;
  cacheHitPct?: number;
}

interface CodeburnReport {
  overview?: CodeburnOverview;
  summary?: CodeburnOverview; // legacy
  activities?: CodeburnActivity[];
  daily?: Array<{ date: string; cost: number; sessions: number }>;
  projects?: Array<{ name: string; cost: number; sessions?: number; calls?: number; path?: string; avgCost?: number }>;
  topSessions?: Array<{ sessionId?: string; id?: string; date: string; project: string; cost: number; calls?: number; turns?: number }>;
}

function computeOverallOneShot(activities: CodeburnActivity[]): number {
  const filtered = activities.filter((a) => a.oneShotRate != null);
  const totalWeight = filtered.reduce((s, a) => s + (a.turns ?? a.sessions ?? 1), 0);
  if (totalWeight === 0) return 0;
  // normalize from 0-100 to 0-1
  const weighted = filtered.reduce((s, a) => s + ((a.oneShotRate! / 100) * (a.turns ?? a.sessions ?? 1)), 0);
  return weighted / totalWeight;
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

  const overview = body.overview ?? body.summary ?? {};
  const activities = body.activities ?? [];

  const totalCost = overview.cost ?? overview.totalCost ?? 0;
  const sessionsCount = overview.sessions ?? overview.totalSessions ?? 0;
  const callsCount = overview.calls ?? overview.callsCount ?? 0;
  // cacheHitPercent is 0-100; legacy cacheHitPct may be 0-1 or 0-100
  const rawCacheHit = overview.cacheHitPercent ?? overview.cacheHitPct ?? 0;
  const cacheHitPct = rawCacheHit > 1 ? rawCacheHit : rawCacheHit * 100;
  const overallOneShot = computeOverallOneShot(activities); // 0-1 decimal

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
