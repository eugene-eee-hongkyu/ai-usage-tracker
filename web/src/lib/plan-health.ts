// Plan Health — Claude Code 사용자/팀의 plan tier 적정성 진단.
// ccusage 5h 블록 (user_blocks 테이블) token 분포를 P90 으로 산출해
// 커뮤니티 추정 한도와 비교 후 4단계 권장.
//
// 데이터 source: user_blocks (5h ccusage 블록).
// LLM 호출 없음 — deterministic 룰.
//
// 한도 추정치는 Claude-Code-Usage-Monitor (Maciek-roboblog) 커뮤니티 분석
// 기반. Anthropic 공식 공개 X → 추정. 사용자에게 "추정" 명시 필요.

export type PlanTier = "pro" | "max5" | "max20" | "team_standard" | "team_premium" | "team" | "api" | null;

// PlanLimits — Claude / Codex 공용 구조. tier 는 string 으로 generic (Claude 는
// PLAN_LIMITS 키, Codex 는 CODEX_PLAN_LIMITS 키 — 충돌 없는 별도 lookup table).
export interface PlanLimits {
  tier: string;
  label: string;
  monthlyPriceUsd: number;
  // 5h 블록당 추정 token 한도. Codex 는 0 (한도 추정 안 함).
  estimated5hTokenLimit: number;
}

// 커뮤니티 추정. Anthropic 한도는 비공개 + 시간에 따라 조정됨.
// 2026-05 doubled 반영. Team 은 Standard / Premium 두 단계 (Anthropic 공식).
//   Team Standard \$25/mo (연 \$20): Pro 와 동일 사용량 + SAML/SSO + 협업
//   Team Premium  \$125/mo (연 \$100): Standard 의 5× 사용량 + Claude Code 포함
// 정확도 한계 — 사용자에게 "추정" 명시.
const PLAN_LIMITS: Record<Exclude<PlanTier, null>, PlanLimits> = {
  pro:           { tier: "pro",           label: "Pro",          monthlyPriceUsd: 20,  estimated5hTokenLimit: 44_000 },
  max5:          { tier: "max5",          label: "Max 5x",       monthlyPriceUsd: 100, estimated5hTokenLimit: 88_000 },
  max20:         { tier: "max20",         label: "Max 20x",      monthlyPriceUsd: 200, estimated5hTokenLimit: 220_000 },
  team_standard: { tier: "team_standard", label: "Team Standard", monthlyPriceUsd: 25,  estimated5hTokenLimit: 44_000 },  // Pro 동일 사용량
  team_premium:  { tier: "team_premium",  label: "Team Premium",  monthlyPriceUsd: 125, estimated5hTokenLimit: 220_000 }, // Standard × 5
  team:          { tier: "team",          label: "Team (legacy)", monthlyPriceUsd: 30,  estimated5hTokenLimit: 88_000 },  // 기존 입력 호환
  api:           { tier: "api",           label: "API",          monthlyPriceUsd: 0,   estimated5hTokenLimit: 0 }, // API는 종량제, 한도 X
};

export function getPlanLimits(tier: Exclude<PlanTier, null>): PlanLimits {
  return PLAN_LIMITS[tier];
}

export function getAllPlanLimits(): PlanLimits[] {
  return Object.values(PLAN_LIMITS);
}

export interface BlockSample {
  totalTokens: number;
  startedAt: Date | string;
}

// P90 (90 percentile) 계산. 빈 배열이면 0 반환.
export function calculateP90(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(Math.floor(sorted.length * 0.9), sorted.length - 1);
  return sorted[idx];
}

// AI 자동 추정 (estimateTierFromP90 / estimateTierFromMonthlyCost / maxTierEstimate) 은
// 2026-05-30 사용자 결정으로 완전 제거. cache leverage 가 사용자별 5×~100× 다양해서
// cost-only 추정은 본질적으로 부정확했고, 5h cap 단위가 비공개라 P90 추정도 단위 불일치.
// 정책: 사용자가 직접 plan 입력. 미입력이면 dashboard / usage-hero 가 modal 강제 표시.
// 정확한 가격·한도는 Anthropic billing (Claude) / OpenAI billing (Codex) 외부 페이지로 안내.

