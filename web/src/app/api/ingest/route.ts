import { NextRequest, NextResponse } from "next/server";
import { db, sessions, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";

function hashSessionId(id: string) {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
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
  const sessionList: Array<{
    sessionId?: string;
    sessionIdHash?: string;
    project: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheRead: number;
    cacheWrite: number;
    costUsd: number;
    oneShotEdits: number;
    totalEdits: number;
    startedAt: string;
    endedAt: string;
  }> = Array.isArray(body) ? body : body.sessions ?? [];

  let inserted = 0;
  for (const s of sessionList) {
    const hash = s.sessionIdHash ?? hashSessionId(s.sessionId ?? `${s.startedAt}-${s.model}`);
    try {
      const rows = await db
        .insert(sessions)
        .values({
          userId: user[0].id,
          sessionIdHash: hash,
          project: s.project ?? "unknown",
          model: s.model,
          inputTokens: s.inputTokens ?? 0,
          outputTokens: s.outputTokens ?? 0,
          cacheRead: s.cacheRead ?? 0,
          cacheWrite: s.cacheWrite ?? 0,
          costUsd: s.costUsd ?? 0,
          oneShotEdits: s.oneShotEdits ?? 0,
          totalEdits: s.totalEdits ?? 0,
          startedAt: new Date(s.startedAt),
          endedAt: new Date(s.endedAt),
        })
        .onConflictDoUpdate({
          target: [sessions.userId, sessions.sessionIdHash],
          set: {
            inputTokens: sql`excluded.input_tokens`,
            outputTokens: sql`excluded.output_tokens`,
            cacheRead: sql`excluded.cache_read`,
            cacheWrite: sql`excluded.cache_write`,
            costUsd: sql`excluded.cost_usd`,
            endedAt: sql`excluded.ended_at`,
          },
        })
        .returning({ id: sessions.id });
      if (rows.length > 0) inserted++;
    } catch {
      // skip on unexpected error
    }
  }

  // update last_synced_at
  await db
    .update(users)
    .set({ lastSyncedAt: new Date() })
    .where(eq(users.id, user[0].id));

  // refresh daily_agg for affected dates
  const dates = Array.from(new Set(sessionList.map((s) => s.startedAt.slice(0, 10))));
  for (const d of dates) {
    await db.execute(sql`
      INSERT INTO daily_agg (user_id, date, total_tokens, total_cost, sessions_count, one_shot_edits, total_edits, cache_read, cache_write)
      SELECT
        user_id,
        DATE(started_at) as date,
        SUM(input_tokens + output_tokens) as total_tokens,
        SUM(cost_usd) as total_cost,
        COUNT(*) as sessions_count,
        SUM(one_shot_edits) as one_shot_edits,
        SUM(total_edits) as total_edits,
        SUM(cache_read) as cache_read,
        SUM(cache_write) as cache_write
      FROM sessions
      WHERE user_id = ${user[0].id} AND DATE(started_at) = ${d}
      GROUP BY user_id, DATE(started_at)
      ON CONFLICT (user_id, date) DO UPDATE SET
        total_tokens = EXCLUDED.total_tokens,
        total_cost = EXCLUDED.total_cost,
        sessions_count = EXCLUDED.sessions_count,
        one_shot_edits = EXCLUDED.one_shot_edits,
        total_edits = EXCLUDED.total_edits,
        cache_read = EXCLUDED.cache_read,
        cache_write = EXCLUDED.cache_write
    `);
  }

  return NextResponse.json({ ok: true, inserted });
}
