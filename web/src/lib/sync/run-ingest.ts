// ingest 의 핵심 로직 — promote / retention / upsert.
// HTTP route ([api/ingest/route.ts]) 와 향후 CLI in-process binary 가 같은 함수를 호출.
// 분기는 호출 측에서 (auth, user 식별) 처리, 이 모듈은 순수 데이터 변환·DB write.

import { and, eq, lt, sql } from "drizzle-orm";
import { db, userSnapshots, users, periodSnapshots, userBlocks } from "../db";
import { normalizeCcusageRow } from "../ccusage-row";

interface CcusageBlockRow {
  id?: string;
  startTime?: string;
  endTime?: string;
  actualEndTime?: string | null;
  isActive?: boolean;
  isGap?: boolean;
  entries?: number;
  totalTokens?: number;
  costUSD?: number;
  models?: string[];
}

function extractBlocks(body: unknown): CcusageBlockRow[] {
  if (typeof body !== "object" || body === null) return [];
  const b = body as Record<string, unknown>;
  const cb = b.ccusageBlocks as { blocks?: unknown[] } | undefined;
  if (!cb || !Array.isArray(cb.blocks)) return [];
  return cb.blocks.filter((x): x is CcusageBlockRow => typeof x === "object" && x !== null);
}

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
  totalCost?: number;
  totalSessions?: number;
  callsCount?: number;
  tokens?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
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

  const today = b.today as { daily?: Array<{ date?: string }>; period?: string } | undefined;
  const cbDate = today?.daily?.[0]?.date;
  if (cbDate && /^\d{4}-\d{2}-\d{2}$/.test(cbDate)) candidates.push(cbDate);

  const periodMatch = today?.period?.match?.(/(\d{4}-\d{2}-\d{2})/);
  if (periodMatch) candidates.push(periodMatch[1]);

  // ccusage 19.x: row 의 날짜 키가 'date' → 'period'. 양쪽 모두 수용.
  // 빠뜨리면 KST/SGT 사용자 boundary 직후 newDayStart 가 codeburn UTC today
  // 만 의존하게 되어 daily snapshot 이 잘못된 날짜로 promote 됨.
  const cu = b.ccusageDaily as { daily?: Array<{ date?: string; period?: string }> } | undefined;
  for (const row of cu?.daily ?? []) {
    const d = row.date ?? row.period;
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) candidates.push(d);
  }

  if (!candidates.length) return null;
  return candidates.sort()[candidates.length - 1];
}

/**
 * codeburn + ccusage 데이터를 받아 user_snapshots / period_snapshots / user_blocks 를 갱신.
 * 호출 측 책임: 인증, userId / tokenId 확정. 이 함수는 그 후 데이터 write 만.
 *
 * tokenId: M6f (2026-05-25) device-scope 도입. (user, team, token) 단위로 row 분리 → 같은
 * user 의 노트북 N대 데이터가 서로 덮어쓰지 않음. dashboard 가 device 별로 보거나 합산 선택.
 * fallback (옛 users.api_key_hash 경로) 면 null — (user, team, null) 단일 legacy row.
 *
 * Multi-provider (2026-05-29 M): body 의 형태에 따라 분기.
 *   - 신 형태: body = { claude: {...}, codex: {...}, envInfo?, ccusageMissing? } — provider 별 별도 row.
 *   - 옛 형태: body = { today, week, ..., ccusageDaily, ccusageBlocks } — 전체 claude 처리 (backward compat).
 * (user, team, token, provider) 단위 row 분리. claude / codex 각자 prev snapshot 기준 boundary promotion.
 */