export type Verdict =
  | "downgrade"   // 입력 plan 대비 사용량 낮음 — 한 단계 아래 검토
  | "fit"          // 적정
  | "tight"        // 여유 적음 — 곧 업그레이드 검토
  | "over"         // 이미 한도 hit — 업그레이드 or 행동 변경
  | "unknown";     // 데이터 부족

export interface PlanHealthInput {
  blocks: BlockSample[];
  // 2026-05-30 Phase 2: declaredTier (Claude PlanTier 한정) → declaredLimits (provider-agnostic).
  // caller 가 provider 따라 PLAN_LIMITS / CODEX_PLAN_LIMITS 에서 직접 lookup 후 전달.
  // null = 사용자 미입력 (modal 강제 흐름).
  declaredLimits: PlanLimits | null;
  // tier 식별자 (응답 평탄화용). label 만 쓰는 곳도 있고 'api' 같은 키로 분기하는 곳도 있어 분리 유지.
  declaredTier: string | null;
  cacheHitPct?: number;   // 행동 변경 vs plan 변경 분기용
  oneShotRate?: number;
  // 분석 윈도우 — 기본 최근 30일
  windowDays?: number;
  // 월 API 환산 비용 ($) — cost-based verdict 의 핵심 신호.
  monthlyCostUsd?: number;
}

export interface PlanHealthResult {
  // 2026-05-30: estimatedTier 응답 필드 제거 (자동 추정 폐기). 사용자 입력 기준만.
  p90Tokens: number;
  blockCount: number;            // 윈도우 안의 5h 블록 수 (데이터 충분성 지표)
  activeDays: number;             // 윈도우 안의 활성 일수

  // 사용자 명시 tier 대비 평가 (declaredLimits 있을 때만 의미 있음)
  declaredTier: string | null;     // 키 (응답 직렬화용 — 카드 분기에서 'api' 같은 키 사용)
  declaredLimits: PlanLimits | null;
  utilizationPct: number;        // p90 / declared limit (declaredLimits 없으면 0)
  hitCount: number;               // p90 ≥ 한도 인 블록 수
  verdict: Verdict;
  // recommendedTier — Claude 에서 downgrade 분기 시 nextTierDown 결과. Codex 는
  // null (다운그레이드 추천 안 함, 사용자가 OpenAI billing 직접 확인).
  recommendedTier: string | null;
  recommendedSavingsUsd: number;  // 권장 적용 시 월 절감액 (음수면 추가 비용)

  // 행동 변경 vs plan 변경 분기 메시지
  actionFirst: boolean;           // true 이면 plan 업 전에 행동 변경 권장
  reasoning: string[];            // 사람용 근거 한 줄들

  // Plan 활용률 (월간) — 진우님 "월 요금제 뽕뽑기" 응답.
  //   = total tokens in window / (5h limit × activeDays)
  // hero "Plan 활용률" 카드 + Plan Health 카드 둘 다에서 사용.
  // declaredTier 없으면 null. API tier 도 null (한도 X).
  activationPct: number | null;
  totalWindowTokens: number;      // 윈도우 안 5h 블록 token 합
}

// 최근 N일 블록만 필터. days >= 1 가정.
function filterRecent(blocks: BlockSample[], windowDays: number, now = new Date()): BlockSample[] {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - windowDays);
  return blocks.filter((b) => {
    const d = typeof b.startedAt === "string" ? new Date(b.startedAt) : b.startedAt;
    return d >= cutoff;
  });
}

