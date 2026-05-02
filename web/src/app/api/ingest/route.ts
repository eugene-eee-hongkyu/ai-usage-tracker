import { NextRequest, NextResponse } from "next/server";
import { db, userSnapshots, users, periodSnapshots } from "@/lib/db";
import { and, eq, lt, sql } from "drizzle-orm";
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

function ymdInTz(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function isoMondayInTz(date: Date, tz: string): string {
  const ymd = ymdInTz(date, tz);
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = utc.getUTCDay();
  const distance = (dayOfWeek + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - distance);
  return utc.toISOString().slice(0, 10);
}

function firstOfMonthInTz(date: Date, tz: string): string {
  const ymd = ymdInTz(date, tz);
  return ymd.slice(0, 7) + "-01";
}

function shiftDate(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

function shiftMonths(ymd: string, months: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCMonth(utc.getUTCMonth() + months);
  return utc.toISOString().slice(0, 10);
}

function isoMondayFromYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = utc.getUTCDay();
  const distance = (dayOfWeek + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - distance);
  return utc.toISOString().slice(0, 10);
}

// codeburn / ccusage 데이터에서 사용자 로컬 시각의 "오늘" 날짜 추출.
// codeburn은 UTC 기준으로 today를 리턴하는 버그가 있어 SGT/KST 사용자에서
// 자정~UTC 자정 사이엔 어제 날짜가 나옴. ccusage는 로컬 timezone을 지키므로
// 두 신호 중 더 미래(max) 날짜를 채택해 boundary 누락을 방지.
function deriveUserTodayFromBody(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  const candidates: string[] = [];

  // codeburn today.daily[0].date
  const today = b.today as { daily?: Array<{ date?: string }>; period?: string } | undefined;
  const cbDate = today?.daily?.[0]?.date;
  if (cbDate && /^\d{4}-\d{2}-\d{2}$/.test(cbDate)) candidates.push(cbDate);

  // codeburn today.period 라벨 — "Today (YYYY-MM-DD)" 형태에서 날짜 추출.
  // daily가 비어있어도(사용자가 새 날에 아직 작업 안 함) period 라벨엔 정확한 날짜 있음.
  const periodMatch = today?.period?.match?.(/(\d{4}-\d{2}-\d{2})/);
  if (periodMatch) candidates.push(periodMatch[1]);

  // ccusageDaily.daily의 모든 날짜 (정확한 로컬 timezone)
  const cu = b.ccusageDaily as { daily?: Array<{ date?: string }> } | undefined;
  for (const row of cu?.daily ?? []) {
    if (row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date)) candidates.push(row.date);
  }

  if (!candidates.length) return null;
  return candidates.sort()[candidates.length - 1];  // max
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userRow = await db
    .select()
    .from(users)
    .where(eq(users.apiKeyHash, crypto.createHash("sha256").update(apiKey).digest("hex")))
    .limit(1);

  if (!userRow[0]) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const base = getBaseReport(body);
  const ov = base.overview ?? base.summary ?? {};
  const activities = base.activities ?? [];

  const totalCost = ov.cost ?? ov.totalCost ?? 0;
  const sessionsCount = ov.sessions ?? ov.totalSessions ?? 0;
  const callsCount = ov.calls ?? ov.callsCount ?? 0;
  const cacheHitPct = ov.cacheHitPercent ?? ov.cacheHitPct ?? 0;
  const overallOneShot = computeOverallOneShot(activities);

  const userTz = userRow[0].timezone ?? "UTC";
  const now = new Date();

  // codeburn / ccusage 데이터의 날짜를 우선 사용 — users.timezone이 NULL이어도
  // 사용자 로컬 시각 기준 boundary 계산이 가능. 없을 때만 timezone 폴백.
  const userTodayDate = deriveUserTodayFromBody(body);
  const newDayStart = userTodayDate ?? ymdInTz(now, userTz);
  const newWeekStart = userTodayDate ? isoMondayFromYmd(userTodayDate) : isoMondayInTz(now, userTz);
  const newMonthStart = userTodayDate ? userTodayDate.slice(0, 7) + "-01" : firstOfMonthInTz(now, userTz);

  const bodyObj = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const rawWeekData = bodyObj.week as Record<string, unknown> | null | undefined;
  const rawMonthData = bodyObj.month as Record<string, unknown> | null | undefined;
  const rawDayData = bodyObj.today as Record<string, unknown> | null | undefined;

  // Filter ccusage daily rows to a date range and embed alongside codeburn data
  // so promoted snapshots carry token info.
  const ccusageDaily = (bodyObj.ccusageDaily as { daily?: Array<{ date?: string }> } | undefined)?.daily ?? [];
  const filterCcusage = (startYmd: string, endYmd: string) =>
    ccusageDaily.filter((d) => d.date && d.date >= startYmd && d.date <= endYmd);

  const weekEnd = shiftDate(newWeekStart, 6);
  const monthEnd = shiftDate(shiftMonths(newMonthStart, 1), -1);

  const weekData = rawWeekData
    ? { ...rawWeekData, ccusageDaily: { daily: filterCcusage(newWeekStart, weekEnd) } }
    : null;
  const monthData = rawMonthData
    ? { ...rawMonthData, ccusageDaily: { daily: filterCcusage(newMonthStart, monthEnd) } }
    : null;
  const dayData = rawDayData
    ? { ...rawDayData, ccusageDaily: { daily: filterCcusage(newDayStart, newDayStart) } }
    : null;

  // Read existing to detect period boundary crossings
  const existing = await db
    .select()
    .from(userSnapshots)
    .where(eq(userSnapshots.userId, userRow[0].id))
    .limit(1);

  const prev = existing[0];

  // Promote previous-week snapshot if week boundary crossed
  if (prev?.currentWeekStart && prev.currentWeekStart !== newWeekStart && prev.currentWeekRawJson) {
    await db
      .insert(periodSnapshots)
      .values({
        userId: userRow[0].id,
        periodType: "weekly",
        periodStart: prev.currentWeekStart,
        capturedAt: prev.updatedAt ?? now,
        rawJson: prev.currentWeekRawJson,
      })
      .onConflictDoNothing();
  }

  // Promote previous-month snapshot if month boundary crossed
  if (prev?.currentMonthStart && prev.currentMonthStart !== newMonthStart && prev.currentMonthRawJson) {
    await db
      .insert(periodSnapshots)
      .values({
        userId: userRow[0].id,
        periodType: "monthly",
        periodStart: prev.currentMonthStart,
        capturedAt: prev.updatedAt ?? now,
        rawJson: prev.currentMonthRawJson,
      })
      .onConflictDoNothing();
  }

  // Promote previous-day snapshot if day boundary crossed
  if (prev?.currentDayStart && prev.currentDayStart !== newDayStart && prev.currentDayRawJson) {
    await db
      .insert(periodSnapshots)
      .values({
        userId: userRow[0].id,
        periodType: "daily",
        periodStart: prev.currentDayStart,
        capturedAt: prev.updatedAt ?? now,
        rawJson: prev.currentDayRawJson,
      })
      .onConflictDoNothing();
  }

  await db
    .insert(userSnapshots)
    .values({
      userId: userRow[0].id,
      rawJson: body,
      totalCost,
      sessionsCount,
      callsCount,
      cacheHitPct,
      overallOneShot,
      currentWeekRawJson: weekData as object,
      currentWeekStart: newWeekStart,
      currentMonthRawJson: monthData as object,
      currentMonthStart: newMonthStart,
      currentDayRawJson: dayData as object,
      currentDayStart: newDayStart,
      updatedAt: now,
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
        currentWeekRawJson: sql`excluded.current_week_raw_json`,
        currentWeekStart: sql`excluded.current_week_start`,
        currentMonthRawJson: sql`excluded.current_month_raw_json`,
        currentMonthStart: sql`excluded.current_month_start`,
        currentDayRawJson: sql`excluded.current_day_raw_json`,
        currentDayStart: sql`excluded.current_day_start`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  // Retention cleanup
  const retentionWeekStart = shiftDate(newWeekStart, -5 * 7);
  const retentionMonthStart = shiftMonths(newMonthStart, -12);
  const retentionDayStart = shiftDate(newDayStart, -7);

  await db
    .delete(periodSnapshots)
    .where(
      and(
        eq(periodSnapshots.userId, userRow[0].id),
        eq(periodSnapshots.periodType, "weekly"),
        lt(periodSnapshots.periodStart, retentionWeekStart),
      )
    );

  await db
    .delete(periodSnapshots)
    .where(
      and(
        eq(periodSnapshots.userId, userRow[0].id),
        eq(periodSnapshots.periodType, "monthly"),
        lt(periodSnapshots.periodStart, retentionMonthStart),
      )
    );

  await db
    .delete(periodSnapshots)
    .where(
      and(
        eq(periodSnapshots.userId, userRow[0].id),
        eq(periodSnapshots.periodType, "daily"),
        lt(periodSnapshots.periodStart, retentionDayStart),
      )
    );

  await db
    .update(users)
    .set({ lastSyncedAt: now })
    .where(eq(users.id, userRow[0].id));

  return NextResponse.json({ ok: true });
}
