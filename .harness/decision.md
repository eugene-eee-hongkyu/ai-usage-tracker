# decision.md — 의사결정 기록

> 대안 비교와 선택 이유가 있는 경우만 기록한다.

---

## 2026-04-30: 비용 데이터 소스를 codeburn → ccusage로 교체

- **선택**: Daily Cost·Overview cost·Efficiency 지표의 출처를 ccusage daily로 교체
- **대안 검토**:
  - **codeburn 유지**: 기존 파이프라인 변경 없음. 단, week period가 rolling 7일이라 경계일(4/22 등)에서 cost가 심하게 잘림 ($7.10 vs 실제 $117). 근본 수정하려면 codeburn 쪽 period 로직 패치 필요
  - **ccusage daily 사용**: 토큰 4종(input/output/cacheRead/cacheWrite)을 이미 수집하고 있고, 일별 단위로 정확한 비용 산출 가능. 추가 의존성(ccusage CLI)이 생기지만 init/repair에서 자동 설치로 해결
- **선택 이유**: codeburn의 rolling window 문제는 구조적이라 단순 패치가 어렵고, ccusage는 이미 토큰 연동을 위해 추가한 상태여서 비용 소스로도 쓰면 단일 출처(single source of truth) 달성
- **영향 범위**: `submit.mjs`, `sync.ts` (데이터 수집), Dashboard의 Daily Cost·Overview Bar·Efficiency 카드, 스냅샷 promote 로직 (`rawJson.ccusageDaily`)
- **되돌리는 방법**: Dashboard 카드에서 `ccusageDaily` 대신 `codeburn` 필드를 다시 참조하도록 변경. submit/sync에서 ccusage 호출 제거. 단, codeburn rolling window 문제는 별도 해결 필요


## 2026-04-29: 주별/월별 스냅샷 누적 — 별도 테이블 + Monthly 옵션 A (in-progress 보존)

- **선택**: `period_snapshots` 테이블 신설(50주/12달 retention) + `user_snapshots`에 `current_week/month_raw_json` + `_start` 4컬럼 추가. 매 ingest 시 경계 감지하여 직전 데이터 promote
- **대안 검토**:
  - _현 상태 유지 (rolling 7d만)_: 가장 단순. 단 "지난주" 같은 요청 충족 불가
  - _user_snapshots에 JSONB 배열 컬럼_: 단순하지만 무한 누적, 풀 디코드 부담
  - _별도 테이블 (선택)_: PRIMARY KEY (user, type, period_start) 인덱스로 쿼리 깔끔. 10명 × 62 = 620 rows/년 → 무시 가능
  - _Monthly 옵션 B (30days fallback)_: 단순하나 캘린더 월과 어긋남(4/2~5/1을 "4월"이라 표기 → 혼란)
  - _Monthly 옵션 A (선택)_: in-progress month 데이터 보존 후 월 경계에 promote → 캘린더 월 정확도 보장. 추가 상태(`current_month_raw_json`) 1개 + ingest if문 비용
- **선택 이유**:
  - codeburn은 calendar week를 별도로 노출하지 않으나 `month`는 캘린더 월. activities/projects/topSessions는 raw 세션 단위 노출 안 됨 → 우리가 캡처 시점 데이터를 그대로 보존하는 것이 유일한 방법
  - 주별/월별 일관된 패턴(symmetrical promote-on-boundary)으로 유지보수성 ↑
  - 50주/12달 보관 시 약 50MB → Supabase 무료 티어 500MB 대비 10%
- **영향 범위**: `web/drizzle/0001_period_snapshots.sql`, `schema.ts`, `api/ingest/route.ts`, `api/dashboard/route.ts`, `dashboard-view.tsx`
- **되돌리는 방법**: `DROP TABLE period_snapshots`, `ALTER TABLE user_snapshots DROP COLUMN current_*` 4개. 코드는 git revert `6e42db2`

---

## 2026-04-29: 스냅샷 캡처 정책 — 항상 캡처 + 캡처 시간/범위 표시 (임계 없음)