function uniqueDayCount(blocks: BlockSample[]): number {
  const days = new Set<string>();
  for (const b of blocks) {
    const d = typeof b.startedAt === "string" ? new Date(b.startedAt) : b.startedAt;
    days.add(d.toISOString().slice(0, 10));
  }
  return days.size;
}

export function analyzePlanHealth(input: PlanHealthInput): PlanHealthResult {
  const windowDays = input.windowDays ?? 30;
  const recent = filterRecent(input.blocks, windowDays);
  const tokens = recent.map((b) => b.totalTokens).filter((n) => n > 0);
  const p90 = calculateP90(tokens);
  const blockCount = recent.length;
  const activeDays = uniqueDayCount(recent);

  const declaredTier = input.declaredTier;
  const declaredLimits = input.declaredLimits;

  // 윈도우 안 총 토큰 (활용률 계산 + hero card 표시용)
  const totalWindowTokens = tokens.reduce((s, t) => s + t, 0);

  // Plan 활용률 = 실제 사용 / (한도 × 활성일).
  // 활성일 0 또는 한도 0(api) 또는 declaredTier 없으면 null.
  let activationPct: number | null = null;
  if (declaredLimits && declaredLimits.estimated5hTokenLimit > 0 && activeDays > 0) {
    const possibleTokens = declaredLimits.estimated5hTokenLimit * activeDays;
    activationPct = Math.round((totalWindowTokens / possibleTokens) * 100);
  }

  // 데이터 부족 처리 — 활성일 7일 미만이면 unknown verdict
  const dataInsufficient = activeDays < 7;

  let utilizationPct = 0;
  let hitCount = 0;
  let verdict: Verdict = "unknown";
  let recommendedTier: string | null = declaredTier;
  let recommendedSavingsUsd = 0;
  // actionFirst 는 cost-based 로직에서 더 이상 사용 안 함 — 항상 false.
  // (과거: cache_hit / one_shot 낮을 때 plan 업그레이드 전 행동 개선 권장)
  const actionFirst = false;
  const reasoning: string[] = [];

  if (dataInsufficient) {
    reasoning.push(`데이터 부족 — 최근 ${windowDays}일 중 활성일 ${activeDays}일 (권장 7일 이상)`);
    return {
      p90Tokens: p90,
      blockCount,
      activeDays,
      declaredTier,
      declaredLimits,
      utilizationPct: 0,
      hitCount: 0,
      verdict: "unknown",
      recommendedTier: declaredTier,
      recommendedSavingsUsd: 0,
      actionFirst: false,
      reasoning,
      activationPct: null,
      totalWindowTokens,
    };
  }

  if (!declaredLimits) {
    // 사용자가 tier 입력 안 함 — 정책상 modal 강제이므로 본 분기는 잠시의 transient 상태.
    // 추정 안 함, verdict unknown.
    reasoning.push("Plan 미입력 — 본인 tier 를 입력해 주세요 (Anthropic billing 페이지에서 확인 가능)");
    return {
      p90Tokens: p90,
      blockCount,
      activeDays,
      declaredTier,
      declaredLimits,
      utilizationPct: 0,
      hitCount: 0,
      verdict: "unknown",
      recommendedTier: null,
      recommendedSavingsUsd: 0,
      actionFirst: false,
      reasoning,
      activationPct: null,
      totalWindowTokens,
    };
  }

  // declared tier 대비 평가 — cost-based.
  // 과거: P90 / 5h 한도 비교 (utilizationPct, hitCount). 그러나 ccusage
  // totalTokens 는 cache_read 포함이고 community-estimated 5h 한도는 단위
  // 불명확 (Anthropic 미공개) → 사과·오렌지 비교로 99,821% 같은 비현실 수치.
  //
  // 현재: 월 API 환산 비용 (ccusage cost, 명확한 단위) vs Plan 가격 의
  // ratio 로 판단.
  //   ratio < 0.5  → downgrade 가능 (사용량 낮음, Plan 과대)
  //   ratio 0.5~2 → fit (적정)
  //   ratio 2~10  → tight 라벨 재활용: "Plan 잘 활용" (절감 효과 큼)
  //   ratio > 10  → over 라벨 재활용: "Power User" (Plan 매우 잘 활용)
  // 업그레이드 추천은 안 함 — Anthropic 의 실제 5h cap 단위가 미공개라
  // "한도 도달" 판단 불가능. cap 도달 신호는 별도 source (rate limit
  // hit log 등) 필요. 현재는 downgrade 만 actionable.
  const planPrice = declaredLimits.monthlyPriceUsd;
  const monthlyCost = input.monthlyCostUsd ?? 0;
  // utilizationPct 의미 변경 — 'Plan price 대비 API 환산 비용 %'.
  utilizationPct = planPrice > 0 ? Math.round((monthlyCost / planPrice) * 100) : 0;
  hitCount = 0; // 더 이상 사용 안 함 (cap hit 측정 불가)

  if (planPrice === 0) {
    // api tier — 한도 없음. plan health 평가 N/A.
    reasoning.push("API 종량제 — Plan ROI 평가 N/A.");
    verdict = "fit";
    recommendedTier = declaredTier;
  } else {
    const ratio = monthlyCost / planPrice;
    const costFmt = `$${Math.round(monthlyCost)}`;
    const planFmt = `$${planPrice}/월`;

    if (ratio < 0.5) {
      verdict = "downgrade";
      // nextTierDown 는 Claude PlanTier 키만 인식 — Codex tier 이면 null 반환 →
      // recommendedTier = declaredTier 유지 (Codex 는 자동 다운그레이드 추천 없음).
      const down = nextTierDown(declaredTier as PlanTier);
      if (down) {
        recommendedTier = down;
        recommendedSavingsUsd = planPrice - PLAN_LIMITS[down].monthlyPriceUsd;
        reasoning.push(`월 API 환산 ${costFmt} — ${declaredLimits.label} ${planFmt} 의 ${utilizationPct}% (사용량 낮음)`);
        reasoning.push(`${PLAN_LIMITS[down].label} 다운그레이드 가능, 월 $${recommendedSavingsUsd} 절감`);
      } else {
        recommendedTier = declaredTier;
        reasoning.push(`월 API 환산 ${costFmt} — ${declaredLimits.label} ${planFmt} 의 ${utilizationPct}% (사용량 낮음)`);
      }
    } else if (ratio <= 2) {
      verdict = "fit";
      recommendedTier = declaredTier;
      reasoning.push(`월 API 환산 ${costFmt} — ${declaredLimits.label} ${planFmt} 의 ${utilizationPct}% (적정)`);
    } else if (ratio <= 10) {
      // 기존 'tight' 라벨 재활용 → "Plan 잘 활용" 의미. 권장 변경 없음.
      verdict = "tight";
      recommendedTier = declaredTier;
      reasoning.push(`월 API 환산 ${costFmt} — ${declaredLimits.label} ${planFmt} 의 ${utilizationPct}% (Plan 잘 활용)`);
    } else {
      // ratio > 10 — extreme power user. 'over' 라벨 재활용 → "Power User".
      verdict = "over";
      recommendedTier = declaredTier;
      reasoning.push(`월 API 환산 ${costFmt} — ${declaredLimits.label} ${planFmt} 의 ${utilizationPct}% (Power User)`);
    }
  }

  return {
    p90Tokens: p90,
    blockCount,
    activeDays,
    declaredTier,
    declaredLimits,
    utilizationPct,
    hitCount,
    verdict,
    recommendedTier,
    recommendedSavingsUsd,
    actionFirst,
    reasoning,
    activationPct,
    totalWindowTokens,
  };
}

