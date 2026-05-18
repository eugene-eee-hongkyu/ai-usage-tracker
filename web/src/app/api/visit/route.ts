export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, dailyVisits, users, IS_LOCAL_MODE } from "@/lib/db";
import { getAuthedEmail } from "@/lib/local-user";
import { eq, sql } from "drizzle-orm";

// POST /api/visit
// DashboardView mount-time 에 1회 호출. session.user 만 신뢰 (URL 의
// targetUserId 는 무시 — 어드민이 viewOnly 모드로 다른 사람 dashboard 를
// 봐도 visit 카운트는 어드민 본인에게 집계).
//
// today 는 사용자 timezone 기준 (users.timezone, NULL 이면 UTC).
// 같은 (user_id, date) 행이 있으면 count + 1 atomic 증가.
export async function POST() {
  const session = IS_LOCAL_MODE ? null : await getServerSession(authOptions);
  const authedEmail = await getAuthedEmail(session?.user?.email);
  if (!authedEmail)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userRow = await db
    .select({ id: users.id, timezone: users.timezone })
    .from(users)
    .where(eq(users.email, authedEmail))
    .limit(1);

  if (!userRow[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Phase 4.2 (M6a): session.user.currentTeamId 사용 (LOCAL_MODE 면 1).
  const teamId = IS_LOCAL_MODE
    ? 1
    : ((session?.user as { currentTeamId?: number | null } | undefined)?.currentTeamId ?? null);
  if (!teamId) return NextResponse.json({ error: "no_team" }, { status: 403 });

  const tz = userRow[0].timezone ?? "UTC";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const todayYmd = `${get("year")}-${get("month")}-${get("day")}`;

  await db
    .insert(dailyVisits)
    .values({ userId: userRow[0].id, teamId, date: todayYmd, count: 1 })
    .onConflictDoUpdate({
      target: [dailyVisits.userId, dailyVisits.teamId, dailyVisits.date],
      set: { count: sql`${dailyVisits.count} + 1` },
    });

  return NextResponse.json({ ok: true });
}