- **선택**: 매 sync마다 경계 넘어가면 무조건 promote. UI에 `📌 captured 2026-04-29 00:01 KST · 4/22-4/28` 표시해서 사용자가 신뢰도 판단
- **대안 검토**:
  - _임계 정해서 늦으면 폐기 ("수요일 지나면 데이터 없음")_: 깔끔. 단 보더라인(화 23:59 vs 수 00:00) 자의적, 데이터 손실
  - _신뢰도 라벨 ("불완전 캡처" 경고)_: 절충. 라벨 기준 정의 필요
  - _항상 캡처 + 범위 명시 (선택)_: 데이터 손실 0, 사용자가 캡처 시간과 daily 첫/끝 보고 직접 판단
- **선택 이유**: codeburn week가 rolling 7d라 "정확한 일~일" 보장 불가능. 임계 정해도 1~6시간 단위 보더라인은 항상 발생. 캡처 시간을 명시하면 사용자가 알아서 판단 → 시스템 단순화 + 데이터 보존
- **영향 범위**: `dashboard-view.tsx` 마지막 수신 영역, `api/dashboard/route.ts` snapshot 메타 응답
- **되돌리는 방법**: ingest의 promote 직전에 `now - prev.updatedAt < threshold` 가드 추가

---

## 2026-04-28: 데이터 수집 트리거 — launchd 4회 단독 (hook 완전 제거)

- **선택**: launchd 0/6/12/18시 4회만 유지. SessionStart/SessionEnd hook 완전 제거
- **대안 검토**:
  - _SessionStart + SessionEnd + launchd 4회 (오전 결정)_: 실제 운영 시 SessionStart + SessionEnd 동시 발화 → lock 충돌로 누락. codeburn "Today" period 레이블이 KST 기준 하루 뒤처지는 버그도 확인
  - _lock TTL 조정_: 근본적 해결 아님. 동시 발화 자체를 막을 수 없음
  - _launchd 4회 단독 (선택)_: 최대 6시간 지연이지만 누락 없음. "한 달에 한 번 보면 성공" 목표에 충분
- **선택 이유**: hook 기반 수집의 구조적 한계(동시 발화 lock 충돌, VSCode 강제 종료 시 미보장)를 확인. 6시간 지연은 제품 목표 대비 허용 가능. 단순화로 신뢰성 확보
- **영향 범위**: `cli/src/init.ts` (mergeHook → removeHook), `~/.claude/settings.json` (SessionStart/SessionEnd submit.mjs 항목 제거), `~/Library/LaunchAgents/*.plist`
- **되돌리는 방법**: `removeHook` → `mergeHook`으로 되돌리고 rebuild/push 후 repair 재실행

---

## 2026-04-27: Cache hit 공식 — 표준 공식 (cacheWrite 분모 포함)

- **선택**: `cacheRead ÷ (cacheRead + cacheWrite + input) × 100` (Anthropic 표준)
- **대안 검토**:
  - _옵션 A: codeburn 값 그대로_: 추가 계산 없음. 단 cacheWrite 제외로 99.99% → 100% 표시. 사용자가 "더 줄일 게 없다"고 오판
  - _옵션 B: 표준 공식 재계산_: 선택. raw 토큰(`tokens.cacheRead/Write/input`)이 JSON에 있어 재계산 비용 없음. 95.66% 정확 표시
  - _옵션 C: 두 값 모두 표시_: 정확 + 혼란 없음. UI 복잡도 증가
- **선택 이유**: 도구의 핵심 가치는 신뢰할 수 있는 효율 가이드. 100% 표시는 사실 왜곡. raw 토큰이 이미 JSON에 있어 구현 비용 0
- **영향 범위**: `web/src/app/api/dashboard/route.ts` (overview + per-model), `web/src/components/metric-modal.tsx` (모달 공식 주석)
- **되돌리는 방법**: `route.ts`에서 `tRead/(tRead+tWrite+tInput)` → `ov.cacheHitPercent` 폴백 코드로 되돌리기

