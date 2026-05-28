// GET /api/ranking — 전체 personal 사용자 랭킹.
// metric: cost | tokens | powerIndex | cacheHit (query param, default: cost)
// 응답: top 50 + 요청자 중심 위아래 10명 + 본인 순위.
// 이름은 마스킹 (첫1자 + * + 마지막1자). 어드민은 ?admin=1 로 실명 조회 가능.

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { isAdmin } from "@/lib/admin";
import { getCcusageDaily } from "@/lib/ccusage-row";
import { computePowerIndex } from "@/lib/rules";

type Metric = "cost" | "tokens" | "powerIndex" | "cacheHit";

function maskName(name: string): string {
  if (name.length <= 2) return name[0] + "*";
  return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
}

interface RankedUser {
  rank: number;
  userId: number;
  name: string;
  cost: number;
  tokens: number;
  powerIndex: number;
  cacheHit: number;
  activeDays: number;
  isMe: boolean;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const metric = (req.nextUrl.searchParams.get("metric") ?? "cost") as Metric;
  if (!["cost", "tokens", "powerIndex", "cacheHit"].includes(metric))
    return NextResponse.json({ error: "invalid_metric" }, { status: 400 });

  const adminView = req.nextUrl.searchParams.get("admin") === "1" && isAdmin(session.user.email);

  const meRow = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);
  const meId = meRow[0]?.id ?? -1;

  // personal=true, ranking_hidden=false, active 사용자의 가장 최근 snapshot
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (us.user_id)
      us.user_id, u.name, us.raw_json, us.total_cost, us.cache_hit_pct,
      us.sessions_count, us.calls_count
    FROM user_snapshots us
    JOIN users u ON u.id = us.user_id
    WHERE u.personal = true
      AND u.ranking_hidden = false
      AND u.deleted_at IS NULL
      AND u.suspended_at IS NULL
    ORDER BY us.user_id, us.updated_at DESC
  `);

  // "최근 30일" = 오늘 포함 30 calendar days. setDate(-30) 은 31일 윈도우라 -29 사용.
  const thirtyAgo = new Date();
  thirtyAgo.setDate(thirtyAgo.getDate() - 29);
  const thirtyAgoYmd = thirtyAgo.toISOString().slice(0, 10);

  // 30일 집계
  const entries: Array<{
    userId: number;
    name: string;
    cost: number;
    tokens: number;
    powerIndex: number;
    cacheHit: number;
    activeDays: number;
  }> = [];

  for (const row of rows.rows as Array<Record<string, unknown>>) {
    const userId = row.user_id as number;
    const name = row.name as string;
    const rawJson = row.raw_json as Record<string, unknown>;

    const daily = getCcusageDaily(rawJson);

    let cost30 = 0;
    let tokens30 = 0;
    let cacheRead30 = 0;
    let cacheWrite30 = 0;
    let input30 = 0;
    let activeDays = 0;

    // B4 (2026-05-28): 활성일 기준을 totalTokens > 0 으로 통일. 옛 동작은
    // activeDays 만 cost > 0 으로 카운트하고 tokens/cache 는 무관 합산 → avg
    // 부풀려짐 + cache-only 활동 (cost=0, hit 100%) 누락. tokens>0 한 row 만
    // 모든 합산에 포함.
    for (const d of daily) {
      if (!d.date || d.date < thirtyAgoYmd) continue;
      const tt = d.totalTokens ?? 0;
      if (tt <= 0) continue;
      const c = (d as Record<string, unknown>).totalCost as number | undefined;
      cost30 += c ?? 0;
      tokens30 += tt;
      cacheRead30 += d.cacheReadTokens ?? 0;
      cacheWrite30 += d.cacheCreationTokens ?? 0;
      input30 += d.inputTokens ?? 0;
      activeDays++;
    }

    const cacheDenom = cacheRead30 + cacheWrite30 + input30;
    const cacheHit = cacheDenom > 0 ? (cacheRead30 / cacheDenom) * 100 : 0;
    const avgDailyTokens = activeDays > 0 ? (tokens30 / activeDays) : 0;
    const pi = computePowerIndex(activeDays, avgDailyTokens, 30);

    entries.push({
      userId,
      name,
      cost: cost30,
      tokens: tokens30,
      powerIndex: pi,
      cacheHit,
      activeDays,
    });
  }

  // B5 (2026-05-28): 활동 없는 사용자 (activeDays=0) 는 ranked 에서 제외.
  // 옛 동작은 0점 사용자가 user_id 순으로 줄줄이 표시되어 게이미피케이션 가치 ↓.
  const activeEntries = entries.filter((e) => e.activeDays > 0);

  // metric 기준 정렬 (desc) + secondary tiebreak (userId asc) — sort 안정성 명시
  activeEntries.sort((a, b) => {
    const diff = b[metric] - a[metric];
    if (diff !== 0) return diff;
    return a.userId - b.userId;
  });

  // 순위 부여 + 마스킹. 표준 RANK 룰 — 동점은 같은 순위, 다음은 동점 수만큼 skip.
  const ranked: RankedUser[] = [];
  let prevValue: number | null = null;
  let prevRank = 0;
  for (let i = 0; i < activeEntries.length; i++) {
    const e = activeEntries[i];
    const cur = e[metric];
    const rank = prevValue !== null && cur === prevValue ? prevRank : i + 1;
    prevValue = cur;
    prevRank = rank;
    ranked.push({
      rank,
      userId: e.userId,
      name: adminView ? e.name : maskName(e.name),
      cost: Math.round(e.cost * 100) / 100,
      tokens: e.tokens,
      powerIndex: Math.round(e.powerIndex * 10) / 10,
      cacheHit: Math.round(e.cacheHit * 10) / 10,
      activeDays: e.activeDays,
      isMe: e.userId === meId,
    });
  }

  // 상위 50명
  const top = ranked.slice(0, 50);

  // 내 순위 중심 위아래 10명
  const myIdx = ranked.findIndex((r) => r.isMe);
  let around: RankedUser[] = [];
  if (myIdx >= 0) {
    const start = Math.max(0, myIdx - 10);
    const end = Math.min(ranked.length, myIdx + 11);
    around = ranked.slice(start, end);
  }

  // myRank
  const myRank = myIdx >= 0 ? ranked[myIdx] : null;

  return NextResponse.json({
    metric,
    totalParticipants: ranked.length,
    top,
    around,
    myRank,
    period: "30d",
  });
}
