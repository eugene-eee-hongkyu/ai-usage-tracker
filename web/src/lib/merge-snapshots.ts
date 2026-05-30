// Multi-device snapshot 합산 헬퍼.
// 영진님 같은 multi-device 사용자가 dashboard 의 device chip 옆 "합산" 버튼 클릭 시
// dashboard route 에서 사용. user_snapshots 의 device 별 row N 개를 1 virtual row 로
// 압축. raw_json 의 모든 키 (today / week / month / 30days / all / ccusageDaily /
// ccusageBlocks) 별로 group-by sum + cache hit% / oneShotRate 는 raw 분모로 재계산.
//
// raw 가 다 있어서 정확한 합산 가능 — codeburn 의 overview.tokens (input/output/
// cacheRead/cacheWrite) + activities[].turns + activities[].oneShotTurns + models[]
// 의 토큰 분해 모두 활용.
//
// 기존 single-device row 처리 로직은 그대로 — virtual row 1 개로 압축 후 route 의
// 후속 분기 (getPeriodData / efficiency / power index 등) 가 자연 동작.

type AnyObj = Record<string, unknown>;

function n(v: unknown): number {
  return typeof v === "number" && !isNaN(v) ? v : 0;
}

function groupSumByKey<T extends AnyObj>(
  items: T[],
  keyField: keyof T,
  numericFields: Array<keyof T>,
): T[] {
  const map = new Map<unknown, T>();
  for (const item of items) {
    const key = item[keyField];
    if (key == null) continue;
    const existing = map.get(key);
    if (existing) {
      for (const f of numericFields) {
        (existing as AnyObj)[f as string] = n(existing[f]) + n(item[f]);
      }
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
}

interface MergedOverview {
  cost: number;
  calls: number;
  sessions: number;
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
  cacheHitPercent: number;
}

function mergeOverview(overviews: AnyObj[]): MergedOverview {
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let cost = 0, calls = 0, sessions = 0;
  for (const o of overviews) {
    cost += n(o.cost) + n((o as { totalCost?: number }).totalCost);
    calls += n(o.calls) + n((o as { callsCount?: number }).callsCount);
    sessions += n(o.sessions) + n((o as { totalSessions?: number }).totalSessions);
    const t = o.tokens as { input?: number; output?: number; cacheRead?: number; cacheWrite?: number } | undefined;
    if (t) {
      tokens.input += n(t.input);
      tokens.output += n(t.output);
      tokens.cacheRead += n(t.cacheRead);
      tokens.cacheWrite += n(t.cacheWrite);
    }
  }
  const cacheDenom = tokens.input + tokens.cacheRead + tokens.cacheWrite;
  const cacheHitPercent = cacheDenom > 0 ? (tokens.cacheRead / cacheDenom) * 100 : 0;
  return { cost, calls, sessions, tokens, cacheHitPercent };
}

function recomputeOneShotRate<T extends { oneShotTurns?: number; editTurns?: number; oneShotRate?: number | null }>(arr: T[]): void {
  // codeburn 의 activities[].oneShotRate 정의: oneShotTurns / editTurns * 100.
  // turns 분모 (이전 잘못된 구현) 가 아니라 editTurns 분모 — editable 한 활동만의 비율.
  // editTurns=0 (Exploration / Conversation 등) 은 oneShotRate null 유지 — dashboard 의
  // `rate != null` 필터에서 제외되어야 가중평균이 의미 있음.
  for (const item of arr) {
    const editTurns = n(item.editTurns);
    if (editTurns > 0) {
      item.oneShotRate = (n(item.oneShotTurns) / editTurns) * 100;
    } else {
      item.oneShotRate = null;
    }
  }
}

// codeburn 의 period (today/week/month/30days/all) 안의 데이터 한 단위. 모든 device 의 같은
// period 데이터를 합산.
function mergePeriodData(items: AnyObj[]): AnyObj {
  if (items.length === 0) return {};

  // overview
  const overviews = items.map((i) => (i.overview as AnyObj) ?? (i.summary as AnyObj) ?? {});
  const overview = mergeOverview(overviews);

  // activities — category 별 group by, cost / turns / editTurns / oneShotTurns 합산
  const activitiesFlat = items.flatMap((i) => (i.activities as AnyObj[]) ?? []);
  const activities = groupSumByKey(activitiesFlat, "category", ["cost", "turns", "editTurns", "oneShotTurns"]);
  recomputeOneShotRate(activities as Array<{ oneShotTurns?: number; turns?: number; oneShotRate?: number }>);

  // models — name 별 group by, 토큰 분해 + oneShotTurns 까지 합산 후 oneShotRate 재계산
  const modelsFlat = items.flatMap((i) => (i.models as AnyObj[]) ?? []);
  const models = groupSumByKey(modelsFlat, "name", [
    "cost", "calls", "editTurns", "oneShotTurns",
    "inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens",
  ]);
  // model 의 oneShotRate 는 editTurns 분모 (codeburn 정의)
  for (const m of models as Array<{ oneShotTurns?: number; editTurns?: number; oneShotRate?: number }>) {
    const denom = n(m.editTurns);
    if (denom > 0) m.oneShotRate = (n(m.oneShotTurns) / denom) * 100;
  }

  // projects — name 별 group by
  const projectsFlat = items.flatMap((i) => (i.projects as AnyObj[]) ?? []);
  const projects = groupSumByKey(projectsFlat, "name", ["cost", "calls", "sessions"]);

  // tools / mcpServers / shellCommands — name 별 calls 합산
  const tools = groupSumByKey(items.flatMap((i) => (i.tools as AnyObj[]) ?? []), "name", ["calls"]);
  const mcpServers = groupSumByKey(items.flatMap((i) => (i.mcpServers as AnyObj[]) ?? []), "name", ["calls"]);
  const shellCommands = groupSumByKey(items.flatMap((i) => (i.shellCommands as AnyObj[]) ?? []), "name", ["calls"]);

  // topSessions — 다른 sessionId 라 단순 concat + cost desc top N
  const allSessions = items.flatMap((i) => (i.topSessions as AnyObj[]) ?? []);
  allSessions.sort((a, b) => n(b.cost) - n(a.cost));
  const topSessions = allSessions.slice(0, 10);

  // daily — date 별 group by cost / calls (codeburn daily 는 토큰 분해 없음)
  const dailyFlat = items.flatMap((i) => (i.daily as AnyObj[]) ?? []);
  const daily = groupSumByKey(dailyFlat, "date", ["cost", "calls"]);
  daily.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  // ccusageDaily — date 별 group by 토큰 분해 + totalCost
  const ccusageInner = items.flatMap((i) => {
    const cc = i.ccusageDaily as { daily?: AnyObj[] } | undefined;
    return cc?.daily ?? [];
  });
  const ccusageDaily = groupSumByKey(ccusageInner, "date", [
    "totalCost", "totalTokens", "inputTokens", "outputTokens",
    "cacheReadTokens", "cacheCreationTokens",
  ]);
  ccusageDaily.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return {
    overview,
    activities,
    models,
    projects,
    tools,
    mcpServers,
    shellCommands,
    topSessions,
    daily,
    ccusageDaily: { daily: ccusageDaily },
    period: items[0].period,
    periodKey: items[0].periodKey,
    currency: items[0].currency ?? "USD",
    generated: new Date().toISOString(),
  };
}

// raw_json 최상위 단위 merge — 키 별 (today/week/month/30days/all + ccusageDaily +
// ccusageBlocks) 각각 합산. 옛 키 누락 안전.
export function mergeRawJson(rawJsons: AnyObj[]): AnyObj {
  if (rawJsons.length === 0) return {};
  const result: AnyObj = {};
  const periodKeys = ["today", "week", "month", "30days", "all"];
  for (const pk of periodKeys) {
    const periodItems = rawJsons.map((r) => r?.[pk] as AnyObj | undefined).filter(Boolean) as AnyObj[];
    if (periodItems.length > 0) {
      result[pk] = mergePeriodData(periodItems);
    }
  }
  // 최상위 ccusageDaily — 모든 device 의 daily 배열 date 별 group sum
  const topCcDaily = rawJsons.flatMap((r) => (r?.ccusageDaily as { daily?: AnyObj[] } | undefined)?.daily ?? []);
  if (topCcDaily.length > 0) {
    const merged = groupSumByKey(topCcDaily, "date", [
      "totalCost", "totalTokens", "inputTokens", "outputTokens",
      "cacheReadTokens", "cacheCreationTokens",
    ]);
    merged.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    result.ccusageDaily = { daily: merged };
  }
  // ccusageBlocks — 모든 device 의 blocks 단순 concat (각 block 다른 5h 윈도우)
  const topBlocks = rawJsons.flatMap((r) => (r?.ccusageBlocks as { blocks?: AnyObj[] } | undefined)?.blocks ?? []);
  if (topBlocks.length > 0) {
    result.ccusageBlocks = { blocks: topBlocks };
  }
  return result;
}

// user_snapshots row 합산 — N row 를 1 virtual row 로. dashboard route 의 snap[0]
// 자리에 inject 해서 후속 로직 (getPeriodData / efficiency / power index 등) 이 자연
// 동작. tokenId 는 null sentinel.
export interface UserSnapshotLike {
  rawJson: unknown;
  totalCost: number | null;
  sessionsCount: number | null;
  callsCount: number | null;
  cacheHitPct: number | null;
  overallOneShot: number | null;
  currentDayRawJson: unknown;
  currentWeekRawJson: unknown;
  currentMonthRawJson: unknown;
  currentDayStart: string | null;
  currentWeekStart: string | null;
  currentMonthStart: string | null;
  updatedAt: Date | null;
  tokenId: number | null;
  [k: string]: unknown;
}

export function mergeUserSnapshots(snaps: UserSnapshotLike[]): UserSnapshotLike {
  if (snaps.length === 0) throw new Error("mergeUserSnapshots: empty");
  if (snaps.length === 1) return snaps[0];

  const rawJsons = snaps.map((s) => (s.rawJson ?? {}) as AnyObj);
  const mergedRaw = mergeRawJson(rawJsons);

  // totals 합산 + 가중평균 (cacheHitPct / overallOneShot)
  let totalCost = 0, sessionsCount = 0, callsCount = 0;
  let cacheHitWeighted = 0, cacheHitDenom = 0;
  let oneShotWeighted = 0, oneShotDenom = 0;
  for (const s of snaps) {
    totalCost += n(s.totalCost);
    sessionsCount += n(s.sessionsCount);
    callsCount += n(s.callsCount);
    // cacheHitPct 가중평균 — 분모 callsCount (proxy for token 양)
    cacheHitWeighted += n(s.cacheHitPct) * n(s.callsCount);
    cacheHitDenom += n(s.callsCount);
    // overallOneShot 가중평균 — 분모 sessionsCount
    oneShotWeighted += n(s.overallOneShot) * n(s.sessionsCount);
    oneShotDenom += n(s.sessionsCount);
  }
  const cacheHitPct = cacheHitDenom > 0 ? cacheHitWeighted / cacheHitDenom : 0;
  const overallOneShot = oneShotDenom > 0 ? oneShotWeighted / oneShotDenom : 0;

  // current_*_raw_json 도 같은 패턴 merge
  const currentDayRawJson = mergePeriodData(
    snaps.map((s) => s.currentDayRawJson as AnyObj | null).filter(Boolean) as AnyObj[]
  );
  const currentWeekRawJson = mergePeriodData(
    snaps.map((s) => s.currentWeekRawJson as AnyObj | null).filter(Boolean) as AnyObj[]
  );
  const currentMonthRawJson = mergePeriodData(
    snaps.map((s) => s.currentMonthRawJson as AnyObj | null).filter(Boolean) as AnyObj[]
  );

  // 가장 최근 updatedAt — 어떤 device 가 최근 sync 인지 추적
  const latestUpdate = snaps.reduce<Date | null>((latest, s) => {
    if (!s.updatedAt) return latest;
    if (!latest || s.updatedAt > latest) return s.updatedAt;
    return latest;
  }, null);

  // current_*_start 는 가장 최근 device 기준 (TZ 일관성)
  const refSnap = snaps.reduce((ref, s) =>
    !ref || (s.updatedAt && ref.updatedAt && s.updatedAt > ref.updatedAt) ? s : ref, snaps[0]);

  return {
    ...snaps[0],
    rawJson: mergedRaw,
    totalCost,
    sessionsCount,
    callsCount,
    cacheHitPct,
    overallOneShot,
    currentDayRawJson: Object.keys(currentDayRawJson).length > 0 ? currentDayRawJson : null,
    currentWeekRawJson: Object.keys(currentWeekRawJson).length > 0 ? currentWeekRawJson : null,
    currentMonthRawJson: Object.keys(currentMonthRawJson).length > 0 ? currentMonthRawJson : null,
    currentDayStart: refSnap.currentDayStart,
    currentWeekStart: refSnap.currentWeekStart,
    currentMonthStart: refSnap.currentMonthStart,
    updatedAt: latestUpdate,
    tokenId: null, // virtual merged row sentinel
  };
}
