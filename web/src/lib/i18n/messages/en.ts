// 영어 카탈로그 — base 타입. 다른 locale 은 Messages 를 import 해서 구조 유지.

export interface Messages {
  brand: string;
  nav: {
    personal: string;
    team: string;
    setup: string;
    logout: string;
  };
  grades: {
    exemplary: string;     // 탁월
    good: string;          // 양호
    moderate: string;      // 보통
    low: string;           // 낮음
    start: string;         // 시작
    warning: string;       // 경고
    insufficient: string;  // 부족
    unused: string;        // 미활용
    current: string;       // ← 현재
  };
  common: {
    period: string;
    today: string;
    eightDays: string;
    thisMonth: string;
    thirtyDays: string;
    ninetyDays: string;
    all: string;
    close: string;
    open: string;
    later: string;
    save: string;
    saving: string;
    saved: string;
    cancel: string;
    retry: string;
    copy: string;
    copied: string;
    loading: string;
    error: string;
    source: string;
    grade: string;
    range: string;
    description: string;
    yes: string;
    no: string;
    notAvailable: string;
    estimate: string;        // 추정
    notEntered: string;      // 미입력
    me: string;              // 나
    average: string;         // 평균
    activeShort: string;     // 활성
    daysSuffix: string;      // 일
    perDay: string;          // / 일
    points: string;          // 점
    tokens: string;
    dailyAvg: string;        // 일평균
    tokensIncludingCache: string; // cache reads 포함
    daysShort: string;       // d (used after numbers)
    or: string;
    and: string;
    out: string;             // out of (e.g., "active 5/30")
    moreInfo: string;        // 자세히
    closeUp: string;         // 닫기 ▲
    methodsHow: string;      // 올리는 방법 / 줄이는 방법
    reference: string;       // 참고
    benchmark: string;       // 기준
    note: string;            // 비고
    powerIndexShort: string; // Power Index
  };
  dashboard: {
    loading: {
      title: string;
      body1: string;
      body2: string;
      polling: string;
    };
    cards: {
      myCost: string;
      unitCost: string;
      unitCostHint: string;
    };
    syncNeeded: {
      title: string;
      body: string;
      copy: string;
    };
  };
  usageHero: {
    powerLabel: string;             // ⚡ 활용 지수
    powerSubtitle: string;          // Power Index · {period}
    powerInfoTitleClosed: string;   // ? 산정 기준
    powerInfoTitleOpen: string;     // 닫기 ▲
    powerInfoTooltip: string;       // 활용지수 + 토큰단가 산정 기준 보기
    hardworkerBadge: string;        // 🔥 하드워커
    hardworkerTooltip: string;      // "{period} 중 {n}일 이상 활성 — 건강도 챙기세요"
    activeStatLine: string;         // "활성 {a}/{p}일 · 일평균 {tok} tokens"
    powerFormula: string;           // 활성일 40 + 사용량 60 = 100
    breakdownActiveTitle: string;   // 활성일 (40점)
    breakdownActiveFormula: string; // 활성일 ÷ {target}일 × 40
    breakdownActiveNote: string;    // ({period} 비례 — 30일 anchor {anchor}일)
    breakdownActiveMaxLine: string; // "{target}일 이상 만점"
    breakdownActiveHardworkerSuffix: string; // " · {n}일 이상이면 🔥 하드워커"
    breakdownMyLine: string;        // "나: {a}/{p}일 · {s}점"
    breakdownUsageTitle: string;    // 사용량 (60점) — 일평균 토큰 기준
    breakdownUsageCache: string;    // cache reads 포함 (Claude Code 특성상 90%+ 가 cache)
    tokenLevelAnchorEnterprise: string;
    tokenLevelAnchorAnthropicP90: string;
    tokenLevelAnchorAnthropicAvg: string;
    tokenLevelNoActivity: string;
    unitCostLabel: string;          // 📊 토큰 단가
    unitCostSubtitle: string;       // {period} 요금 / {period} 토큰
    tierReadonlyNoTier: string;     // tier 미입력
    tierUnknown: string;            // 잘 모름 (자동 추정)
    tierApi: string;                // API (종량제)
    tierApiNoPrice: string;         // API 종량제 — 단가 계산 N/A
    tierSelectPrompt: string;       // Plan tier 를 위에서 선택하세요
    tierMemberNoTier: string;       // 멤버가 plan tier 입력 안 함
    periodTokenInsufficient: string; // "{period} 토큰 데이터 부족"
    tierTitleTooltip: string;       // 본인 plan tier
    tierHintOpenLabel: string;      // ▾ 내 tier 확인하기
    tierHintCloseLabel: string;     // ▲ 내 tier 확인하기
    tierHintStep1Prefix: string;    // 1. claude.ai 접속 → 우측 상단 프로필 → Subscription
    tierHintStep2Prefix: string;    // 2. 또는 Claude Code 터미널에서 claude 실행 → /usage 입력
    tierHintStep3: string;          // 3. 표시된 plan 그대로 위 select 에서 선택
    tierHintStep1A: string;         // {claudeAi} 접속 → 우측 상단 프로필 → {sub}
    tierHintStep2A: string;         // 또는 Claude Code 터미널에서 {cmd} 실행 → {slash} 입력
    tierModalTitle: string;         // Plan tier 를 알려주세요
    tierModalLead: string;          // 토큰 단가와 plan 활용도를 계산하려면…
    tierModalSelectLabel: string;   // 본인 plan tier
    tierModalHintToggle: string;    // ▾ 내 tier 확인하기
    tierModalStep1: string;
    tierModalStep2: string;
    tierModalStep3: string;
    tierModalDismiss: string;       // 나중에 입력
    cacheExcludedRate: string;      // 캐시 제외 사용률
    sonnetAnchorHint: string;       // Sonnet API 입력 $3 / 1M 기준 — ? 누르면 10단계 위치 표시
    unitCostBreakdownTitle: string; // 토큰 단가 10단계 — 낮은 단가 = 높은 레벨
    unitCostReadingTitle: string;   // 읽는 법
    unitCostReadingBody: string;
    unitCostModelTitle: string;     // 기준 모델
    unitCostModelBody: string;
    unitCostExternalAnchorTitle: string; // 외부 anchor (Anthropic 공식, 2026-05)
    unitCostExternalAnchorBody: string;
    unitCostBoundaryNote: string;
    unitCostAnchorPlanX1000: string; // API 직접 호출이면 plan 의 1000배 비용
    unitCostAnchorPlanX300: string;
    unitCostAnchorPlanX100Heavy: string; // API 직접 호출이면 plan 의 100배 — Claude Code 헤비 평균
    unitCostAnchorPlanX30: string;
    unitCostAnchorPlanX10CacheRead: string; // API 직접 호출이면 plan 의 10배 — Sonnet cache_read 가격 동급
    unitCostAnchorPlanX3: string;
    unitCostAnchorEqualApi: string;        // API 직접 호출과 동급 — cache 거의 없음
    unitCostAnchorWasted3x: string;        // API 직접 호출보다 3배 비쌈 (plan 낭비)
    unitCostAnchorWasted10x: string;       // API 직접 호출보다 10배 비쌈
    unitCostAnchorWastedHeavy: string;     // plan 거의 안 씀 — API 직접 호출이 훨씬 쌈
    unitCostNoData: string;                // 데이터 없음
  };
  teamUsageHero: {
    powerLabel: string;             // ⚡ 팀 활용 지수
    powerSubtitle: string;          // Power Index 평균 · {period}
    unitCostLabel: string;          // 📊 팀 토큰 단가
    unitCostSubtitle: string;       // {period} 합산 요금 / 합산 토큰
    activeMembersLine: string;      // "활성 {n}명 · 멤버 평균 활성 {a}/{p}일"
    dailyAvgLine: string;           // 일평균 {tok} tokens (멤버 평균)
    breakdownActiveTitle: string;   // 활성일 (40점) — 멤버별 계산 후 평균
    breakdownActiveFormula: string; // 멤버 활성일 ÷ {target}일 × 40
    breakdownTeamAvgLine: string;   // 팀 평균: {a}/{p}일 ({n}명)
    breakdownUsageTitle: string;    // 사용량 (60점) — 멤버 평균 일평균 토큰 기준
    breakdownUsageNote: string;     // 팀 활용지수 = …
    noTier: string;                 // tier 입력 멤버 0 — 멤버 설정 페이지…
    periodSumPrice: string;         // {period} 합산 요금
    periodSumTokens: string;        // {period} 합산 토큰
    unitCostReadingTitle: string;
    unitCostReadingBody: string;
    unitCostModelTitle: string;
    unitCostModelBody: string;
    unitCostBoundaryNote: string;
  };
  wizard: {
    title: string;
    step1: {
      heading: string;
      lead: string;
      legacyFound: string;
      legacyNotFound: string;
    };
    destinations: {
      heading: string;
      hint: string;
      localOnly: string;
      localAndCompany: string;
      companyOnly: string;
    };
    actions: {
      continue: string;
      back: string;
      openDashboard: string;
      retry: string;
    };
    saving: string;
    saved: string;
    error: string;
  };
}

