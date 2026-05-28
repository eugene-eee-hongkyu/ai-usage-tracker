// GET /api/platform-admin/all-personal — Personal 사용자 목록 (어드민용).
// 검색 (?q=이름/이메일) + ranking_hidden 토글 (PATCH).
// 랭킹 어드민 뷰: 마스킹 없는 실명 + 30일 주요 지표.

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { db, users } from "@/lib/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { getCcusageDaily } from "@/lib/ccusage-row";
import { computePowerIndex } from "@/lib/rules";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdmin(session.user.email))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

  const rows = await db.execute(sql`
    SELECT DISTINCT ON (us.user_id)
      us.user_id, u.name, u.email, u.personal, u.ranking_hidden,
      u.created_at, u.last_synced_at, us.raw_json
    FROM users u
    LEFT JOIN user_snapshots us ON us.user_id = u.id
    WHERE u.personal = true
      AND u.deleted_at IS NULL
      AND u.suspended_at IS NULL
    ORDER BY us.user_id, us.updated_at DESC NULLS LAST
  `);

  const thirtyAgo = new Date();
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const thirtyAgoYmd = thirtyAgo.toISOString().slice(0, 10);

  const result = [];
  for (const row of rows.rows as Array<Record<string, unknown>>) {
    const userId = row.user_id as number;
    const name = (row.name as string) ?? "";
    const email = (row.email as string) ?? "";
    const rankingHidden = row.ranking_hidden as boolean;
    const createdAt = row.created_at as string | null;
    const lastSyncedAt = row.last_synced_at as string | null;

    if (q && !name.toLowerCase().includes(q) && !email.toLowerCase().includes(q)) continue;

    const rawJson = row.raw_json as Record<string, unknown> | null;
    let cost30 = 0;
    let tokens30 = 0;
    let activeDays = 0;
    let cacheHit = 0;
    let powerIndex = 0;

    if (rawJson) {
      const daily = getCcusageDaily(rawJson);
      let cacheRead = 0, cacheWrite = 0, input = 0;
      for (const d of daily) {
        if (!d.date || d.date < thirtyAgoYmd) continue;
        const c = (d as Record<string, unknown>).totalCost as number | undefined;
        if (c && c > 0) { cost30 += c; activeDays++; }
        tokens30 += d.totalTokens ?? 0;
        cacheRead += d.cacheReadTokens ?? 0;
        cacheWrite += d.cacheCreationTokens ?? 0;
        input += d.inputTokens ?? 0;
      }
      const denom = cacheRead + cacheWrite + input;
      cacheHit = denom > 0 ? (cacheRead / denom) * 100 : 0;
      const avgDaily = activeDays > 0 ? tokens30 / activeDays : 0;
      powerIndex = computePowerIndex(activeDays, avgDaily, 30);
    }

    result.push({
      userId,
      name,
      email,
      rankingHidden,
      createdAt,
      lastSyncedAt,
      cost30: Math.round(cost30 * 100) / 100,
      tokens30,
      activeDays,
      cacheHit: Math.round(cacheHit * 10) / 10,
      powerIndex: Math.round(powerIndex * 10) / 10,
    });
  }

  result.sort((a, b) => b.cost30 - a.cost30);

  return NextResponse.json({ users: result });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdmin(session.user.email))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { userId, rankingHidden } = body as { userId?: number; rankingHidden?: boolean };
  if (!userId || typeof rankingHidden !== "boolean")
    return NextResponse.json({ error: "invalid" }, { status: 400 });

  await db
    .update(users)
    .set({ rankingHidden })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)));

  return NextResponse.json({ ok: true });
}
