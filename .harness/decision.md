# decision.md — 의사결정 기록

> 대안 비교와 선택 이유가 있는 경우만 기록한다.

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
