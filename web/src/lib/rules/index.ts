// efficiencyScore = oneShotRate × (cacheHit/100) × outputInputRatio / costPerCall
export function computeEfficiencyScore(
  overallOneShot: number,   // 0–1
  cacheHitPct: number,      // 0–100
  totalCost: number,
  sessionsCount: number,
  callsCount: number,
  outputInputRatio: number  // tOutput / tInput
): number {
  if (sessionsCount === 0 || totalCost === 0) return 0;
  const denom = callsCount > 0 ? callsCount : sessionsCount;
  const costPerCall = totalCost / denom;
  if (costPerCall === 0) return 0;
  const oiRatio = outputInputRatio > 0 ? outputInputRatio : 1;
  return Math.round((overallOneShot * (cacheHitPct / 100) * oiRatio) / costPerCall);
}

// Token volume 10단계 (0-30 점). 외부 anchor 3개 정렬:
//   - 단계 3 (≤8M, ~$6/day) = Anthropic 평균 사용자
//   - 단계 4 (≤15M, ~$12/day) = Anthropic P90 (개인)
//   - 단계 6 (≤40M, ~$30/day) = Anthropic enterprise active P90
// Verdent (light/medium/heavy 범위) + Power user 8개월 케이스 (10B/8mo ≈ 41M/day) 로
// 보간/검증. Total tokens 기준 (cache reads 포함) — Claude Code 특성상 90%+ 가 cache.
export function computeTokenLevel(totalTokensPerDay: number): number {
  if (totalTokensPerDay <= 0) return 0;
  if (totalTokensPerDay <= 1_000_000) return 1;
  if (totalTokensPerDay <= 3_000_000) return 2;
  if (totalTokensPerDay <= 8_000_000) return 3;      // Anthropic median anchor
  if (totalTokensPerDay <= 15_000_000) return 4;     // Anthropic P90 (light) anchor
  if (totalTokensPerDay <= 25_000_000) return 5;
  if (totalTokensPerDay <= 40_000_000) return 6;     // Anthropic enterprise P90 anchor
  if (totalTokensPerDay <= 80_000_000) return 7;
  if (totalTokensPerDay <= 150_000_000) return 8;
  if (totalTokensPerDay <= 300_000_000) return 9;
  return 10;
}

// 일일 효율 점수 (0-100). 4 signal: cache, one-shot, cost, token volume.
// cache 42 + one-shot 18 + cost 10 + token 30 = 100
//   - 효율 70%: cache (infra) + one-shot (skill) + cost (guardrail)
//   - 사용량 30%: token volume — Claude 사용 자체 격려 (안 쓰면 점수 낮음)
// 이전 비율 (60:25:15 = 4:1.67:1) 유지하면서 70% 로 압축 후 token 30% 추가.
export function computeDailyEfficiencyScore(
  cacheHitPct: number,         // 0..100
  costPerCall: number,         // USD
  oneShotRate: number | null,  // 0..100 (codeburn) or null
  totalTokensPerDay: number    // 총 토큰 (cache reads 포함)
): number {
  // Cache: 60% → 0, 96% → 1, linear (Anthropic 본사 SEV 기준 96%+)
  const cacheNorm = Math.max(0, Math.min(1, (cacheHitPct - 60) / (96 - 60)));
  // Cost: $0.40 → 0, $0.06 → 1, linear (역방향 — 낮을수록 좋음)
  const costNorm = Math.max(0, Math.min(1, (0.40 - costPerCall) / (0.40 - 0.06)));
  // Token: 10단계 → 0..1
  const tokenNorm = computeTokenLevel(totalTokensPerDay) / 10;

  if (oneShotRate == null) {
    // Fallback: oneShot 비율을 cache 와 cost 에 비례 분배.
    // cache: 42 + 18 * (42/(42+10)) ≈ 56.5
    // cost:  10 + 18 * (10/(42+10)) ≈ 13.5
    return Math.round(cacheNorm * 56.5 + costNorm * 13.5 + tokenNorm * 30);
  }

  const oneShotNorm = Math.max(0, Math.min(1, oneShotRate / 100));
  return Math.round(cacheNorm * 42 + oneShotNorm * 18 + costNorm * 10 + tokenNorm * 30);
}

// Power Index — 사용자가 얼마나 파워풀하게 쓰는가. 객관 측정.
// product analytics 표준 (Frequency + Depth) 기반. Breadth 차원은 Claude Code
// 특성상 변별력 낮아 제외 (4명 인터뷰에서도 도구 다양성 언급 X).
// 항상 30일 anchor — Plan Health 와 같은 윈도우. 장기 패턴 지표 성격이라
// period 따라 흔들리지 않게 고정.
//
// 가중치: 활성일 40 + token level 60 = 100
//   Frequency (40점) = min(1, activeDays / 23) × 40
//   Depth     (60점) = computeTokenLevel(avgDailyTokens) × 6
//
// 23일 분모: 평일 ≈ 30일 × (5/7) = 21.4 + 약간의 야근/주말 작업 = 23.
// 30일을 만점 기준으로 잡으면 주말까지 일해야 만점이 나와서 불합리.
// 23일 이상은 모두 40점 만점 (cap) — 더 일한 사람은 별도 badge 로 표현.
//
// 사용자 1번 답 ("그냥 사용량으로 점수 주면 되지 캐시·원샷 빼고") 반영.
// 인터뷰 4/4 일치: "사용량/cost 만 본다, 효율 점수는 약하다".
export const POWER_FREQUENCY_TARGET_DAYS = 23;
export const POWER_HARDWORKER_THRESHOLD_DAYS = 27;

export function computePowerIndex(
  activeDays: number,      // 최근 30일 중 활성일 수 (0~30)
  avgDailyTokens: number,  // 활성일 평균 일 token (cache reads 포함)
): number {
  const frequency = Math.min(1, activeDays / POWER_FREQUENCY_TARGET_DAYS) * 40;
  const depth = computeTokenLevel(avgDailyTokens) * 6;
  return Math.round(frequency + depth);
}

export function generateMvpBlurb(
  name: string,
  project: string,
  cacheHitPct: number,
  costPerSession: number
): string {
  if (cacheHitPct >= 90 && costPerSession < 30) {
    return `${name}님이 ${project}에서 캐시 ${Math.round(cacheHitPct)}%·세션당 $${costPerSession.toFixed(0)}으로 효율적으로 끝냈어요`;
  }
  if (cacheHitPct >= 80) {
    return `${name}님이 ${project}에서 캐시를 잘 활용했어요`;
  }
  return `${name}님이 오늘 열심히 달렸어요`;
}
