export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, dailyVisits, users, IS_LOCAL_MODE } from "@/lib/db";
import { getAuthedEmail } from "@/lib/local-user";
import { eq, sql } from "drizzle-orm";

// POST /api/visit-end
// DashboardView 가 페이지 hide / unload 시 sendBeacon 으로 호출.
// body: { sec: number } — 마지막 visit 이후 누적 dwell 초.
// daily_visits 의 total_dwell_seconds 에 가산. 새 행 생성 안 함
// (이미 visit POST 가 mount-time 에 row 만들었음).
//
// edge cases:
//  - 4시간 (14400 s) 으로 cap. 백그라운드 탭 망가진 timer 보호.
//  - sec 음수/NaN 무시.
export async function POST(req: NextRequest) {
  const session = IS_LOCAL_MODE ? null : await getServerSession(authOptions);
  const authedEmail = await getAuthedEmail(session?.user?.email);
  if (!authedEmail)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let sec = 0;
  try {
    const body = await req.json();
    sec = Number(body?.sec) | 0;
  } catch {
    // sendBeacon 은 가끔 빈 body. 무시하고 0 처리 — 실제로 dwell 누적은 0.
  }
  if (!Number.isFinite(sec) || sec <= 0) return NextResponse.json({ ok: true });
  if (sec > 14400) sec = 14400;

  const userRow = await db
    .select({ id: users.id, timezone: users.timezone })
    .from(users)
    .where(eq(users.email, authedEmail))
    .limit(1);
  if (!userRow[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const tz = userRow[0].timezone ?? "UTC";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const todayYmd = `${get("year")}-${get("month")}-${get("day")}`;

  // 행이 없으면 0 인 채로 만들고 dwell 만 누적. visit POST 가 mount-time
  // 에 먼저 호출되지만 sendBeacon 이 먼저 도달할 가능성도 있어 방어적으로
  // upsert.
  await db
    .insert(dailyVisits)
    .values({ userId: userRow[0].id, date: todayYmd, count: 0, totalDwellSeconds: sec })
    .onConflictDoUpdate({
      target: [dailyVisits.userId, dailyVisits.date],
      set: { totalDwellSeconds: sql`${dailyVisits.totalDwellSeconds} + ${sec}` },
    });

  return NextResponse.json({ ok: true });
}
