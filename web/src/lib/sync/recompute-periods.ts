// F3 (data-pipeline-slim-phase2to4 run 단계 8) PoC helper.
// codeburn period 응답의 daily[] 만으로 overview.cost / overview.calls 재집계.
//
// 가설: codeburn period 5 호출 (today/week/month/30days/all) → all 1 호출만 보내고
//       서버가 daily 합산으로 다른 4 period 의 cost/calls 재구성.
// 결과: today 정확 일치 / all 0.001-0.03% 누락 (codeburn 의 very old daily row 누락 추정).
// 한계: sessions / tokens / activities / models / projects / topSessions / tools /
//       shellCommands / mcpServers 는 daily 에 분해 정보 없어 재구성 불가.
//       → 시나리오 C (카드 deprecate) 또는 B (codeburn fork) 필요.
//
// 자세한 분석: docs/internal/f3-feasibility.md.

export interface CodeburnDailyRow {
  date?: string;
  cost?: number;
  calls?: number;
}

export interface PeriodOverviewPartial {
  cost: number;
  calls: number;
}

/**
 * codeburn daily[] 를 입력 받아 cost / calls 합산을 돌려준다.
 * 빈 input 또는 null 안전.
 */
export function recomputeOverviewFromDaily(daily: CodeburnDailyRow[] | undefined | null): PeriodOverviewPartial {
  if (!Array.isArray(daily) || daily.length === 0) {
    return { cost: 0, calls: 0 };
  }
  let cost = 0;
  let calls = 0;
  for (const row of daily) {
    cost += typeof row.cost === "number" ? row.cost : 0;
    calls += typeof row.calls === "number" ? row.calls : 0;
  }
  return { cost, calls };
}

/**
 * 지정 date range (start ≤ d ≤ end, YYYY-MM-DD) 의 daily row 만 합산.
 * F3 시나리오 A 의 부분 활용 — all.daily 받아 today/week/month/30days 구간 잘라내기.
 */
export function recomputeOverviewForRange(
  daily: CodeburnDailyRow[] | undefined | null,
  startDate: string,
  endDate: string,
): PeriodOverviewPartial {
  if (!Array.isArray(daily) || daily.length === 0) {
    return { cost: 0, calls: 0 };
  }
  const filtered = daily.filter((row) => {
    if (typeof row.date !== "string") return false;
    return row.date >= startDate && row.date <= endDate;
  });
  return recomputeOverviewFromDaily(filtered);
}

/**
 * 재집계 결과 vs 기존 overview 의 diff.
 * F3 진행 결정에 사용. 미세 (< 0.1%) 면 sub-phase 4c 진입 가능 신호.
 */
export interface OverviewDiff {
  costAbs: number;
  costRelative: number;
  callsAbs: number;
  callsRelative: number;
}

export function compareOverview(recomputed: PeriodOverviewPartial, original: PeriodOverviewPartial): OverviewDiff {
  const costAbs = Math.abs(recomputed.cost - original.cost);
  const callsAbs = Math.abs(recomputed.calls - original.calls);
  return {
    costAbs,
    costRelative: original.cost > 0 ? costAbs / original.cost : 0,
    callsAbs,
    callsRelative: original.calls > 0 ? callsAbs / original.calls : 0,
  };
}
