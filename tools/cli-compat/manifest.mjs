// 우리가 ccusage / codeburn 에 "실제로 의존하는 계약" — 명령·옵션·소비 필드.
//
// 출처(코드): web/src/lib/sync/run-ingest.ts, web/src/lib/ccusage-row.ts,
//             cli/src/submit.mjs (호출 명령), docs/external-cli-compat.md §1
//
// 안전 게이트(tools/cli-compat/verify.mjs)는 핀 버전과 latest 를 둘 다 실제로 돌려
// 아래 필드가 "구조적으로(키 존재 + 타입)" 유지되는지 대조한다. 값(숫자) 변동은 보지
// 않는다 — 그건 릴리즈 노트로 별도 표시.
//
// severity:
//   "critical" — ingest 시 DB 에 저장되는 필드. 사라지거나 타입 바뀌면 데이터 깨짐 → 발송.
//   "soft"     — fixture 데이터에 따라 안 나올 수 있는 필드(예: activities). 없으면 경고만.
//
// synonyms: 우리 코드(normalizeCcusageRow / getBaseReport)가 동의어를 수용하므로
//           "이 중 하나라도" 있으면 통과. 전부 사라져야 breaking.

export const PINNED_FILE = "web/src/lib/pinned-versions.ts";

// type 토큰: "number" | "string" | "array" | "object" (배열·객체 둘 다 허용 시 배열로 나열)
export const CONTRACT = {
  ccusage: {
    npm: "ccusage",
    githubRepo: "ryoppippi/ccusage",
    pinKey: "CCUSAGE",
    // HOME=fixtures/claude-home (~/.claude) / fixtures/codex-home (~/.codex)
    probes: [
      {
        provider: "claude",
        home: "claude-home",
        argv: ["claude", "daily", "--json", "--offline"],
        rows: { path: "daily", min: 1 },
        rowFields: [
          { name: "date", synonyms: ["date", "period"], type: "string", severity: "critical" },
          { name: "totalCost", synonyms: ["totalCost", "costUSD"], type: "number", severity: "critical" },
          { name: "inputTokens", type: "number", severity: "critical" },
          { name: "outputTokens", type: "number", severity: "critical" },
          { name: "cacheCreationTokens", type: "number", severity: "critical" },
          { name: "cacheReadTokens", synonyms: ["cacheReadTokens", "cachedInputTokens"], type: "number", severity: "critical" },
          { name: "totalTokens", type: "number", severity: "critical" },
          { name: "modelsUsed", synonyms: ["modelsUsed", "models"], type: ["array", "object"], severity: "critical" },
        ],
      },
      {
        provider: "codex",
        home: "codex-home",
        argv: ["codex", "daily", "--json", "--offline"],
        rows: { path: "daily", min: 1 },
        // Codex schema 는 동의어 쪽(costUSD/cachedInputTokens/models) 으로 나옴 — normalize 가 통일.
        rowFields: [
          { name: "date", synonyms: ["date", "period"], type: "string", severity: "critical" },
          { name: "totalCost", synonyms: ["totalCost", "costUSD"], type: "number", severity: "critical" },
          { name: "inputTokens", type: "number", severity: "critical" },
          { name: "outputTokens", type: "number", severity: "critical" },
          { name: "cacheReadTokens", synonyms: ["cacheReadTokens", "cachedInputTokens"], type: "number", severity: "critical" },
          { name: "totalTokens", type: "number", severity: "critical" },
          { name: "modelsUsed", synonyms: ["modelsUsed", "models"], type: ["array", "object"], severity: "critical" },
        ],
      },
    ],
  },

  codeburn: {
    npm: "codeburn",
    githubRepo: "getagentseal/codeburn",
    pinKey: "CODEBURN",
    probes: [
      {
        provider: "claude",
        home: "claude-home",
        argv: ["report", "--format", "json", "--provider", "claude", "--period", "all"],
        // getBaseReport 가 all/today wrapper 를 벗기지만, --period all 출력은 top-level 에
        // overview 가 바로 있다(검증 완료). object 경로로 확인.
        objectFields: [
          { path: "overview.cost", synonyms: ["overview.cost", "overview.totalCost", "summary.cost"], type: "number", severity: "critical" },
          { path: "overview.sessions", synonyms: ["overview.sessions", "overview.totalSessions", "summary.sessions"], type: "number", severity: "critical" },
          { path: "overview.calls", synonyms: ["overview.calls", "overview.callsCount", "summary.calls"], type: "number", severity: "critical" },
          { path: "overview.tokens.input", type: "number", severity: "critical" },
          { path: "overview.tokens.output", type: "number", severity: "critical" },
          { path: "overview.tokens.cacheRead", type: "number", severity: "critical" },
          { path: "overview.tokens.cacheWrite", type: "number", severity: "critical" },
        ],
        // activities 는 fixture 가 활동 분류를 만들 만큼 풍부해야 채워짐 → soft.
        rows: { path: "activities", min: 0 },
        rowFields: [
          { name: "name", type: "string", severity: "soft" },
          { name: "category", type: "string", severity: "soft" },
          { name: "oneShotRate", type: ["number", "null"], severity: "soft" },
          { name: "turns", type: "number", severity: "soft" },
        ],
      },
      {
        provider: "codex",
        home: "codex-home",
        argv: ["report", "--format", "json", "--provider", "codex", "--period", "all"],
        objectFields: [
          { path: "overview.cost", synonyms: ["overview.cost", "overview.totalCost", "summary.cost"], type: "number", severity: "critical" },
          { path: "overview.sessions", synonyms: ["overview.sessions", "overview.totalSessions", "summary.sessions"], type: "number", severity: "critical" },
          { path: "overview.calls", synonyms: ["overview.calls", "overview.callsCount", "summary.calls"], type: "number", severity: "critical" },
          { path: "overview.tokens.input", type: "number", severity: "critical" },
          { path: "overview.tokens.output", type: "number", severity: "critical" },
        ],
      },
    ],
  },
};