// cost-based 로직에서는 업그레이드 추천 안 함 (5h cap 단위 미공개). 함수는
// 추후 cap 측정 가능해질 때 복귀 대비 유지. eslint suppress.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function nextTierUp(tier: PlanTier): Exclude<PlanTier, null> | null {
  if (tier === "pro") return "max5";
  if (tier === "max5") return "max20";
  if (tier === "team_standard") return "team_premium";
  if (tier === "team") return "max20";
  return null;
}

function nextTierDown(tier: PlanTier): Exclude<PlanTier, null> | null {
  if (tier === "max20") return "max5";
  if (tier === "max5") return "pro";
  if (tier === "team_premium") return "team_standard";
  if (tier === "team") return "pro";
  return null;
}

// 팀 종합 — 멤버별 plan health 를 받아 권장 분포 / 절감액 계산
export interface TeamMemberPlan {
  userId: number;
  name: string;
  declaredTier: string | null;
  recommendedTier: string | null;
  monthlyCostNowUsd: number;
  monthlyCostRecommendedUsd: number;
  verdict: Verdict;
  actionFirst: boolean;
  // verdict 근거 숫자 — UI 에서 "왜 이 평가인가" 설명 inline 표시.
  utilizationPct: number;     // P90 / 한도 (declaredTier 없으면 0)
  hitCount: number;            // 한도 도달한 5h 블록 수
}

