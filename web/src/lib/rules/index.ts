// efficiencyScore = overallOneShot × cacheHitPct / (totalCost / sessionsCount)
export function computeEfficiencyScore(
  overallOneShot: number,
  cacheHitPct: number,
  totalCost: number,
  sessionsCount: number
): number {
  if (sessionsCount === 0 || totalCost === 0) return 0;
  const costPerSession = totalCost / sessionsCount;
  return Math.round((overallOneShot * cacheHitPct) / costPerSession);
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
