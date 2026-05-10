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

// 일일 효율 점수 (0-100). 세 signal: cache hit, one-shot rate, cost/call.
// 정상: cache 60 + one-shot 25 + cost 15.
//   - cache: infrastructure (Anthropic SEV 기준 96%+ → 만점)
//   - one-shot: skill (clear instructions → 첫 시도 성공)
//   - cost: cost guardrail ($0.40+/call = 망가진 패턴)
// oneShotRate=null fallback (codeburn 0.9.7 또는 chat-only day): cache 85 + cost 15
// — 이전 공식 그대로 보존, regression 0.
export function computeDailyEfficiencyScore(
  cacheHitPct: number,       // 0..100
  costPerCall: number,       // USD
  oneShotRate: number | null // 0..100 (codeburn) or null
): number {
  // Cache: 60% → 0, 96% → 1, linear
  const cacheNorm = Math.max(0, Math.min(1, (cacheHitPct - 60) / (96 - 60)));
  // Cost: $0.40 → 0, $0.06 → 1, linear (역방향 — 낮을수록 좋음)
  const costNorm = Math.max(0, Math.min(1, (0.40 - costPerCall) / (0.40 - 0.06)));

  if (oneShotRate == null) {
    // Fallback: 기존 공식 정확히 보존 (cache 85 + cost 15)
    return Math.round(cacheNorm * 85 + costNorm * 15);
  }

  // One-shot: 0% → 0, 100% → 1
  const oneShotNorm = Math.max(0, Math.min(1, oneShotRate / 100));
  return Math.round(cacheNorm * 60 + oneShotNorm * 25 + costNorm * 15);
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