---

## 2026-04-27: 긴 카드 컨텐츠 처리 — 헤더 카운트 + 하단 페이드

- **선택**: 헤더에 `(N)` 숫자 + 7개 이상 시 하단 페이드 그라디언트
- **대안 검토**:
  - _카드 내부 max-height + 스크롤_: 직관적. 단 페이지 스크롤과 카드 스크롤 이중 공존
  - _"+N more" 링크 유지_: 기존 방식. 데이터 잘림 + detail 페이지 이동 필요
  - _헤더 카운트 + 페이드_: 선택. 페이지 스크롤 단일 유지, JS 없이 CSS만으로 구현, 숫자로 총량 인지
- **선택 이유**: 카드 내부 이중 스크롤 없이 UX 단순. 구현 간단 (절대 위치 div + Tailwind gradient)
- **영향 범위**: `web/src/app/dashboard/page.tsx` By Project/Activity/Core Tools/Shell Commands/MCP Servers 카드
- **되돌리는 방법**: `relative` wrapper 및 fade div 제거, 헤더 카운트 span 제거

---

## 2026-04-26: multi-period sync 전략 — codeburn 4회 병렬 호출

- **선택**: `sync.ts`에서 `--period today/week/month/all` 4번 병렬 호출, rawJson을 `{ today, week, month, all }` 중첩 구조로 저장
- **대안 검토**:
  - _단일 `--period all` 호출 유지_: 간단하지만 period 탭이 chart 외엔 모두 동일 데이터 → UX 저하
  - _daily 배열 날짜 필터로 period 계산_: `daily`는 가능하나 `activities`/`projects`/`topSessions`는 날짜 정보 없어 불가
  - _codeburn 4회 병렬 호출_: 선택. 실제로 period별 다른 데이터 리턴 확인 (week $769 vs all $1395)
- **선택 이유**: codeburn이 `--period` 플래그로 실제 다른 JSON 리턴함을 Bash 직접 확인. period별 완전한 데이터 분리 가능
- **영향 범위**: `cli/src/sync.ts`, `web/src/app/api/ingest/route.ts`, `web/src/app/api/dashboard/route.ts`
- **되돌리는 방법**: sync.ts를 단일 `--period all` 호출로 되돌리고 getPeriodData flat fallback 경로로 운영

## 2026-04-26: 대시보드 디자인 — codeburn terminal 스타일 웹 적용

- **선택**: `bg-neutral-950` 다크 테마 + 섹션별 좌측 컬러 border + `font-mono` 수치 표시
- **대안 검토**:
  - _기존 slate/indigo 카드 유지_: 이미 구현된 상태. codeburn과 시각 언어 불일치
  - _codeburn 완전 복제 (순수 terminal 폰트)_: 웹 맥락에서 어색, 반응형 불리
  - _codeburn 색상만 웹 네이티브로 적용_: 선택. monospace + 컬러 코딩 유지하되 카드/반응형 구조는 웹 방식
- **선택 이유**: 사용자가 "codeburn 톤에 맞춰달라" 요청. 터미널 완전 복제보단 색상·밀도만 차용이 실용적
- **영향 범위**: `web/src/app/dashboard/page.tsx` 전면 재작성
- **되돌리는 방법**: 이전 slate/indigo 버전은 git 히스토리 commit `a83553d` 이전에 보존

---

## 2026-04-26: ccusage → codeburn 마이그레이션 + DB 2-table JSONB 재설계

- **선택**: codeburn으로 완전 교체, DB를 `users` + `user_snapshots`(JSONB) 2개 테이블로 재설계
- **대안 검토**:
  - ccusage 유지: one-shot rate가 항상 0 (하드코딩 버그), 개선 불가
  - ccusage + codeburn 병행: 정합성 문제 + 의존성 2배, 원래 단일 의존성 목표에 반함
  - 정규화 4개 테이블: 빌드 시간 증가, 10명 규모에서 JSONB 대비 이득 없음