export const en: Messages = {
  brand: "AI Usage Tracker",
  nav: {
    personal: "Personal",
    team: "Team",
    setup: "Setup",
    logout: "Logout",
  },
  grades: {
    exemplary: "Exemplary",
    good: "Good",
    moderate: "Moderate",
    low: "Low",
    start: "Starting",
    warning: "Warning",
    insufficient: "Insufficient",
    unused: "Unused",
    current: "← current",
  },
  common: {
    period: "Period",
    today: "Today",
    eightDays: "8 days",
    thisMonth: "This month",
    thirtyDays: "30 days",
    ninetyDays: "90 days",
    all: "All",
    close: "Close",
    open: "Open",
    later: "Later",
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
    cancel: "Cancel",
    retry: "Retry",
    copy: "Copy",
    copied: "Copied",
    loading: "Loading…",
    error: "Error",
    source: "Source",
    grade: "Grade",
    range: "Range",
    description: "Description",
    yes: "Yes",
    no: "No",
    notAvailable: "N/A",
    estimate: "estimated",
    notEntered: "not entered",
    me: "Me",
    average: "Avg",
    activeShort: "Active",
    daysSuffix: " days",
    perDay: " / day",
    points: " pts",
    tokens: "tokens",
    dailyAvg: "daily avg",
    tokensIncludingCache: "Includes cache reads (Claude Code is 90%+ cache)",
    daysShort: "d",
    or: "or",
    and: "and",
    out: "out of",
    moreInfo: "More",
    closeUp: "Close ▲",
    methodsHow: "How to improve",
    reference: "Reference",
    benchmark: "Benchmark",
    note: "Note",
    powerIndexShort: "Power Index",
  },
  dashboard: {
    loading: {
      title: "Collecting data",
      body1: "codeburn and ccusage are running in the background.",
      body2: "It usually takes 30 seconds to 1 minute.",
      polling: "Auto-refreshing every 5 seconds…",
    },
    cards: {
      myCost: "My Cost",
      unitCost: "Daily Unit Cost ($ / 1M)",
      unitCostHint: "Lower = better plan utilization · No-activity days break the line · log scale",
    },
    syncNeeded: {
      title: "sync needed",
      body: "Run the command below in your terminal.",
      copy: "Copy",
    },
  },
  usageHero: {
    powerLabel: "⚡ Power Index",
    powerSubtitle: "Power Index · {period}",
    powerInfoTitleClosed: "? How it's scored",
    powerInfoTitleOpen: "Close ▲",
    powerInfoTooltip: "Show Power Index + Unit Cost scoring rules",
    hardworkerBadge: "🔥 Hardworker",
    hardworkerTooltip: "Active {n}+ days during {period} — take care of yourself",
    activeStatLine: "Active {a}/{p} days · daily avg {tok} tokens",
    powerFormula: "Active days 40 + Usage 60 = 100",
    breakdownActiveTitle: "Active days (40 pts)",
    breakdownActiveFormula: "active days ÷ {target} days × 40",
    breakdownActiveNote: "(scaled to {period} — 30-day anchor {anchor} days)",
    breakdownActiveMaxLine: "Max at {target} days",
    breakdownActiveHardworkerSuffix: " · 🔥 Hardworker at {n}+ days",
    breakdownMyLine: "Me: {a}/{p} days · {s} pts",
    breakdownUsageTitle: "Usage (60 pts) — by daily avg tokens",
    breakdownUsageCache: "Includes cache reads (Claude Code is 90%+ cache)",
    tokenLevelAnchorEnterprise: "Enterprise P90",
    tokenLevelAnchorAnthropicP90: "Anthropic P90 (individual)",
    tokenLevelAnchorAnthropicAvg: "Anthropic avg",
    tokenLevelNoActivity: "no activity",
    unitCostLabel: "📊 Unit Cost",
    unitCostSubtitle: "{period} plan / {period} tokens",
    tierReadonlyNoTier: "tier not entered",
    tierUnknown: "Not sure (auto estimate)",
    tierApi: "API (pay-as-you-go)",
    tierApiNoPrice: "API pay-as-you-go — unit cost N/A",
    tierSelectPrompt: "Select your plan tier above",
    tierMemberNoTier: "Member has not entered plan tier",
    periodTokenInsufficient: "Not enough token data for {period}",
    tierTitleTooltip: "Your plan tier",
    tierHintOpenLabel: "▾ Find my tier",
    tierHintCloseLabel: "▲ Find my tier",
    tierHintStep1Prefix: "1. Go to claude.ai → top-right profile → Subscription",
    tierHintStep2Prefix: "2. Or in the Claude Code terminal run claude → type /usage",
    tierHintStep3: "3. Pick the plan shown there in the select above",
    tierHintStep1A: "Go to {claudeAi} → top-right profile → {sub}",
    tierHintStep2A: "Or in the Claude Code terminal run {cmd} → type {slash}",
    tierModalTitle: "Tell us your plan tier",
    tierModalLead:
      "We need your Claude plan to compute unit cost and plan utilization. Pick below — it's applied instantly.",
    tierModalSelectLabel: "Your plan tier",
    tierModalHintToggle: "▾ Find my tier",
    tierModalStep1: "1. Go to {claudeAi} → top-right profile → {sub}",
    tierModalStep2: "2. Or in the terminal run {cmd} → type {slash}",
    tierModalStep3: "3. Pick the plan shown there in the select above",
    tierModalDismiss: "Enter later",
    cacheExcludedRate: "Cache-excluded usage",
    sonnetAnchorHint: "Anchor: Sonnet API input $3 / 1M — press ? to see the 10 levels",
    unitCostBreakdownTitle: "Unit Cost — 10 levels (lower price = higher level)",
    unitCostReadingTitle: "How to read",
    unitCostReadingBody:
      "“API direct call = N× plan” means: if you had run the same tokens directly via the Sonnet API, it would have cost N× the plan price. This is the cache-leverage quantified.",
    unitCostModelTitle: "Reference model",
    unitCostModelBody:
      "Sonnet 4.6 input $3 / 1M (Claude Code default, most common). Opus 4.6 input $5 / 1M (1.7×), Haiku 4.5 input $1 / 1M (0.3×) — the anchor shifts slightly with your model mix but your level stays in the same band.",
    unitCostExternalAnchorTitle: "External anchor (Anthropic official, 2026-05)",
    unitCostExternalAnchorBody:
      "cache_read $0.30 / 1M (= 10% of input), cache_write $3.75 / 1M. 90%+ of Claude Code tokens are cache_read (community reports). A reported 170-turn Opus session: $168 without cache → $21 with cache (98% leverage).",
    unitCostBoundaryNote:
      "Level boundaries are interpolated logarithmically above the anchors (real user distributions are private — not an exact percentile). Use it to track your own position over time.",
    unitCostAnchorPlanX1000: "API direct call = 1000× plan price",
    unitCostAnchorPlanX300: "API direct call = 300× plan price",
    unitCostAnchorPlanX100Heavy: "API direct call = 100× plan price — Claude Code heavy avg",
    unitCostAnchorPlanX30: "API direct call = 30× plan price",
    unitCostAnchorPlanX10CacheRead: "API direct call = 10× plan price — Sonnet cache_read tier",
    unitCostAnchorPlanX3: "API direct call = 3× plan price",
    unitCostAnchorEqualApi: "About equal to API direct — barely any cache",
    unitCostAnchorWasted3x: "3× more expensive than direct API (plan wasted)",
    unitCostAnchorWasted10x: "10× more expensive than direct API",
    unitCostAnchorWastedHeavy: "Barely using the plan — direct API is much cheaper",
    unitCostNoData: "no data",
  },
  teamUsageHero: {
    powerLabel: "⚡ Team Power Index",
    powerSubtitle: "Power Index avg · {period}",
    unitCostLabel: "📊 Team Unit Cost",
    unitCostSubtitle: "{period} total plan / total tokens",
    activeMembersLine: "Active {n} members · member avg active {a}/{p} days",
    dailyAvgLine: "Daily avg {tok} tokens (member avg)",
    breakdownActiveTitle: "Active days (40 pts) — per-member then averaged",
    breakdownActiveFormula: "member active days ÷ {target} days × 40",
    breakdownTeamAvgLine: "Team avg: {a}/{p} days ({n} members)",
    breakdownUsageTitle: "Usage (60 pts) — by member avg daily tokens",
    breakdownUsageNote: "Team Power Index = avg of active members' scores. Table position is by member-average daily tokens.",
    noTier: "0 members with tier entered — totals show once members enter plan tier",
    periodSumPrice: "{period} total plan",
    periodSumTokens: "{period} total tokens",
    unitCostReadingTitle: "How to read",
    unitCostReadingBody:
      "“API direct call = N× plan” = if the team's tokens had been called directly via the Sonnet API, it would have cost N× the total plan price.",
    unitCostModelTitle: "Reference model",
    unitCostModelBody:
      "Sonnet 4.6 input $3 / 1M (Claude Code default). Opus $5 (1.7×), Haiku $1 (0.3×) — anchor shifts slightly with model mix but the level stays in the same band.",
    unitCostBoundaryNote:
      "cache_read $0.30 / 1M (input × 10%, Anthropic official 2026-05). Level boundaries are interpolated logarithmically.",
  },
  wizard: {
    title: "AI Usage Tracker — Setup",
    step1: {
      heading: "Welcome",
      lead: "This tool collects your Claude Code usage locally and shows it on a dashboard.",
      legacyFound: "We detected an existing company server connection on this machine.",
      legacyNotFound: "No existing company server connection was found.",
    },
    destinations: {
      heading: "Where should the data go?",
      hint: "You can change this later by editing ~/.usage-tracker/config.json.",
      localOnly: "Local only — 100% private, never leaves this computer",
      localAndCompany: "Local + Company server — both kept in sync (recommended for team members)",
      companyOnly: "Company server only — same as before, no local DB",
    },
    actions: {
      continue: "Continue",
      back: "Back",
      openDashboard: "Open Dashboard",
      retry: "Retry",
    },
    saving: "Saving…",
    saved: "Setup complete!",
    error: "Something went wrong",
  },
};
