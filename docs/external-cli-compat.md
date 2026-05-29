# 외부 CLI 호환성 매트릭스 — codeburn / ccusage

> 우리 ingest 가 의존하는 codeburn / ccusage 의 명령·옵션·응답 필드를 버전별로 추적한다. 핀 업그레이드 결정의 사람용 참조 자료.
>
> **현재 핀**: codeburn `0.9.7`, ccusage `19.0.2` ([web/src/lib/pinned-versions.ts:5](../web/src/lib/pinned-versions.ts#L5))
> **현재 latest** (2026-05-29 기준): codeburn `0.9.11`, ccusage `19.x` (자동 비교 스크립트 도입 시 갱신)
>
> 회귀 사례:
> - **ccusage 19.x `period` 키 회귀** — daily row 의 날짜 키 `date` → `period` 변경. industryComparison / teamScore / ingest filter 동시 손상. NEXA 사용자 0.42 → 43.62 (100배 차이). 2026-05-XX [normalizeCcusageRow](../web/src/lib/ccusage-row.ts) 단일화로 수습.
> - **codeburn 0.9.x 핀 동결** — 2026-05-18 [decision.md](../.harness/decision.md) 0.9.8 publish 취소 + 0.9.7 핀 채택. 근거 미상 (이 매트릭스가 그 근거 자리).

---

## 1. 우리 의존 surface

### 1-1. codeburn 호출 (총 2 종)

| # | 명령 | 호출 위치 | 용도 |
|---|---|---|---|
| C1 | `codeburn report --format json --provider claude --period <today\|week\|month\|30days\|all>` | [cli/src/submit.mjs:110](../cli/src/submit.mjs#L110), [sync.mjs:101](../cli/src/sync.mjs#L101), [index.mjs:1754](../cli/src/index.mjs#L1754), [sync.ts:13](../cli/src/sync.ts#L13) | 정기 수집 (SessionEnd hook + launchd/Task Scheduler) |
| C2 | `codeburn report --format json --provider claude --from <YYYY-MM-DD> --to <YYYY-MM-DD>` | [cli/src/historical.mjs](../cli/src/historical.mjs) (`spawnCodeburnRange`) | Historical backfill (지난 8주 + 12개월) |

**핵심**: `--provider claude` 명시. codeburn 의 멀티 provider 자동 감지 기본값 변경에 영향 받지 않는 안전 패턴.

### 1-2. ccusage 호출 (총 3 종)

| # | 명령 | 호출 위치 | 용도 |
|---|---|---|---|
| U1 | `ccusage daily --json` | [submit.mjs:137](../cli/src/submit.mjs#L137), [sync.mjs:126](../cli/src/sync.mjs#L126), [index.mjs:1779](../cli/src/index.mjs#L1779), [sync.ts:33](../cli/src/sync.ts#L33) | 정기 일별 토큰 분해 |
| U2 | `ccusage blocks --json` | [submit.mjs:278](../cli/src/submit.mjs#L278), [sync.mjs:151](../cli/src/sync.mjs#L151), [index.mjs:1804](../cli/src/index.mjs#L1804), [sync.ts:53](../cli/src/sync.ts#L53) | 5h 빌링 블록 wall-clock 분석 |
| U3 | `ccusage daily --since <YYYYMMDD> --until <YYYYMMDD> --json` | [historical.mjs:148](../cli/src/historical.mjs#L148) (`spawnCcusageRange`) | Historical 토큰 분해 |

### 1-3. codeburn 응답 필드 (우리가 읽는 것)

> 출처: [web/src/lib/sync/run-ingest.ts:30-52](../web/src/lib/sync/run-ingest.ts#L30-L52) (`CodeburnPeriodReport`), [web/src/app/api/dashboard/route.ts:478-499](../web/src/app/api/dashboard/route.ts#L478-L499) (projects/topSessions).

| 경로 | 타입 | 사용 위치 | 비고 |
|---|---|---|---|
| `body.all` | object | `getBaseReport()` | period=all 일 때 wrapper key |
| `body.today` | object | `getBaseReport()`, `deriveUserTodayFromBody()` | period=today 일 때 wrapper key |
| `body.overview.cost` | number | run-ingest `totalCost` | `body.summary.cost`, `overview.totalCost` 도 fallback |
| `body.overview.sessions` | number | run-ingest `sessionsCount` | `summary.sessions`, `overview.totalSessions` fallback |
| `body.overview.calls` | number | run-ingest `callsCount` | `summary.calls`, `overview.callsCount` fallback |
| `body.overview.tokens.input` | number | cacheHitPct 자체 계산 분모 | |
| `body.overview.tokens.cacheRead` | number | cacheHitPct 분자 | codeburn 의 `cacheHitPercent` 는 100 으로 박혀서 신뢰 X — 자체 계산 |
| `body.overview.tokens.cacheWrite` | number | cacheHitPct 분모 | |
| `body.overview.tokens.output` | number | (현재 미사용, dashboard 추후) | |
| `body.activities[].oneShotRate` | number\|null | `computeOverallOneShot()` 가중 평균 | |
| `body.activities[].turns` | number | oneShot 가중치 (sessions fallback) | |
| `body.activities[].sessions` | number | (turns 없을 때 가중치) | |
| `body.activities[].name` | string | dashboard 카드 라벨 | |
| `body.activities[].category` | string | dashboard 활동 분류 | |
| `body.activities[].cost` | number | dashboard 활동 비용 | |
| `body.today.daily[0].date` | string `YYYY-MM-DD` | `deriveUserTodayFromBody()` | timezone boundary 추출 |
| `body.today.period` | string | `deriveUserTodayFromBody()` | regex `(\d{4}-\d{2}-\d{2})` 매치 |
| `body.week`, `body.month`, `body.today` | object | run-ingest `weekData/monthData/dayData` | period scoped raw json 저장 |
| `body.projects[].name` | string | dashboard projects 카드 | |
| `body.projects[].path` | string | dashboard topSessions 매칭 | |
| `body.projects[].cost`/`sessions`/`calls`/`avgCost` | number | dashboard projects 카드 | |
| `body.topSessions[].id`\|`sessionId` | string | dashboard topSessions | |
| `body.topSessions[].date`/`project`/`cost` | mixed | dashboard topSessions | |
| `body.daily[]` (= `all.daily`) | array | dashboard heatmap + cost/calls/oneShotRate 결합 | |

**의존 안 함** (있어도 무시): `cacheHitPercent` (codeburn 자체 값 신뢰 X), `d.projects[].cacheHitPct`/`oneShotRate` (state.md "K 카드 보류" — codeburn 0.9.x 가 안 내려줌).

### 1-4. ccusage 응답 필드

> 출처: [run-ingest.ts:9-27](../web/src/lib/sync/run-ingest.ts#L9-L27) (`CcusageBlockRow`, `extractBlocks`), [web/src/lib/ccusage-row.ts](../web/src/lib/ccusage-row.ts) (`CcusageDailyRow`, `normalizeCcusageRow`).

**ccusage daily row** (`body.ccusageDaily.daily[]`):

| 필드 | 타입 | 사용 위치 | 비고 |
|---|---|---|---|
| `date` | string | normalize → `r.date` | **18.x 이전 키 (옛)** |
| `period` | string | normalize → `r.date` | **19.x 신 키 — `normalizeCcusageRow` 양쪽 수용** |
| `totalCost` | number | dashboard daily cost | (신) — `cost` fallback 함께 |
| `cost` | number | dashboard daily cost | (옛 / fallback) |
| `inputTokens` | number | dashboard cache hit non-cache 분모 | |
| `outputTokens` | number | dashboard 토큰 합계 | |
| `cacheReadTokens` | number | dashboard cache hit 분자 | |
| `cacheCreationTokens` | number | dashboard cache write | |
| `totalTokens` | number | dashboard 활용지수 / 토큰 단가 | |
| `modelsUsed` | string[] | dashboard 모델 표시 | |

**ccusage blocks row** (`body.ccusageBlocks.blocks[]`):

| 필드 | 타입 | 사용 위치 | 비고 |
|---|---|---|---|
| `id` | string | `userBlocks` PK | |
| `startTime`/`endTime`/`actualEndTime` | ISO string | `userBlocks` 분 계산 | `actualEndTime` null 인 active 는 스킵 |
| `isGap` | bool | gap 블록 스킵 | |
| `isActive` | bool | (정보용) | |
| `entries` | number | `userBlocks.entries` | |
| `totalTokens` | number | `userBlocks.totalTokens` | |
| `costUSD` | number | `userBlocks.costUsd` | |
| `models` | string[] | `userBlocks.models` | |

---

## 2. codeburn 버전 매트릭스 (0.9.x 시리즈)

> 출처: [getagentseal/codeburn CHANGELOG](https://github.com/getagentseal/codeburn/blob/main/CHANGELOG.md). 자동 비교 스크립트 도입 후 매 빌드 시 갱신.

| 버전 | 릴리즈 | 우리 surface 영향 | 변경 요지 |
|---|---|---|---|
| 0.9.0 | 2026-XX | ✓ 영향 없음 | Model name extraction from `turn_context` (Codex 강화) |
| 0.9.1~0.9.5 | 2026-XX | ✓ 영향 없음 | (내부 fix, 미세 조정) |
| 0.9.6 | 2026-XX | ✓ 영향 없음 | GPT-5.5 display name (Codex) |
| **0.9.7** (현 핀) | 2026-XX | 기준 | — |
| 0.9.8 | 2026-05-13~15 | ⚠️ 미확인 | (publish 취소 → 0.9.7 핀 채택. 매트릭스 첫 사용 시 조사) |
| 0.9.9 | 2026-XX | ⚠️ 영향 가능성 | Per-assistant-message turn grouping, `toolSequence` 필드 추가. activities 구조 변경 가능성 (turns / sessions semantics) |
| 0.9.10 | 2026-XX | ✓ 영향 없음 | Agent tool normalization regression test |
| 0.9.11 (latest) | 2026-05-27 | ✓ Codex only (provider=claude 호출이라 무관) | Codex file path extraction, `function_call` JSON 파싱 fix |

**판정 (사전 추정 — 자동 검증 대기)**:
- 0.9.7 → 0.9.11 핀 업 안전성: ✓ 거의 안전 (provider=claude 명시 호출이라 Codex 변경 영향 X). 단 0.9.9 turn grouping 의 activities 구조 영향 검증 필요.

## 3. ccusage 버전 매트릭스 (19.x 시리즈)

> 출처: [ryoppippi/ccusage](https://github.com/ryoppippi/ccusage). 매트릭스 첫 사용 시 정확한 버전별 표 채움.

| 버전 | 우리 surface 영향 | 변경 요지 |
|---|---|---|
| ~18.x | 기준 (옛 schema) | `daily[].date` 키 |
| **19.0.2** (현 핀) | ⚠️ `daily[].date` → `daily[].period` 키 변경 | [normalizeCcusageRow](../web/src/lib/ccusage-row.ts) 로 양쪽 수용. 미적용 시 industryComparison / teamScore / ingest filter 동시 손상. |
| 19.x latest | ⚠️ 미확인 | Codex 지원 (`ccusage codex daily`), Cursor 지원. 우리는 default scope (Claude) 만 호출 — provider 분리 호출 검토 (run 의 후속 결정). |

**판정 (사전 추정)**:
- 19.0.2 → 19.x latest 핀 업: ⚠️ 검증 필요. 신규 필드 (provider tag 등) 추가는 raw json 저장이라 안전. 단 `daily[]` 키 추가 변경 가능성 / `--since`/`--until` 인자 호환성 우선 확인.

---

## 4. 알려진 회귀 사례 (이 매트릭스가 막아야 할 것)

| 사례 | 원인 | 영향 | 처치 |
|---|---|---|---|
| ccusage 19.x `period` 키 | daily row 의 날짜 키 `date` → `period` 변경 | industryComparison / teamScore / ingest filter 동시 손상 → NEXA 사용자 0.42 → 43.62 (100배) | [normalizeCcusageRow](../web/src/lib/ccusage-row.ts) 단일화 |
| codeburn `cacheHitPercent` 100 박힘 | codeburn 자체 버그 | cache hit 항상 100% 표시 | run-ingest 가 raw token 분모로 자체 계산 (run-ingest.ts:176-182) |
| codeburn `today` UTC 기준 | codeburn 버그 | SGT/KST 사용자 자정~UTC 자정 사이 어제 날짜 | `deriveUserTodayFromBody` 가 codeburn + ccusage max 채택 (run-ingest.ts:124-152) |
| codeburn `d.projects[].cacheHitPct/oneShotRate` 누락 | codeburn 0.9.x 미구현 | K 카드 보류 ([state.md](../.harness/state.md)) | upstream PR 또는 0.9.x 신 minor 대기 |

---

## 5. 격리 원칙 (자동 검증의 invariant)

> 이 매트릭스를 자동 갱신하는 스크립트 + CI 가 사용자 PC 의 글로벌 codeburn / ccusage 설치를 절대 건드리지 않는다.

- 비교 스크립트 ([scripts/check-cli-compat.ts](../scripts/check-cli-compat.ts) — TBD) 는 `mkdtempSync('/tmp/cli-compat-')` 에 `npm install codeburn@X.Y.Z` (글로벌 X, 로컬만).
- 끝나면 temp dir cleanup.
- CI 는 GitHub Actions runner fresh VM — 자연 격리.
- 사용자 PC 의 `/opt/homebrew/bin/codeburn`, `~/.usage-tracker/runtime/node_modules/codeburn` 은 절대 안 건드림.
- 단위 테스트: 스크립트 실행 전·후 `which codeburn` / `npm ls -g codeburn` 결과 byte-identical 확인.

---

## 6. 자동 갱신 (TBD — 단계 4-6 산출물)

- [scripts/check-cli-compat.ts](../scripts/check-cli-compat.ts): 인자 `--package codeburn --from 0.9.7 --to 0.9.11`. temp dir + npm install + fixture run-ingest + JSON diff + markdown 리포트.
- [scripts/lib/compat-report.ts](../scripts/lib/compat-report.ts): 4블록 리포트 포맷 (판정 / 변경 / 우리 영향 / fixture 결과 / 권장 조치).
- [.github/workflows/cli-compat-check.yml](../.github/workflows/cli-compat-check.yml): cron `0 9 * * *` (KST 18시) + latest 비교 + 다르면 비교 스크립트 + GitHub issue + 알림.

매 cron 실행 결과가 이 문서의 §2, §3 표를 자동 PR 로 갱신하는 것이 목표.

---

## 7. 핀 업 판단 흐름 (사람용 1-2분 가이드)

새 버전 호환성 리포트를 받았을 때:

1. **판정** (✓/⚠️/❌) 우선 확인.
2. **변경 항목** 중 "우리 surface 영향" 컬럼 ⚠️ 만 추려서 본다.
3. **fixture 결과** pass 인가? fail 케이스가 §4 알려진 회귀와 유사한가?
4. ✓ 안전 → [pinned-versions.ts:5](../web/src/lib/pinned-versions.ts#L5) + [cli/src/init.ts:747](../cli/src/init.ts#L747)/[L767](../cli/src/init.ts#L767) 한 줄씩 갱신 → PR.
5. ⚠️ 주의 → 리포트 권장 조치 (예: run-ingest.ts:XXX 한 줄 fix) 먼저 적용 → 재검증 → 그때 핀 업.
6. ❌ 위험 → 핀 동결 유지. backlog 등록.

핀 업 자체는 항상 사람 결정. 자동 PR 까진 만들 수 있어도 머지는 사람.
