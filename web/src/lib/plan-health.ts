// Plan Health — Claude Code 사용자/팀의 plan tier 적정성 진단.
// ccusage 5h 블록 (user_blocks 테이블) token 분포를 P90 으로 산출해
// 커뮤니티 추정 한도와 비교 후 4단계 권장.
//
// 데이터 source: user_blocks (5h ccusage 블록).
// LLM 호출 없음 — deterministic 룰.
//
// 한도 추정치는 Claude-Code-Usage-Monitor (Maciek-roboblog) 커뮤니티 분석
// 기반. Anthropic 공식 공개 X → 추정. 사용자에게 "추정" 명시 필요.

export type PlanTier = "pro" | "max5" | "max20" | "team" | "api" | null;

export interface PlanLimits {
  tier: Exclude<PlanTier, null>;
  label: string;
  monthlyPriceUsd: number;
  // 5h 블록당 추정 token 한도. 커뮤니티 P90 기반.
  estimated5hTokenLimit: number;
}

// 커뮤니티 추정. Anthropic 한도는 비공개 + 시간에 따라 조정됨.
// 2026-05 doubled 반영. 정확도 한계 — 사용자에게 "추정" 명시.
const PLAN_LIMITS: Record<Exclude<PlanTier, null>, PlanLimits> = {
  pro:   { tier: "pro",   label: "Pro",     monthlyPriceUsd: 20,  estimated5hTokenLimit: 44_000 },
  max5:  { tier: "max5",  label: "Max 5x",  monthlyPriceUsd: 100, estimated5hTokenLimit: 88_000 },
  max20: { tier: "max20", label: "Max 20x", monthlyPriceUsd: 200, estimated5hTokenLimit: 220_000 },
  team:  { tier: "team",  label: "Team",    monthlyPriceUsd: 30,  estimated5hTokenLimit: 88_000 },
  api:   { tier: "api",   label: "API",     monthlyPriceUsd: 0,   estimated5hTokenLimit: 0 }, // API는 종량제, 한도 X
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

// P90 token 으로 tier 자동 추정. 커뮤니티 한도 boundaries 사용.
export function estimateTierFromP90(p90Tokens: number): Exclude<PlanTier, null> | "unknown" {
  if (p90Tokens === 0) return "unknown";
  // P90 이 한도의 80% 넘으면 그 tier 적정. 80% 미만이면 한 단계 아래도 가능.
  if (p90Tokens <= PLAN_LIMITS.pro.estimated5hTokenLimit * 0.8) return "pro";
  if (p90Tokens <= PLAN_LIMITS.max5.estimated5hTokenLimit * 0.8) return "max5";
  return "max20";
}

// API 환산 cost 로 tier 추정. cache leverage 가 사용자별 5×~100× 다양해서
// cost-only 추정은 본질적으로 부정확. 보수적 임계 (Pro 가입자도 cache 잘
// 쓰면 cost 수백 \$ 만들 수 있음) — 사용자 피드백 (<REDACTED> Pro \$176/월) 반영.
//   ≥ \$500: max20 (cache 100× leverage 가정해도 max20 가입자 신호 강함)
//   ≥ \$200: max5  (plan price 2× 본전)
//   그 외   : pro  (보수적 default)
// 본인 입력 modal 강력 유도 (UsageHero) → 추정 부정확 시 사용자가 정정.
export function estimateTierFromMonthlyCost(monthlyCostUsd: number): Exclude<PlanTier, null> | "unknown" {
  if (monthlyCostUsd <= 0) return "unknown";
  if (monthlyCostUsd >= 500) return "max20";
  if (monthlyCostUsd >= 200) return "max5";
  return "pro";
}

// 두 tier 추정 비교 — 더 높은 tier (보수적이지 않은 = 가능성 더 높은) 선택.
// <REDACTED> 같은 max20 사용자가 P90 보수로 max5 추정되는 케이스 보정.
const TIER_RANK: Record<string, number> = {
  unknown: -1, pro: 0, max5: 1, team: 1, max20: 2, api: 3,
};
export function maxTierEstimate(
  a: Exclude<PlanTier, null> | "unknown",
  b: Exclude<PlanTier, null> | "unknown",
): Exclude<PlanTier, null> | "unknown" {
  return (TIER_RANK[a] >= TIER_RANK[b] ? a : b);
}

export type Verdict =
  | "downgrade"   // 입력 plan 대비 사용량 낮음 — 한 단계 아래 검토
  | "fit"          // 적정
  | "tight"        // 여유 적음 — 곧 업그레이드 검토
  | "over"         // 이미 한도 hit — 업그레이드 or 행동 변경
  | "unknown";     // 데이터 부족

export interface PlanHealthInput {
  blocks: BlockSample[];
  declaredTier: PlanTier; // 사용자가 명시한 tier (null 이면 추정만)
  cacheHitPct?: number;   // 행동 변경 vs plan 변경 분기용
  oneShotRate?: number;
  // 분석 윈도우 — 기본 최근 30일
  windowDays?: number;
}

export interface PlanHealthResult {
  // 자동 추정
  estimatedTier: Exclude<PlanTier, null> | "unknown";
  p90Tokens: number;
  blockCount: number;            // 윈도우 안의 5h 블록 수 (데이터 충분성 지표)
  activeDays: number;             // 윈도우 안의 활성 일수

  // 사용자 명시 tier 대비 평가 (declaredTier 있을 때만 의미 있음)
  declaredTier: PlanTier;
  declaredLimits: PlanLimits | null;
  utilizationPct: number;        // p90 / declared limit (declaredTier 없으면 0)
  hitCount: number;               // p90 ≥ 한도 인 블록 수
  verdict: Verdict;
  recommendedTier: PlanTier;      // 권장 tier
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

  const estimatedTier = estimateTierFromP90(p90);

  const declaredTier = input.declaredTier;
  const declaredLimits = declaredTier ? PLAN_LIMITS[declaredTier] : null;

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
  let recommendedTier: PlanTier = declaredTier;
  let recommendedSavingsUsd = 0;
  let actionFirst = false;
  const reasoning: string[] = [];

  if (dataInsufficient) {
    reasoning.push(`데이터 부족 — 최근 ${windowDays}일 중 활성일 ${activeDays}일 (권장 7일 이상)`);
    return {
      estimatedTier,
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
    // 사용자가 tier 입력 안 함 → 자동 추정만 보여줌. verdict 는 unknown.
    reasoning.push(`자동 추정 tier: ${estimatedTier === "unknown" ? "정보 부족" : PLAN_LIMITS[estimatedTier].label}`);
    reasoning.push("본인 tier 를 입력하면 적정성 평가 가능");
    return {
      estimatedTier,
      p90Tokens: p90,
      blockCount,
      activeDays,
      declaredTier,
      declaredLimits,
      utilizationPct: 0,
      hitCount: 0,
      verdict: "unknown",
      recommendedTier: estimatedTier === "unknown" ? null : estimatedTier,
      recommendedSavingsUsd: 0,
      actionFirst: false,
      reasoning,
      activationPct: null,
      totalWindowTokens,
    };
  }

  // declared tier 대비 평가
  const limit = declaredLimits.estimated5hTokenLimit;
  if (limit === 0) {
    // api tier — 한도 없음. plan health 평가 N/A.
    reasoning.push("API 종량제 — 한도 평가 N/A. cost 모니터링은 다른 카드에서 확인.");
    verdict = "fit";
    recommendedTier = declaredTier;
  } else {
    utilizationPct = Math.round((p90 / limit) * 100);
    hitCount = tokens.filter((t) => t >= limit).length;

    if (utilizationPct >= 100 || hitCount >= 3) {
      verdict = "over";
      // 행동 변경 vs plan 변경 분기
      const cache = input.cacheHitPct ?? 100;
      const oneShot = input.oneShotRate ?? 100;
      if (cache < 80) {
        actionFirst = true;
        reasoning.push(`P90 ${p90.toLocaleString()} tokens — ${declaredLimits.label} 한도 (${limit.toLocaleString()}) ${utilizationPct}% 사용 (한도 도달)`);
        reasoning.push(`Cache hit ${cache.toFixed(0)}% (권장 90%+) — cache 개선이 먼저, plan 업그레이드는 그 후 검토`);
        recommendedTier = declaredTier;
      } else if (oneShot < 60) {
        actionFirst = true;
        reasoning.push(`P90 ${p90.toLocaleString()} tokens — ${declaredLimits.label} 한도 ${utilizationPct}% (한도 도달)`);
        reasoning.push(`One-shot ${oneShot.toFixed(0)}% (권장 60%+) — 첫 시도 정확도 개선 먼저 권장`);
        recommendedTier = declaredTier;
      } else {
        const next = nextTierUp(declaredTier);
        if (next) {
          recommendedTier = next;
          recommendedSavingsUsd = declaredLimits.monthlyPriceUsd - PLAN_LIMITS[next].monthlyPriceUsd;
          reasoning.push(`P90 ${p90.toLocaleString()} tokens — ${declaredLimits.label} 한도 ${utilizationPct}% (이미 한도)`);
          reasoning.push(`효율 지표 양호 (cache ${cache.toFixed(0)}%, one-shot ${oneShot.toFixed(0)}%) — ${PLAN_LIMITS[next].label} 업그레이드 권장`);
        } else {
          reasoning.push("이미 최상위 tier — 한도 도달 시 행동 변경만 가능");
        }
      }
    } else if (utilizationPct >= 80) {
      verdict = "tight";
      reasoning.push(`P90 ${p90.toLocaleString()} tokens — ${declaredLimits.label} 한도 ${utilizationPct}% (여유 적음)`);
      const next = nextTierUp(declaredTier);
      if (next) {
        recommendedTier = declaredTier; // 아직 업그레이드 강제 아님
        reasoning.push(`사용량이 늘면 ${PLAN_LIMITS[next].label} 검토. 현재는 적정 범위 끝.`);
      }
    } else if (utilizationPct < 40) {
      verdict = "downgrade";
      const down = nextTierDown(declaredTier);
      if (down) {
        recommendedTier = down;
        recommendedSavingsUsd = declaredLimits.monthlyPriceUsd - PLAN_LIMITS[down].monthlyPriceUsd;
        reasoning.push(`P90 ${p90.toLocaleString()} tokens — ${declaredLimits.label} 한도 ${utilizationPct}% (사용량 낮음)`);
        reasoning.push(`${PLAN_LIMITS[down].label} 다운그레이드 가능, 월 $${recommendedSavingsUsd} 절감`);
      } else {
        reasoning.push(`사용량 적지만 이미 최하위 tier`);
      }
    } else {
      verdict = "fit";
      recommendedTier = declaredTier;
      reasoning.push(`P90 ${p90.toLocaleString()} tokens — ${declaredLimits.label} 한도 ${utilizationPct}% (적정)`);
    }
  }

  return {
    estimatedTier,
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

function nextTierUp(tier: PlanTier): Exclude<PlanTier, null> | null {
  if (tier === "pro") return "max5";
  if (tier === "max5") return "max20";
  if (tier === "team") return "max20";
  return null;
}

function nextTierDown(tier: PlanTier): Exclude<PlanTier, null> | null {
  if (tier === "max20") return "max5";
  if (tier === "max5") return "pro";
  if (tier === "team") return "pro";
  return null;
}

// 팀 종합 — 멤버별 plan health 를 받아 권장 분포 / 절감액 계산
export interface TeamMemberPlan {
  userId: number;
  name: string;
  declaredTier: PlanTier;
  recommendedTier: PlanTier;
  monthlyCostNowUsd: number;
  monthlyCostRecommendedUsd: number;
  verdict: Verdict;
  actionFirst: boolean;
  isEstimated: boolean;       // 본인 declaredTier 없어 추정값으로 평가됨
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
  isEstimated?: boolean;
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
    const isEstimated = !!m.isEstimated;
    // 추정 멤버는 "현재" 비용에 합산 안 함 (실제 결제 미발생). 권장 비용도
    // 추정값 기반이라 절감액 노이즈 방지 위해 제외.
    const currentCostMember = !isEstimated && declared && declared !== "api"
      ? PLAN_LIMITS[declared].monthlyPriceUsd : 0;
    const recCostMember = !isEstimated && recommended && recommended !== "api"
      ? PLAN_LIMITS[recommended].monthlyPriceUsd : 0;

    memberRows.push({
      userId: m.userId,
      name: m.name,
      declaredTier: declared,
      recommendedTier: recommended,
      monthlyCostNowUsd: currentCostMember,
      monthlyCostRecommendedUsd: recCostMember,
      verdict: h.verdict,
      actionFirst: h.actionFirst,
      isEstimated,
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
