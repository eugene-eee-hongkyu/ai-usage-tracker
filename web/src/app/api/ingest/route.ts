import { NextRequest, NextResponse } from "next/server";
import { db, userSnapshots, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";

interface CodeburnActivity {
  name?: string;
  category?: string;
  sessions?: number;
  turns?: number;
  cost?: number;
  oneShotRate?: number | null;
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

interface CodeburnPeriodReport {
  overview?: CodeburnOverview;
  summary?: CodeburnOverview;
  activities?: CodeburnActivity[];
}

function getBaseReport(body: unknown): CodeburnPeriodReport {
  if (typeof body !== "object" || body === null) return {};
  const b = body as Record<string, unknown>;
  // Multi-period format: { today: {...}, week: {...}, month: {...}, all: {...} }
  if ("all" in b || "today" in b) {
    return (b.all ?? Object.values(b)[0] ?? {}) as CodeburnPeriodReport;
  }
  return body as CodeburnPeriodReport;
}

function computeOverallOneShot(activities: CodeburnActivity[]): number {
  const filtered = activities.filter((a) => a.oneShotRate != null);
  const totalWeight = filtered.reduce((s, a) => s + (a.turns ?? a.sessions ?? 1), 0);
  if (totalWeight === 0) return 0;
  const weighted = filtered.reduce(
    (s, a) => s + ((a.oneShotRate! / 100) * (a.turns ?? a.sessions ?? 1)),
    0
  );
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

  const body = await req.json();
  const base = getBaseReport(body);
  const ov = base.overview ?? base.summary ?? {};
  const activities = base.activities ?? [];

  const totalCost = ov.cost ?? ov.totalCost ?? 0;
  const sessionsCount = ov.sessions ?? ov.totalSessions ?? 0;
  const callsCount = ov.calls ?? ov.callsCount ?? 0;
  const rawCacheHit = ov.cacheHitPercent ?? ov.cacheHitPct ?? 0;
  const cacheHitPct = rawCacheHit > 1 ? rawCacheHit : rawCacheHit * 100;
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
