export interface SessionStats {
  totalTokens: number;
  totalCost: number;
  sessionsCount: number;
  oneShotEdits: number;
  totalEdits: number;
  cacheRead: number;
  cacheWrite: number;
  opusTokens: number;
  sonnetTokens: number;
  haikuTokens: number;
  avgRetries: number; // average tool retries per session
  activeHours: number; // distinct hours with activity in last 5h windows
}

export interface Suggestion {
  type:
    | "cache_hit"
    | "opus_heavy"
    | "high_retry"
    | "low_utilization"
    | "mcp_unused";
  title: string;
  detail: string;
  estimatedSavingUsd?: number;
  confidence: "low" | "medium" | "high";
}

export function generateSuggestions(stats: SessionStats): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Rule 1: Cache hit rate (confidence: low — indirect signal)
  const totalCacheable = stats.cacheRead + stats.cacheWrite;
  const cacheHitRate =
    totalCacheable > 0 ? stats.cacheRead / totalCacheable : 0;
  if (cacheHitRate < 0.5 && stats.sessionsCount >= 3) {
    const saving = stats.totalCost * 0.15;
    suggestions.push({
      type: "cache_hit",
      title: `Cache hit ${Math.round(cacheHitRate * 100)}% — CLAUDE.md 다이어트 권장`,
      detail: `CLAUDE.md를 5KB 이하로 줄이면 캐시 적중률이 올라갑니다. 예상 절감 $${saving.toFixed(2)}/월`,
      estimatedSavingUsd: saving,
      confidence: "low",
    });
  }

  // Rule 2: Opus heavy (confidence: high — direct cost signal)
  if (stats.totalTokens > 0) {
    const opusRatio = stats.opusTokens / stats.totalTokens;
    if (opusRatio > 0.3) {
      const saving = stats.totalCost * opusRatio * 0.7;
      suggestions.push({
        type: "opus_heavy",
        title: `Opus 비중 ${Math.round(opusRatio * 100)}% — Sonnet 전환 권장`,
        detail: `대부분 작업은 Sonnet으로 충분합니다. 예상 절감 $${saving.toFixed(2)}/월`,
        estimatedSavingUsd: saving,
        confidence: "high",
      });
    }
  }

  // Rule 3: High retry rate (confidence: low — proxy metric)
  if (stats.avgRetries > 2.5 && stats.sessionsCount >= 3) {
    suggestions.push({
      type: "high_retry",
      title: `평균 retry ${stats.avgRetries.toFixed(1)}회 — 프롬프트 명확도 개선 권장`,
      detail: `재시도가 많으면 컨텍스트 설명이 부족한 경우가 많습니다.`,
      confidence: "low",
    });
  }

  // Rule 4: 5h window utilization (confidence: high — direct metric)
  const utilization5h =
    stats.sessionsCount > 0 ? stats.activeHours / (stats.sessionsCount * 5) : 0;
  if (utilization5h < 0.3 && stats.sessionsCount >= 5) {
    suggestions.push({
      type: "low_utilization",
      title: `5h 활용률 ${Math.round(utilization5h * 100)}% — 세션 집중도 개선 권장`,
      detail: `Claude Code 세션을 더 집중적으로 사용하면 요금제 효율이 올라갑니다.`,
      confidence: "high",
    });
  }

  // Rule 5: MCP unused (confidence: high — binary check)
  // Placeholder: if no MCP tool calls detected in recent sessions
  if (stats.sessionsCount >= 5 && suggestions.length < 5) {
    suggestions.push({
      type: "mcp_unused",
      title: "MCP 서버 미사용 — Browser/DB 도구 연동 권장",
      detail: "Playwright MCP, DB MCP 등을 연결하면 반복 작업을 자동화할 수 있습니다.",
      confidence: "high",
    });
  }

  return suggestions.slice(0, 5);
}

export function computeTodayMvpScore(
  tokens: number,
  oneShotRate: number
): number {
  return tokens * (oneShotRate / 100);
}

export function generateMvpBlurb(
  name: string,
  project: string,
  oneShotRate: number
): string {
  if (oneShotRate >= 90) {
    return `${name}님이 ${project}에서 one-shot ${oneShotRate}%로 깔끔하게 끝냈어요`;
  }
  if (oneShotRate >= 75) {
    return `${name}님이 ${project}에서 착실하게 진행했어요`;
  }
  return `${name}님이 오늘 열심히 달렸어요`;
}