export async function runIngest(
  userId: number,
  teamId: number,
  tokenId: number | null,
  userTimezone: string | null,
  body: unknown
): Promise<void> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const hasProviderSplit = b.claude !== undefined || b.codex !== undefined;

  if (hasProviderSplit) {
    const PROVIDERS: Array<"claude" | "codex"> = ["claude", "codex"];
    for (const provider of PROVIDERS) {
      const providerBody = b[provider];
      if (providerBody && typeof providerBody === "object") {
        await runIngestForProvider(userId, teamId, tokenId, userTimezone, provider, providerBody);
      }
    }
  } else {
    // 옛 형태 — 전체 claude 로 처리 (backward compat — 옛 CLI 가 아직 deployed 일 가능성).
    await runIngestForProvider(userId, teamId, tokenId, userTimezone, "claude", body);
  }

  await db.update(users).set({ lastSyncedAt: new Date() }).where(eq(users.id, userId));
}

async function runIngestForProvider(
  userId: number,
  teamId: number,
  tokenId: number | null,
  userTimezone: string | null,
  provider: string,
  body: unknown
): Promise<void> {
  const base = getBaseReport(body);
  const ov = base.overview ?? base.summary ?? {};
  const activities = base.activities ?? [];

  const totalCost = ov.cost ?? ov.totalCost ?? 0;
  const sessionsCount = ov.sessions ?? ov.totalSessions ?? 0;
  const callsCount = ov.calls ?? ov.callsCount ?? 0;
  // codeburn 의 cacheHitPercent 는 100 으로 박히는 버그가 있어 신뢰 불가.
  // raw token 분모로 자체 계산: cacheRead / (input + cacheRead + cacheWrite) × 100
  const tRead = ov.tokens?.cacheRead ?? 0;
  const tWrite = ov.tokens?.cacheWrite ?? 0;
  const tInput = ov.tokens?.input ?? 0;
  const cacheDenom = tRead + tWrite + tInput;
  const cacheHitPct = cacheDenom > 0 ? (tRead / cacheDenom) * 100 : 0;
  const overallOneShot = computeOverallOneShot(activities);

  const userTz = userTimezone ?? "UTC";
  const now = new Date();

  const userTodayDate = deriveUserTodayFromBody(body);
  const newDayStart = userTodayDate ?? ymdInTz(now, userTz);
  const newWeekStart = userTodayDate ? isoMondayFromYmd(userTodayDate) : isoMondayInTz(now, userTz);
  const newMonthStart = userTodayDate ? userTodayDate.slice(0, 7) + "-01" : firstOfMonthInTz(now, userTz);

  const bodyObj = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const rawWeekData = bodyObj.week as Record<string, unknown> | null | undefined;
  const rawMonthData = bodyObj.month as Record<string, unknown> | null | undefined;
  const rawDayData = bodyObj.today as Record<string, unknown> | null | undefined;

  // Read existing snapshot up-front: needed both for boundary-crossing promotion
  // AND for the ccusage merge logic below. (user, team, token) 단위 — 같은 device 의 prev.
  const existing = await db
    .select()
    .from(userSnapshots)
    .where(
      and(
        eq(userSnapshots.userId, userId),
        eq(userSnapshots.teamId, teamId),
        tokenId === null
          ? sql`${userSnapshots.tokenId} IS NULL`
          : eq(userSnapshots.tokenId, tokenId),
        eq(userSnapshots.provider, provider),
      )
    )
    .limit(1);

  const prev = existing[0];

  // ccusage merge: if this submission has no ccusage data (spawn failed/timeout/
  // empty), keep the previous snapshot's ccusageDaily instead of wiping it.
  const incomingCcusage = bodyObj.ccusageDaily as
    | { daily?: Array<{ date?: string; totalTokens?: number }> }
    | undefined;
  const incomingCcusageEmpty =
    !incomingCcusage ||
    !Array.isArray(incomingCcusage.daily) ||
    incomingCcusage.daily.length === 0;
  const prevCcusage =
    (prev?.rawJson as Record<string, unknown> | null | undefined)?.ccusageDaily as
      | { daily?: Array<{ date?: string; totalTokens?: number }> }
      | undefined;
  const prevHasCcusage =
    prevCcusage &&
    Array.isArray(prevCcusage.daily) &&
    prevCcusage.daily.length > 0;
  if (incomingCcusageEmpty && prevHasCcusage) {
    bodyObj.ccusageDaily = prevCcusage;
  }

  // ccusage 19.x 부터 row 의 날짜 키가 'date' → 'period'. normalize 안 하면 week/month/day
  // scoped snapshot 의 ccusageDaily 가 빈 array 로 박혀 dashboard period filter 가 손상.
  const ccusageDaily = (
    (bodyObj.ccusageDaily as { daily?: Array<{ date?: string; period?: string }> } | undefined)?.daily ?? []
  ).map(normalizeCcusageRow);
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

  // Promote previous-week snapshot if week boundary crossed
  if (prev?.currentWeekStart && prev.currentWeekStart !== newWeekStart && prev.currentWeekRawJson) {
    await db
      .insert(periodSnapshots)
      .values({
        userId,
        teamId,
        tokenId,
        provider,
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
        userId,
        teamId,
        tokenId,
        provider,
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
        userId,
        teamId,
        tokenId,
        provider,
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
      userId,
      teamId,
      tokenId,
      provider,
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
      target: [userSnapshots.userId, userSnapshots.teamId, userSnapshots.tokenId, userSnapshots.provider],
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
        eq(periodSnapshots.userId, userId),
        eq(periodSnapshots.teamId, teamId),
        eq(periodSnapshots.periodType, "weekly"),
        lt(periodSnapshots.periodStart, retentionWeekStart),
      )
    );

  await db
    .delete(periodSnapshots)
    .where(
      and(
        eq(periodSnapshots.userId, userId),
        eq(periodSnapshots.teamId, teamId),
        eq(periodSnapshots.periodType, "monthly"),
        lt(periodSnapshots.periodStart, retentionMonthStart),
      )
    );

  await db
    .delete(periodSnapshots)
    .where(
      and(
        eq(periodSnapshots.userId, userId),
        eq(periodSnapshots.teamId, teamId),
        eq(periodSnapshots.periodType, "daily"),
        lt(periodSnapshots.periodStart, retentionDayStart),
      )
    );

  // ccusage blocks upsert. gap 블록 + actualEndTime null 인 active 는 스킵.
  const blocks = extractBlocks(body);
  for (const blk of blocks) {
    if (blk.isGap) continue;
    if (!blk.id || !blk.startTime || !blk.actualEndTime) continue;
    const startedAt = new Date(blk.startTime);
    const endedAt = new Date(blk.actualEndTime);
    if (isNaN(startedAt.getTime()) || isNaN(endedAt.getTime())) continue;
    const minutes = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 60_000));
    await db
      .insert(userBlocks)
      .values({
        userId,
        teamId,
        blockId: blk.id,
        provider,
        startedAt,
        endedAt,
        minutes,
        entries: blk.entries ?? 0,
        totalTokens: blk.totalTokens ?? 0,
        costUsd: blk.costUSD ?? 0,
        models: blk.models ?? [],
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userBlocks.userId, userBlocks.teamId, userBlocks.blockId, userBlocks.provider],
        set: {
          endedAt: sql`excluded.ended_at`,
          minutes: sql`excluded.minutes`,
          entries: sql`excluded.entries`,
          totalTokens: sql`excluded.total_tokens`,
          costUsd: sql`excluded.cost_usd`,
          models: sql`excluded.models`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  // 90일 이전 블록은 정리 (대시보드는 30일 윈도우, 여유 있게 90일 보존)
  await db
    .delete(userBlocks)
    .where(
      and(
        eq(userBlocks.userId, userId),
        eq(userBlocks.teamId, teamId),
        lt(userBlocks.startedAt, new Date(Date.now() - 90 * 86_400_000)),
      )
    );

  // last_synced_at 갱신은 wrapper runIngest 가 양쪽 provider 호출 후 1회만 처리.
}
