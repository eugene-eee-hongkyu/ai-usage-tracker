// Codex (OpenAI) plan tier — Claude 와 독립. users.codex_plan_tier 컬럼에 저장.
// 2026-05-30: Phase 2. Anthropic 의 PlanTier 와 별개 module — 키 충돌 (pro, team) 회피.
// 가격·한도는 OpenAI 가 자주 조정 → 사용자에게 OpenAI billing 페이지 안내가 정확.
// 여기서는 modal 옵션 + UI 표시용 라벨 / 가격만 박음. AI 추정 없음 (Phase 1 결정).

import type { PlanLimits } from "./plan-health";

// Free 는 의도적으로 제외 (2026-05-30 사용자 결정) — ChatGPT Free 는 Codex CLI 사용 불가.
export type CodexPlanTier =
  | "plus"
  | "business"
  | "pro"
  | "team"
  | "enterprise"
  | "api";

export const CODEX_PLAN_LIMITS: Record<CodexPlanTier, PlanLimits> = {
  plus:       { tier: "plus",       label: "ChatGPT Plus",        monthlyPriceUsd: 20,  estimated5hTokenLimit: 0 },
  business:   { tier: "business",   label: "ChatGPT Business",    monthlyPriceUsd: 30,  estimated5hTokenLimit: 0 },
  pro:        { tier: "pro",        label: "ChatGPT Pro",         monthlyPriceUsd: 200, estimated5hTokenLimit: 0 },
  team:       { tier: "team",       label: "ChatGPT Team",        monthlyPriceUsd: 30,  estimated5hTokenLimit: 0 },
  // Enterprise 는 협의 가격. 추정 $200 (사용자 결정 2026-05-30).
  enterprise: { tier: "enterprise", label: "Enterprise (협의)",   monthlyPriceUsd: 200, estimated5hTokenLimit: 0 },
  // OpenAI API — PAYG, 요금제 없음. Claude API 와 동일 패턴 (한도 평가 N/A).
  api:        { tier: "api",        label: "OpenAI API",          monthlyPriceUsd: 0,   estimated5hTokenLimit: 0 },
};

export const VALID_CODEX_TIERS: CodexPlanTier[] = [
  "plus", "business", "pro", "team", "enterprise", "api",
];

export function getCodexPlanLimits(tier: CodexPlanTier): PlanLimits {
  return CODEX_PLAN_LIMITS[tier];
}

export function isValidCodexTier(value: unknown): value is CodexPlanTier {
  return typeof value === "string" && (VALID_CODEX_TIERS as string[]).includes(value);
}