- **선택 이유**: codeburn이 activities별 one-shot rate를 정확히 제공함. JSONB는 스키마 변경 없이 신규 지표 추가 가능. mirror columns 5개(total_cost, sessions_count, calls_count, cache_hit_pct, overall_one_shot)로 팀랭킹 정렬 성능 확보.
- **영향 범위**: 전체 웹 API, UI, CLI (16단계 구현)
- **되돌리는 방법**: sessions/dailyAgg 테이블 복원 + 이전 ingest/dashboard/team API 복원

## 2026-04-26: MVP 합성 점수 — one-shot × cache hit / 세션당 비용으로 교체

- **선택**: `efficiencyScore = overallOneShot × cacheHitPct / (totalCost / sessionsCount)`
- **대안 검토**: 이전 점수(cache hit% × 100 / 세션당 비용)는 one-shot rate를 포함 못 함 (ccusage에서 0으로 하드코딩됨)
- **선택 이유**: codeburn activities에서 정확한 one-shot rate가 나오므로 3개 지표 합성이 가능해짐
- **영향 범위**: `lib/rules/index.ts`, `api/team/route.ts`, `team/page.tsx`
- **되돌리는 방법**: computeEfficiencyScore 인수를 cacheRead/cacheWrite/totalCost/sessionsCount로 복원

---

## 2026-04-26: 최고 효율 지표 — cache hit% × 100 / 세션당 비용 채택

- **선택**: `efficiencyScore = (cacheRead / (cacheRead + cacheWrite)) × 100 × 100 / (totalCost / sessionsCount)`
- **대안 검토**:
  - oneShotRate (기존): `submit.mjs`에서 oneShotEdits/totalEdits 하드코딩 0 → 항상 0, 의미 없음
  - 토큰 대비 비용 (cost/tokens): 모델 선택(Sonnet vs Haiku)만으로 1등 결정 가능 — 실력 아님
  - 세션당 비용 단독: 짧은 세션만 자주 여는 사람이 유리 — 단일 지표 편향
  - cache hit 단독: 10명 모두 95% 근처라 변별력 없음
  - 합성 점수 (선택): cache hit(질) × 1/세션당 비용(효율) — 두 요소 동시 반영
- **선택 이유**: 사내 10명 규모에서 활동량 보정(log) 불필요. 수식이 직관적이고 "캐시 잘 쓰면서 + 작업당 싸게"라는 의도에 정합.
- **영향 범위**: `lib/rules/index.ts`, `api/team/route.ts`, `team/page.tsx`
- **되돌리는 방법**: `computeEfficiencyScore` → `computeTodayMvpScore(tokens, oneShotRate)`로 복원, `byEfficiency` 정렬 기준을 `oneShotRate`로 복원

---

## 2026-04-25: CLI npx 배포 방식 — bun 번들 채택

- **선택**: `bun build`로 JS 의존성 인라인 번들 → `cli/bin/cli.mjs` 커밋, root `package.json` bin 참조
- **대안 검토**:
  - root `package.json`에 모든 deps 추가: workspace 구조 유지하면서 가능하지만, keytar(native) 포함 시 node-gyp 빌드 실패 위험
  - CLI TypeScript 직접 참조 + tsx 실행: 사용자 머신에 tsx 설치 필요, 신뢰성 낮음
  - 번들(선택): 순수 JS 의존성 인라인, keytar만 optional external — npx 설치 시 의존성 문제 없음
- **선택 이유**: `commander` 등 순수 JS 패키지는 번들로 인라인하면 npm 의존성 해결 불필요. keytar는 동적 import + try/catch fallback이라 설치 실패해도 파일 저장으로 대체됨.
- **영향 범위**: `cli/bin/cli.mjs` (빌드 산출물, 커밋 대상), root `package.json`, `.gitignore`
- **되돌리는 방법**: root `package.json`에 `commander`, `keytar`, `open` dependencies 추가 후 bin을 `cli/src/index.mjs`로 변경
