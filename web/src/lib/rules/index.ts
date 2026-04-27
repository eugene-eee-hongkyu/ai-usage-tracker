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
