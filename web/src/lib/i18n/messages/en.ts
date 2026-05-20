// 영어 카탈로그 — base 타입. 다른 locale 은 Messages 를 import 해서 구조 유지.

export interface Messages {
  brand: string;
  nav: {
    personal: string;
    team: string;
    setup: string;
    logout: string;
    admin: string;
  };
  about: {
    title: string;        // ⓘ aria-label
    headerLocal: string;  // "Bundled" (dmg)
    headerCloud: string;  // "Recommended" (cloud)
    loading: string;
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
    needsWork: string;     // 개선 필요
    noActivity: string;    // 활동 없음
    noData: string;        // 데이터 없음
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
      unitCostLegendActual: string;
      unitCostLegendPersonalAvg: string;
      unitCostLegendApiAvg: string;
      apiUnitCost: string;
      apiUnitCostHint: string;
      planTierMissing: string;
      noActivityHint: string;
      planSavings: string;
      planSavingsApiLabel: string;
      planSavingsPlanLabel: string;
      planSavingsSavedLabel: string;
      planSavingsHint: string;
      planSavingsEstimatedLabel: string;
      planSavingsMonthlySuffix: string;
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
    tierModalLeadNoActivity: string; // activity 0 일 때 — CLI sync 먼저 확인 안내
    tierModalSelectLabel: string;   // 본인 plan tier
    tierModalPickPlaceholder: string; // "선택해 주세요" — 강제 선택 placeholder
    tierModalConfirm: string;       // "확인" — selection 후 저장 트리거
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
  teamPlanHealth: {
    cardTitle: string;
    currentDistribution: string;
    recommendedDistribution: string;
    perMonthSuffix: string;
    monthlySavings: string;
    monthlyExtraAfterUpgrade: string;
    actionFirstCount: string;
    colMember: string;
    colCurrent: string;
    colVerdict: string;
    colRecommended: string;
    colDelta: string;
    estimated: string;
    notEntered: string;
    keep: string;
    verdictDowngrade: string;
    verdictFit: string;
    verdictTight: string;
    verdictOver: string;
    verdictUtilFmt: string;       // "P90 {pct}%"
    verdictHitFmt: string;        // "{n}× at cap" — over verdict 에서만 추가 표시
    footnote: string;
  };
  planHealth: {
    cardTitle: string;
    p90Suffix: string;
    autoEstimated: string;
    estimatedDetails: string;
    yourTier: string;
    saved: string;
    utilizationLine: string;
    monthlySavings: string;
    monthlyExtra: string;
    actionFirst: string;
    reasoningSummary: string;
    reasoningFootnote: string;
    verdictDowngrade: string;
    verdictFit: string;
    verdictTight: string;
    verdictOver: string;
    verdictUnknown: string;
    tierUnknown: string;
    tierApi: string;
  };
  scoreDrilldown: {
    weeklyAvgTitle: string;
    dailyTitle: string;
    weeksSuffix: string;
    daysSuffix: string;
    activeNDays: string;
    todayInProgress: string;
    legendExemplary: string;
    legendGood: string;
    legendModerate: string;
    legendInsufficient: string;
    legendWarning: string;
    bigChangeTitle: string;
    stableNote: string;
    causeIntro: string;
    causeWeight: string;
    causeFallback: string;
    causeCache: string;
    causeOneShot: string;
    causeCostCall: string;
    causeTokenVolume: string;
  };
  setupPage: {
    greeting: string;
    sub: string;
    fetchErrorTitle: string;
    fetchErrorBody: string;
    fetchRetry: string;
    tzHeader: string;
    tzLead: string;
    tzSaved: string;
    step1: string;
    step1Title: string;
    step1Sub: string;
    runCmdLine: string;
    copyLabel: string;
    copiedLabel: string;
    browserOpens: string;
    manualNode: string;
    step2Title: string;
    stepHook: string;
    stepFirstSession: string;
    waitingNote: string;
    installDone: string;
    goDashboard: string;
    troubleshoot: string;
    osTerminalMac: string;
    osTerminalWin: string;
  };
  memberProfile: {
    teamRanking: string;
    backToTeamRanking: string;
    notFound: string;
    badId: string;
    profileSuffix: string;
    noDataYet: string;
    noDataHint: string;
    loading: string;
    totalCost: string;
    sessionsCount: string;
    sessionsUnit: string;
    streakDaysUnit: string;
    activityHeatmap4w: string;
    topProjects: string;
    sessionsCountUnit: string;
  };
  login: {
    tagline: string;
    teamOnly: string;
    errorDomain: string;
    errorOther: string;
    githubStart: string;
    googleStart: string;
  };
  privacy: {
    banner: string;
    bannerEm1: string;
    bannerEm2: string;
    dismissAria: string;
    footerNote: string;
  };
  adminNav: {
    team: string;
    members: string;
    home: string;
  };
  metricModal: {
    common: {
      what: string;        // {label}이란
      howTo: string;       // 올리는 방법 / 줄이는 방법
      grade: string;       // 등급
      gradeForSonnet: string; // 등급 (Sonnet 기준)
      reference: string;   // 참고
      methodsTitle: string; // {label} {action}
      detailsTitle: string; // {label} 상세
      sourceCamp: string;
      currentSession: string; // 현재 N% 는 ...
      noteCacheNonStandard: string;
    };
    cacheHit: {
      label: string;
      definition: string;
      definitionCacheLine: string;
      definitionExplain: string;
      formula: string;
      currentExplain: string;
      claudeBenchNote: string;
      methodsLead: string;
      step1: string;
      step2: string;
      step3: string;
      step4: string;
      step5: string;
      grade1: string;
      grade2: string;
      grade3: string;
      grade4: string;
      grade5: string;
    };
    oneShot: {
      label: string;
      def1: string;
      def2: string;
      formula: string;
      def3: string;
      methodsLead: string;
      step1: string;
      step2: string;
      step3: string;
      step4: string;
      step5: string;
      grade1: string;
      grade2: string;
      grade3: string;
      gradeFootnote: string;
    };
    costSession: {
      label: string;
      def1: string;
      formulaLine: string;
      formulaVal: string;
      def2: string;
      methodsLead: string;
      step1: string;
      step2: string;
      step3: string;
      step4: string;
      step5: string;
      grade1: string;
      grade2: string;
      grade3: string;
      gradeFootnote: string;
    };
    costCall: {
      label: string;
      def1: string;
      formulaLine: string;
      formulaVal: string;
      def2: string;
      step1: string;
      step2: string;
      step3: string;
      step4: string;
      step5: string;
      referenceBody: string;
    };
    tokenVolume: {
      titleTpl: string;
      label: string;
      def1: string;
      def2Title: string;
      def2: string;
      gradesTitle: string;
      gradesLead: string;
      row10: string;
      row9: string;
      row8: string;
      row7: string;
      row6: string;
      row5: string;
      row4: string;
      row3: string;
      row2: string;
      row1: string;
      row0: string;
      footnote: string;
    };
    callsPerSession: {
      label: string;
      def1: string;
      formulaLine: string;
      formulaVal: string;
      goodDirTitle: string;
      goodDirLead: string;
      highBadTitle: string;
      highBadItems: string[];
      lowBadTitle: string;
      lowBadItems: string[];
      goodRange: string;
      methodsLead: string;
      stepHigh: string;
      stepLow: string;
      stepOneShot: string;
      stepClaudeMd: string;
      stepDeclare: string;
      referenceBody: string;
      seeAlsoTitle: string;
      seeAlso1: string;
      seeAlso2: string;
      seeAlso3: string;
    };
  };
  teamView: {
    loadFailed: string;
    retry: string;
    loading: string;
    noSync: string;
    daysAgoN: string;
    daysWarn: string;
    summaryTotalTokens: string;
    summaryTotalCost: string;
    summarySessions: string;
    summaryActiveMembers: string;
    summaryAvgCacheHit: string;
    summaryAvgOneShot: string;
    gradeBadge: string;
    membersCount: string;
    axHeadline: string;
    teamMultiplier: string;
    activeMembers: string;
    planSavings: string;
    noActivityPeriod: string;
    moreDetails: string;
    collapseDetails: string;
    moreDetailsHint: string;
    moreBasicDetails: string;          // admin only — 기본 팀정보 토글 (TeamUsageHero/Row 1·2·2.5/headline)
    moreBasicDetailsHint: string;
    moreDetailedDetailsAdmin: string;  // admin 만 보는 세부 토글 라벨 (기본 토글과 구분)
    teamSum: string;
    powerRankCard: string;
    unitCostCardLabel: string;
    estimateBadge: string;
    unitCostFootnote: string;
    industryUser: string;
    industryUserTop10: string;
    industryEnterpriseAvg: string;
    industryEnterpriseTop10: string;
    industryTop1: string;
    teamLabel: string;
    headlineTitle: string;
    teamAvgN: string;
    vsEnterpriseAvg: string;
    activeUsageDescription: string;
    perActiveDayCompare: string;
    sourceFootnote: string;
    columnMember: string;
    columnUsage: string;
    columnOverall: string;
    selfMark: string;
    tooltipTeamAvgMyValue: string;
    tooltipUsageAvgMy: string;
    activitiesMembersCount: string;
    planMember: string;
    planLastReceived: string;
    planVisitsMonth: string;
    planAvgDwell: string;
    monthlyVisitsTitle: string;
    visitsOfDay: string;
    monthLabel: string;
    monthRow: string;
    columnProject: string;
  };
  gradeDescriptions: {
    cacheHitExemplary: string;
    cacheHitGood: string;
    cacheHitModerate: string;
    cacheHitInsufficient: string;
    cacheHitWarning: string;
    oneShotExemplary: string;
    oneShotModerate: string;
    oneShotWarning: string;
    costExemplary: string;
    costModerate: string;
    costWarning: string;
    tokenExemplary: string;
    tokenGood: string;
    tokenModerate: string;
    tokenInsufficient: string;
    tokenWarning: string;
  };
  dashboardView: {
    chartLoading: string;
    dataLoadFailed: string;
    retry: string;
    noDataYet: string;
    staleSyncTitle: string;
    staleSyncBody: string;
    staleSyncRepairLabel: string;
    staleSyncCopy: string;
    staleSyncCopied: string;
    previous: string;
    daysAgoN: string;
    dayLabel: string;
    activeNDays: string;
    lastReceived: string;
    tzChangeTitle: string;
    referenceFigures: string;
    gradeCriteria: string;
    explain: string;
    moreUsage: string;
    increase: string;
    decrease: string;
    optimize: string;
    usage: string;
    usageWithLevel: string;
    activityHeatmapLabel: string;
    todayMark: string;
    noActivityShort: string;
    streakLabel: string;
    streakSkip: string;
    weekTeamCacheRank: string;
    rankOutOf: string;
    rankMeTeam: string;
    teamRankEmpty: string;
    recent90dEfficiency: string;
    moreDetails: string;
    collapseDetails: string;
    moreDetailsHint: string;
    gradeWarning: string;
    gradeImprove: string;
    gradeGood: string;
    gradeExemplary: string;
    legendLow: string;
    legendHigh: string;
    dayCellNoActivity: string;
    dayCellScore: string;
    dayCellCost: string;
    todaySuffix: string;
    activeBlocksEmpty: string;
    patternCriteriaSuffix: string;
    patternDisclaimer: string;
    activeBlocks: string;
    avgLength: string;
    tokensPerMin: string;
    longestBlock: string;
    deltaWindowTitle: string;
    lengthDistribution: string;
    dwellHeatmapLabel: string;
    dwellMonthVisits: string;
    inProgressAt: string;
    yesterdayN: string;
    closeUpTrend: string;
    openTrend: string;
    efficiencyTodayLabel: string;
    efficiencyAvgLabel: string;
    efficiencyFormula: string;
    patternImmersive: string;
    patternDistributed: string;
    patternBalanced: string;
    patternSporadic: string;
    patternImmersiveTooltip: string;
    patternDistributedTooltip: string;
    patternBalancedTooltip: string;
    patternSporadicTooltip: string;
    dayOffsetYesterday: string;
    dayOffset2: string;
    dayOffsetN: string;
    weekOffsetLast: string;
    weekOffsetN: string;
    monthOffsetLast: string;
    monthOffsetN: string;
    weekdaySun: string;
    weekdayMon: string;
    weekdayTue: string;
    weekdayWed: string;
    weekdayThu: string;
    weekdayFri: string;
    weekdaySat: string;
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
    admin: "Admin",
  },
  about: {
    title: "Version info",
    headerLocal: "Bundled",
    headerCloud: "Recommended",
    loading: "Loading...",
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
    needsWork: "Needs work",
    noActivity: "No activity",
    noData: "No data",
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
      unitCostHint: "Below the gray line = beating your own baseline · below amber = plan paying for itself · log scale",
      unitCostLegendActual: "your rate",
      unitCostLegendPersonalAvg: "your avg",
      unitCostLegendApiAvg: "without plan",
      apiUnitCost: "API-equivalent Unit Cost ($ / 1M)",
      apiUnitCostHint: "Anthropic API direct-call equivalent · shows plan savings",
      planTierMissing: "Plan tier not set — select it in the plan-health card above",
      noActivityHint: "No activity data yet — check that the CLI sync is running. Once active, enter your plan tier to see unit cost.",
      planSavings: "Plan Savings",
      planSavingsApiLabel: "without plan",
      planSavingsPlanLabel: "Plan cost",
      planSavingsSavedLabel: "saved",
      planSavingsHint: "API-equivalent cost vs plan price this period · estimated if tier missing",
      planSavingsEstimatedLabel: "estimated",
      planSavingsMonthlySuffix: "/mo",
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
    tierModalLeadNoActivity:
      "No activity data collected yet. First make sure the CLI sync is running. Once activity appears, picking a plan tier here will fill in unit cost.",
    tierModalSelectLabel: "Your plan tier",
    tierModalPickPlaceholder: "Pick a plan…",
    tierModalConfirm: "Confirm",
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
  teamPlanHealth: {
    cardTitle: "Team Plan Health",
    currentDistribution: "Current distribution",
    recommendedDistribution: "Recommended distribution",
    perMonthSuffix: "${n}/mo",
    monthlySavings: "▼ Save ${n}/mo",
    monthlyExtraAfterUpgrade: "▲ +${n}/mo (after upgrade)",
    actionFirstCount: "💡 Improve efficiency first: {n} members",
    colMember: "Member",
    colCurrent: "Current",
    colVerdict: "Verdict",
    colRecommended: "Recommended",
    colDelta: "Δ",
    estimated: " (estimated)",
    notEntered: " (not entered)",
    keep: "(keep)",
    verdictDowngrade: "▼ Downgrade",
    verdictFit: "✓ Fit",
    verdictTight: "▲ Plan well-used",
    verdictOver: "▲▲ Power User",
    verdictUtilFmt: "{pct}% of plan",
    verdictHitFmt: "{n}× at cap",
    footnote:
      "※ Verdict is based on monthly API-equivalent cost (ccusage) vs plan price ratio. 30-day window, members with 7+ active days only. No upgrade recommendations (Anthropic's 5h cap unit is undisclosed).",
  },
  planHealth: {
    cardTitle: "📊 Plan Health",
    p90Suffix: "Last 30d P90 = {n} tokens/5h",
    autoEstimated: "Auto-estimated tier: ",
    estimatedDetails: "(blocks {blocks}, active {days}d)",
    yourTier: "Your tier:",
    saved: "✓ Saved",
    utilizationLine: "{n}% of {label} limit",
    monthlySavings: "Save ${n}/mo",
    monthlyExtra: "+${n}/mo",
    actionFirst: "💡 Improve efficiency before upgrading the plan",
    reasoningSummary: "Why ▼",
    reasoningFootnote:
      "※ Plan limits are community-P90 estimates. No Anthropic official disclosure.",
    verdictDowngrade: "Downgrade possible",
    verdictFit: "Fit",
    verdictTight: "Tight",
    verdictOver: "At cap",
    verdictUnknown: "Insufficient data",
    tierUnknown: "Unknown",
    tierApi: "API (pay-as-you-go)",
  },
  scoreDrilldown: {
    weeklyAvgTitle: "Weekly avg efficiency",
    dailyTitle: "Daily efficiency",
    weeksSuffix: "wk",
    daysSuffix: "d",
    activeNDays: "Active {a}/{total} days",
    todayInProgress: "Today (in progress · excluded from comparison)",
    legendExemplary: "Exemplary 90+",
    legendGood: "Good 75–89",
    legendModerate: "Moderate 55–74",
    legendInsufficient: "Needs work 35–54",
    legendWarning: "Warning <35",
    bigChangeTitle: "Days with big swings (±{threshold} pts vs. previous)",
    stableNote: "✓ Efficiency over the last {n}{unit} was stable.",
    causeIntro: "Main cause:",
    causeWeight: "({from} → {to}) ({sign}{delta} pts)",
    causeFallback: "Each metric moved little — no single cause stands out.",
    causeCache: "Cache hit",
    causeOneShot: "One-shot rate",
    causeCostCall: "Cost / call",
    causeTokenVolume: "Total usage",
  },
  setupPage: {
    greeting: "Hi {name} 👋",
    sub: "Install once and collection starts automatically",
    fetchErrorTitle: "⚠ Failed to check setup status",
    fetchErrorBody: "Check your network/session and try again.",
    fetchRetry: "Retry",
    tzHeader: "Timezone setting",
    tzLead: "Used for dashboard timestamps. We auto-detected your timezone.",
    tzSaved: "✓ Saved",
    step1: "Step 1 — One-shot install",
    step1Title: "Open your {term} and run the command below",
    step1Sub: "If Node.js is missing it's installed first, then Tracker init.",
    runCmdLine: "Run command",
    copyLabel: "Copy",
    copiedLabel: "✓ Copied",
    browserOpens: "Browser opens → log in → done.",
    manualNode: "Already have Node.js (manual)",
    step2Title: "Step 2 — Waiting to auto-complete",
    stepHook: "Hook registered",
    stepFirstSession: "First data received",
    waitingNote: "Auto-checked after you run the command above.",
    installDone: "✓ Install complete",
    goDashboard: "Open dashboard →",
    troubleshoot: "Not working? Troubleshoot →",
    osTerminalMac: "terminal",
    osTerminalWin: "PowerShell",
  },
  memberProfile: {
    teamRanking: "← Team ranking",
    backToTeamRanking: "Back to team ranking",
    notFound: "⚠ Member not found",
    badId: "The ID may be incorrect.",
    profileSuffix: " profile",
    noDataYet: "No data yet",
    noDataHint: "Data is collected automatically after the user finishes their first Claude Code session.",
    loading: "Loading…",
    totalCost: "Total cost",
    sessionsCount: "Sessions",
    sessionsUnit: " sessions",
    streakDaysUnit: " days",
    activityHeatmap4w: "Activity heatmap (4 weeks, by cost)",
    topProjects: "Top projects",
    sessionsCountUnit: " sessions",
  },
  login: {
    tagline: "See at a glance how much and how well you're using AI coding tools",
    teamOnly: "Team members only",
    errorDomain: "Email domain not allowed.",
    errorOther: "An error occurred during login.",
    githubStart: "Continue with GitHub",
    googleStart: "Continue with Google",
  },
  privacy: {
    banner: "🔒 This tool only collects",
    bannerEm1: "token count · tool names",
    bannerEm2: "Code · prompts · Claude responses are NOT collected.",
    dismissAria: "Dismiss notice",
    footerNote: "🔒 Metadata-only collection — code · prompts · response text are NOT collected",
  },
  adminNav: {
    team: "Team",
    members: "Members",
    home: "Home",
  },
  metricModal: {
    common: {
      what: "What is {label}",
      howTo: "How to improve",
      grade: "Grades",
      gradeForSonnet: "Grades (Sonnet baseline)",
      reference: "Reference",
      methodsTitle: "How to improve {label}",
      detailsTitle: "{label} details",
      sourceCamp: "Claude Code Camp — How prompt caching actually works",
      currentSession:
        "{val}% means \"{val}% of total input was processed at 1/10 the price.\" Claude Code engineers say a normal session is around 96%; a cache-hit dip is treated as an incident (SEV). {goodNote}",
      noteCacheNonStandard:
        "※ Some tools (e.g. codeburn) exclude cache writes from the denominator and show numbers near 100%. This tool uses the Anthropic-standard formula.",
    },
    cacheHit: {
      label: "Cache hit",
      definition:
        "Every Claude Code message resends the system prompt + CLAUDE.md + tool defs + the whole conversation so far — typically 50K–100K tokens per turn.",
      definitionCacheLine:
        "Most of that is identical to the previous turn (system prompt, CLAUDE.md, prior conversation). The API lets you mark sections as \"cached for next call\" and the cached read price is",
      definitionExplain: "1/10 of the normal input price",
      formula: "Cache hit = cache reads ÷ (cache reads + cache writes + new input)",
      currentExplain:
        "If your cache hit is high you're paying ~10% for most of your tokens.",
      claudeBenchNote: "Normal session is ~96% in Anthropic's own dashboards.",
      methodsLead:
        "Cache compares messages from the start byte-for-byte. A single-byte change invalidates the cache → you pay full price. The whole job is to keep the message prefix stable.",
      step1:
        "**Stabilize CLAUDE.md** — short, rarely changing. Put volatile content (current sprint) at the bottom; stable content (tech stack) at the top.",
      step2:
        "**One session = one task** — three short separate sessions cost less in total than 50 turns jumping around in one session.",
      step3:
        "**Don't pause more than 5 minutes** — cache TTL is 5 minutes. Bathroom break → cache expired → expensive first message.",
      step4:
        "**Don't add/remove MCP tools mid-session** — tool defs sit early in the cache; changing them invalidates everything after.",
      step5:
        "**Don't switch models mid-session** — Sonnet ↔ Opus swap breaks the cache.",
      grade1: "Claude Code internal benchmark",
      grade2: "Good state",
      grade3: "Typical level",
      grade4: "Likely bloated CLAUDE.md",
      grade5: "Anthropic-level incident (SEV)",
    },
    oneShot: {
      label: "One-shot rate",
      def1:
        "When Claude Code rewrites or edits code (Edit / Write / MultiEdit), each call lands as either **first-try success** or **retry**.",
      def2:
        "Failures: target text slightly off, indentation wrong, conflict because another edit already moved things, bad syntax in a new file. After a failure Claude re-reads and retries — **extra tokens + extra time**.",
      formula: "One-shot rate = first-try successful edits ÷ total edit calls",
      def3:
        "Cache hit and cost show \"how much you spent\"; one-shot rate shows \"how accurately Claude wrote.\" Retry loops burn tokens without producing output — there are reports of 90K tokens burned in retry loops in a single session. **The most direct indicator of AI-usage skill.**",
      methodsLead:
        "For Claude to one-shot it needs **enough context + clear instructions**. Both are decided by you.",
      step1:
        "**Make Claude read enough before editing** — \"Read this file end-to-end, study the structure, then refactor X to pattern Y\" beats \"Refactor this function.\" Guessing → retries.",
      step2:
        "**Remove ambiguity** — \"Make it cleaner\" is a guess. \"Replace this function's try-catch with a Result-typed return\" lands in one shot.",
      step3:
        "**Split large changes into stages** — \"1) interface, 2) implementation, 3) tests\" beats \"rewrite this whole file.\" Each stage's one-shot goes up.",
      step4:
        "**Pin coding conventions in CLAUDE.md** — indent, naming, import order. No guessing → first-try success up.",
      step5:
        "**Re-read after external changes** — if you git pulled or a teammate touched the same file, say \"Re-read the latest file before working.\" Otherwise Claude works from a stale view → conflicts → retries.",
      grade1: "Almost no retries — clear context",
      grade2: "Normal range for messy coding",
      grade3: "Frequent Edit→Build→Edit loops",
      gradeFootnote: "Based on codeburn official anchors (90% / 30%) — 3 levels.",
    },
    costSession: {
      label: "Cost / session",
      def1:
        "A session starts with `claude` and ends at `/exit` or when the terminal closes. A new `claude` starts a new session.",
      formulaLine: "Cost / session = total cost ÷ session count",
      formulaVal: "${totalCost} ÷ {sessions} = **${value} per session**",
      def2:
        "Total tokens or total cost just mean \"used a lot.\" Cost / session is the most direct \"average cost to finish one unit of work.\" If this number drops over time, you're getting better at using Claude.",
      methodsLead:
        "The longer a session, the more conversation history is re-sent every message. **Cutting sessions to the right size is the whole job.**",
      step1:
        "**Cut sessions at work units** — saving a worklog, committing, opening a PR — those are session-end signals. If the next task doesn't need the previous context, always start a new session. Going from 12 sessions/week to 30–40/week is normal.",
      step2:
        "**At 70% context, start wrapping up** — auto-compact at 95% is itself expensive. Wrap up before auto-compact triggers and start a new session. Check `/context` regularly.",
      step3:
        "**Diet CLAUDE.md** — a 5KB CLAUDE.md is 5K tokens per message. A 100-message session burns 500K tokens just on CLAUDE.md. Keep only the essentials.",
      step4:
        "**Use Haiku for simple work** — finding files, simple commands, short reads. Haiku is 1/10 the price. Claude Code won't auto-pick it — switch manually with `/model haiku`.",
      step5:
        "**Don't resume the same work within 5 min of ending a session** — the cache is still alive within 5 minutes, so continuing the existing session is cheaper. Resuming after a cut within 5 min builds the cache twice.",
      grade1: "Routine session size",
      grade2: "Large work session — normal range",
      grade3: "Mega session — split it or check efficiency",
      gradeFootnote:
        "Opus ≈ 5× of these. External anchors are weak — only 3 levels.",
    },
    costCall: {
      label: "Cost / call",
      def1:
        "Average cost per API call. Each user message or tool invocation by Claude is one API call.",
      formulaLine: "Cost / call = total cost ÷ total calls",
      formulaVal: "${totalCost} ÷ {totalCalls} = **${value} per call**",
      def2:
        "While cache hit answers \"did I use the cache well\" and cost/session answers \"is my work unit right-sized,\" cost/call is the direct signal of **model choice and context size**. Same session, Opus is 5× Sonnet; bigger context scales linearly.",
      step1:
        "**Stay on Sonnet** — Opus only for hard design / refactoring / debugging. Simple edits / search / lookups are fine on Sonnet at 1/5 the price.",
      step2:
        "**Use Haiku for simple tasks** — listing files, short snippets, simple questions. Switch with `/model haiku`. 1/4 of Sonnet.",
      step3:
        "**Diet CLAUDE.md** — sent in full every call. 5KB = 5K fixed tokens per call. Keep only the essentials; split the rest to separate files.",
      step4:
        "**Keep cache hit up** — cache reads cost 1/10 of normal input. High cache hit → lower cost/call at the same context size.",
      step5:
        "**Trim MCP tools** — registered MCP tools send their defs every call. Disable the ones you don't use often.",
      referenceBody:
        "Cost / call is the combined signal of model choice and context size. No external anchor, so no grade — the BY MODEL card + cache hit grade already cover it. Use this value diagnostically and watch its trend.",
    },
    tokenVolume: {
      titleTpl: "Usage {level}/10 · daily avg {tokens} tokens",
      label: "Usage",
      def1:
        "**Daily-average total tokens** processed by Claude Code (cache reads included). Claude Code is 90%+ cache reads — using cache well naturally produces a big number.",
      def2Title: "Why this is part of the efficiency score",
      def2:
        "Pure efficiency (cache · one-shot · cost) makes \"using nothing\" look optimal. Usage is weighted 30% so actual activity counts. Same efficiency but lower usage → lower score → nudges you to actually use it.",
      gradesTitle: "10 levels (global anchors)",
      gradesLead:
        "Calibrated against Anthropic official + Verdent + power-user data. Reference model: Sonnet 4.6 + average cache utilization (~$1 ≈ 1.3M total tokens).",
      row10: "Extreme (~$240+/day)",
      row9: "Power-user territory",
      row8: "Very heavy (~$120/day)",
      row7: "Verdent heavy top (~$60/day)",
      row6: "★ Anthropic enterprise P90 (~$30/day)",
      row5: "Verdent medium top (~$20/day)",
      row4: "★ Anthropic P90 (individual) (~$12/day)",
      row3: "★ Anthropic average (~$6/day)",
      row2: "Light starter (~$2/day)",
      row1: "Barely using",
      row0: "Not using",
      footnote: "★ = externally validated anchor. Others are interpolated.",
    },
    callsPerSession: {
      label: "Calls per session",
      def1:
        "How many Claude API calls within one session. One user message can trigger many calls as Claude invokes tools. **Turns or tool calls in a session.**",
      formulaLine: "Calls per session = total calls ÷ sessions",
      formulaVal: "{totalCalls} ÷ {sessions} = **{value} per session**",
      goodDirTitle: "Direction is ambiguous — yes, both extremes are bad",
      goodDirLead:
        "Unlike cache hit or one-shot, this metric isn't \"higher is better\" or \"lower is better.\" **Both too high and too low are bad.** Confusing is normal.",
      highBadTitle: "When higher is bad",
      highBadItems: [
        "Stuck in a retry loop (paired with low one-shot)",
        "Claude lacks context and re-reads the same file 5 times",
        "Multiple tasks mixed in one long session",
        "Vague instructions → Claude meanders",
      ],
      lowBadTitle: "When lower is bad",
      lowBadItems: [
        "Barely using Claude, writing yourself (not leveraging the tool)",
        "Single quick question then done (no automation benefit)",
        "Sessions too small — every session builds fresh context (cache wasted)",
      ],
      goodRange: "**Sweet spot: 30–80 calls per session.** Within that, you're fine.",
      methodsLead:
        "Don't tune calls/session directly. Make sessions match the work unit and the metric lands in the sweet spot on its own.",
      stepHigh:
        "**If too high (100+ calls)** — sessions are too long. Apply the cost/session playbook — cut at work units, wrap up at 70% context, one session = one task.",
      stepLow:
        "**If too low (under 10 calls)** — you're not leveraging Claude enough. Switch from \"I'll write this part myself\" to \"refactor this to pattern X\" — delegate work.",
      stepOneShot:
        "**Calls in range but one-shot low** — call count is fine but retry rate is high. Apply the one-shot playbook (more context + clearer instructions).",
      stepClaudeMd:
        "**Pin work patterns in CLAUDE.md** — \"Read before Edit,\" \"Auto-run tests.\" When Claude repeats the same pattern, call counts stabilize.",
      stepDeclare:
        "**Declare scope at session start** — \"Today only implement feature X, end when done.\" Claude stays in scope. Prevents infinite drift.",
      referenceBody:
        "Both extremes are bad, so no external anchor and no grade. Sweet spot is roughly 30–80 calls per session, but the normal range varies a lot by task type.",
      seeAlsoTitle: "Check alongside",
      seeAlso1:
        "• Low one-shot + high calls → retry loop. The worst signal.",
      seeAlso2:
        "• Normal one-shot, high calls → big task. Consider splitting.",
      seeAlso3:
        "• Low calls + high cost/session → too much packed per call. Context strain.",
    },
  },
  teamView: {
    loadFailed: "Failed to load team data.",
    retry: "Retry",
    loading: "Loading…",
    noSync: "no sync",
    daysAgoN: "{n}d ago",
    daysWarn: "⚠{n}d",
    summaryTotalTokens: "total tokens",
    summaryTotalCost: "total cost",
    summarySessions: "sessions",
    summaryActiveMembers: "active members",
    summaryAvgCacheHit: "avg cache hit",
    summaryAvgOneShot: "avg 1-shot",
    gradeBadge: "{g} {n}",
    membersCount: "{n} members",
    axHeadline: "🎯 AX score",
    teamMultiplier: "Team is using {x}× the enterprise adoption average",
    activeMembers: "Active {n}/{total}",
    planSavings: "Plan optimization could save ${n}/mo",
    noActivityPeriod: "No activity data in this period.",
    moreDetails: "Show details ▼",
    collapseDetails: "Collapse ▲",
    moreDetailsHint: "efficiency · team activities · by model · core tools · shell",
    moreBasicDetails: "Show basic team info ▼",
    moreBasicDetailsHint: "team usage · token unit cost · by member · activity · cost · power rank · daily unit cost · headline",
    moreDetailedDetailsAdmin: "Show detailed team info ▼",
    teamSum: "Team total",
    powerRankCard: "Power Index Rank",
    unitCostCardLabel: "Daily Unit Cost ($ / 1M)",
    estimateBadge: " (estimated)",
    unitCostFootnote: "Lower = better plan utilization · dashed = tier estimated · no-activity days break the line · log scale",
    industryUser: "Avg user",
    industryUserTop10: "Top 10% user",
    industryEnterpriseAvg: "Enterprise adoption avg",
    industryEnterpriseTop10: "Enterprise adoption top 10%",
    industryTop1: "Global top 1% (est.)",
    teamLabel: "z21labs Team",
    headlineTitle: "z21labs team headline — efficiency + industry comparison (last 30 days)",
    teamAvgN: " · team avg ({n} members)",
    vsEnterpriseAvg: "vs Enterprise adoption avg (${n})",
    activeUsageDescription: "Active Claude Code team",
    perActiveDayCompare: "$/active day comparison",
    sourceFootnote: "as of 2026-05 · source: Anthropic Claude Code official stats + community heavy-user reports",
    columnMember: "Member",
    columnUsage: "Usage",
    columnOverall: "Overall",
    selfMark: "(me)",
    tooltipTeamAvgMyValue: "Team avg {avg} · me {mine} ({delta})",
    tooltipUsageAvgMy: "Team avg {avgLvl}/10 ({avgTok}) · me {myLvl}/10 ({myTok})",
    activitiesMembersCount: "{n} members",
    planMember: "Member",
    planLastReceived: "Last received",
    planVisitsMonth: "Visits/mo",
    planAvgDwell: "Avg dwell",
    monthlyVisitsTitle: "Engagement · Daily visits (last 30 days)",
    visitsOfDay: "{date}: {n} visits",
    monthLabel: "M{n}",
    monthRow: "Mo",
    columnProject: "Project",
  },
  gradeDescriptions: {
    cacheHitExemplary: "Claude Code internal benchmark",
    cacheHitGood: "Good state",
    cacheHitModerate: "Typical range",
    cacheHitInsufficient: "Likely bloated CLAUDE.md",
    cacheHitWarning: "Anthropic-level incident (SEV)",
    oneShotExemplary: "Almost no retries. Clear context",
    oneShotModerate: "Normal range for messy coding",
    oneShotWarning: "Frequent Edit→Build→Edit loop",
    costExemplary: "Routine session size",
    costModerate: "Large work session — normal range",
    costWarning: "Mega session — split or check efficiency",
    tokenExemplary: "Heavy user. Power-user territory",
    tokenGood: "Above Anthropic enterprise P90 (~$30/day)",
    tokenModerate: "Anthropic avg ~ P90. Healthy activity",
    tokenInsufficient: "Light usage or barely using",
    tokenWarning: "Not used today",
  },
  dashboardView: {
    chartLoading: "Loading chart…",
    dataLoadFailed: "Failed to load data.",
    retry: "Retry",
    noDataYet: "No data yet.",
    staleSyncTitle: "Auto-sync stalled",
    staleSyncBody: "Last sync was {n}h ago. The launchd job may have broken, or your laptop has been off for a while.",
    staleSyncRepairLabel: "In a terminal:",
    staleSyncCopy: "Copy",
    staleSyncCopied: "Copied",
    previous: "Earlier ▼",
    daysAgoN: "{n}d ago",
    dayLabel: "{n}d ago ({date})",
    activeNDays: "Active {n} days",
    lastReceived: "Last received",
    tzChangeTitle: "Change timezone",
    referenceFigures: "Reference",
    gradeCriteria: "Grade criteria",
    explain: "Explain",
    moreUsage: "Use more",
    increase: "Increase",
    decrease: "Reduce",
    optimize: "Optimize",
    usage: "Usage",
    usageWithLevel: "Usage ({lvl}/10)",
    activityHeatmapLabel: "Activity heatmap ({weeks} weeks, by cost)",
    todayMark: "today",
    noActivityShort: "no activity",
    streakLabel: "Current cache hit ≥ 90% Streak",
    streakSkip: "Days with no activity are auto-skipped",
    weekTeamCacheRank: "This week — team cache hit rank",
    rankOutOf: "/ {n}",
    rankMeTeam: "Me {self}% · Team {team}%",
    teamRankEmpty: "No team rank data",
    recent90dEfficiency: "Last 24 weeks — efficiency",
    moreDetails: "Show details ▼",
    collapseDetails: "Collapse ▲",
    moreDetailsHint: "by model · by project · top sessions · by activity · tools · shell · MCP · dwell heatmap",
    gradeWarning: "Warning",
    gradeImprove: "Improve",
    gradeGood: "Good",
    gradeExemplary: "Exemplary",
    legendLow: "Low",
    legendHigh: "High",
    dayCellNoActivity: "{date} · no activity",
    dayCellScore: "{date} · {score} pts · {label}",
    dayCellCost: "{date} · ${cost}",
    todaySuffix: " · today",
    activeBlocksEmpty: "Not enough data — shown once 5+ blocks accumulate.",
    patternCriteriaSuffix: " criteria",
    patternDisclaimer: "Pattern is for self-awareness, not good/bad.",
    activeBlocks: "Active blocks",
    avgLength: "Avg length",
    tokensPerMin: "Tokens / min",
    longestBlock: "Longest block",
    deltaWindowTitle: "vs. previous same-length window",
    lengthDistribution: "Length distribution",
    dwellHeatmapLabel: "Dwell heatmap ({weeks} weeks, total minutes/day",
    dwellMonthVisits: " · this month {n} visits · avg {time}",
    inProgressAt: " (in progress · {hh}:{mm})",
    yesterdayN: "Yesterday {n}",
    closeUpTrend: "▲ Hide trend",
    openTrend: "▼ Show {period} trend",
    efficiencyTodayLabel: "Today's efficiency",
    efficiencyAvgLabel: "{period} avg efficiency",
    efficiencyFormula: "cache 42 + one-shot 18 + cost 10 + usage 30",
    patternImmersive: "Immersive",
    patternDistributed: "Distributed",
    patternBalanced: "Balanced",
    patternSporadic: "Sporadic",
    patternImmersiveTooltip:
      "Median 4h+ or 50%+ blocks ≥4h. Deep focus pattern — once started, fills nearly the entire 5h billing block.",
    patternDistributedTooltip:
      "Median <1h or 50%+ blocks <1h. Short, frequent sessions. Small work units or distributed work.",
    patternBalancedTooltip:
      "Median 1–4h with a mix of short and long blocks. Depth adjusted to task type.",
    patternSporadicTooltip:
      "Fewer than 10 active blocks. Occasional use — small sample size, lower reliability of other indicators.",
    dayOffsetYesterday: "yesterday",
    dayOffset2: "2 days ago",
    dayOffsetN: "{n} days ago",
    weekOffsetLast: "last week",
    weekOffsetN: "{n} weeks ago",
    monthOffsetLast: "last month",
    monthOffsetN: "{n} months ago",
    weekdaySun: "Sun",
    weekdayMon: "Mon",
    weekdayTue: "Tue",
    weekdayWed: "Wed",
    weekdayThu: "Thu",
    weekdayFri: "Fri",
    weekdaySat: "Sat",
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