export interface TeamPlanSummary {
  members: TeamMemberPlan[];
  currentDistribution: Record<string, number>;     // tier → count
  recommendedDistribution: Record<string, number>;
  currentMonthlyCostUsd: number;
  recommendedMonthlyCostUsd: number;
  monthlySavingsUsd: number;
  actionFirstCount: number; // 행동 변경 우선 권장 멤버 수
}

export function summarizeTeamPlans(members: Array<{
  userId: number;
  name: string;
  health: PlanHealthResult;
}>): TeamPlanSummary {
  const memberRows: TeamMemberPlan[] = [];
  const currentDist: Record<string, number> = {};
  const recDist: Record<string, number> = {};
  let currentCost = 0;
  let recCost = 0;
  let actionFirstCount = 0;

  for (const m of members) {
    const h = m.health;
    const declared = h.declaredTier;
    const recommended = h.recommendedTier;
    // 2026-05-30 Phase 2: declaredLimits 직접 사용 (provider-agnostic). recommended ≠ declared
    // 인 경우만 별도 lookup (Claude downgrade 분기 — Codex 는 항상 같아 lookup 안 함).
    const currentCostMember =
      h.declaredLimits && h.declaredLimits.tier !== "api"
        ? h.declaredLimits.monthlyPriceUsd : 0;
    let recCostMember = currentCostMember;
    if (recommended && recommended !== declared) {
      const recLimits = (PLAN_LIMITS as Record<string, PlanLimits>)[recommended];
      recCostMember = recLimits && recLimits.tier !== "api" ? recLimits.monthlyPriceUsd : 0;
    }

    memberRows.push({
      userId: m.userId,
      name: m.name,
      declaredTier: declared,
      recommendedTier: recommended,
      monthlyCostNowUsd: currentCostMember,
      monthlyCostRecommendedUsd: recCostMember,
      verdict: h.verdict,
      actionFirst: h.actionFirst,
      utilizationPct: h.utilizationPct,
      hitCount: h.hitCount,
    });

    // 분포는 추정값 포함 (현황 파악 위해).
    const declaredKey = declared ?? "unknown";
    const recKey = recommended ?? "unknown";
    currentDist[declaredKey] = (currentDist[declaredKey] ?? 0) + 1;
    recDist[recKey] = (recDist[recKey] ?? 0) + 1;
    currentCost += currentCostMember;
    recCost += recCostMember;
    if (h.actionFirst) actionFirstCount += 1;
  }

  return {
    members: memberRows,
    currentDistribution: currentDist,
    recommendedDistribution: recDist,
    currentMonthlyCostUsd: currentCost,
    recommendedMonthlyCostUsd: recCost,
    monthlySavingsUsd: currentCost - recCost,
    actionFirstCount,
  };
}
