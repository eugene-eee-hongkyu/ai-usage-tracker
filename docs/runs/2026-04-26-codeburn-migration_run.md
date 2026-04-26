---
name: codeburn migration
slug: codeburn-migration
type: deployment
status: 완료
created: 2026-04-26 16:30
completed: 2026-04-26
---

# codeburn migration

ccusage를 제거하고 codeburn으로 데이터 수집을 교체한다.
DB를 2-table JSONB 구조로 재설계하고, 대시보드·팀랭킹 UI를 전면 갱신한다.

## 완료 기준

- [x] `npx github:eugene-eee-hongkyu/ai-usage-tracker init`이 codeburn 설치 확인 + hook 등록까지 정상 완료됨
- [x] CLI submit.mjs가 codeburn JSON을 POST → 대시보드에 활동별 one-shot rate, 프로젝트별 비용, Top sessions 표시됨
- [x] 팀랭킹 MVP 점수가 one-shot × cache hit / 세션당 비용 합성 점수로 계산됨

## 한눈에 보기

### 개발 계획 관점 — 구현

| 단계 | 구현 파일/컴포넌트 | 검증 주체 |
|---|---|---|
| 1. DB 스키마 교체 | `lib/db/schema.ts` — userSnapshots 추가, sessions/dailyAgg/suggestionFeedback 제거 | AI |
| 2. Supabase 마이그레이션 SQL | `docs/migration.sql` — DROP old tables + CREATE user_snapshots | 사람 |
| 3. ingest API 재작성 | `api/ingest/route.ts` — codeburn JSON 수신 + user_snapshots upsert | AI |
| 4. dashboard API 재작성 | `api/dashboard/route.ts` — user_snapshots 조회, daily[] 기간 필터 | AI |
| 5. team API 재작성 | `api/team/route.ts` — mirror columns 정렬, MVP 합성 점수 | AI |
| 6. setup/status API 수정 | `api/setup/status/route.ts` — user_snapshots 존재 여부 | AI |
| 7. members API 재작성 | `api/members/[userId]/route.ts` — user_snapshots에서 heatmap 데이터 | AI |
| 8. rules 정리 | `lib/rules/index.ts` — suggestion 제거, MVP score 함수만 유지 | AI |
| 9. 대시보드 UI 전면 갱신 | `dashboard/page.tsx` — 비용 차트, 효율 4지표, activities, projects, top sessions | AI |
| 10. 대시보드 디테일 갱신 | `dashboard/detail/page.tsx` — projects + codeburn optimize 링크 | AI |
| 11. 팀랭킹 UI 갱신 | `team/page.tsx` — 정확도·효율·활동 3카드 | AI |
| 12. 멤버 프로필 갱신 | `team/[userId]/page.tsx` — heatmap을 cost 기반으로 교체 | AI |
| 13. CLI init 수정 | `cli/src/init.ts` — codeburn 설치 확인/안내 추가 | AI |
| 14. CLI submit 재작성 | `cli/src/submit.mjs` — ccusage → codeburn report --format json --provider claude --period all | AI |
| 15. CLI sync 재작성 | `cli/src/sync.ts` + `sync.mjs` — ccusage → codeburn | AI |
| 16. CLI 번들 재빌드 | `bun build` → `cli/bin/` 갱신 후 커밋 | AI |

### 개발 계획 관점 — 테스트

| 단계 | 단위 테스트 | 통합 테스트 |
|---|---|---|
| 1. DB 스키마 교체 | tsc --noEmit 타입 체크 | - |
| 2. Supabase 마이그레이션 | SQL 구문 검토 (AI) | 사람이 Supabase SQL 에디터에서 실행 |
| 3. ingest API | 실제 codeburn JSON으로 curl POST 테스트 | CLI submit → 서버 수신 확인 |
| 4. dashboard API | 로컬 curl 또는 브라우저 /api/dashboard 호출 | 대시보드 화면 렌더링 확인 |
| 5. team API | curl /api/team | 팀랭킹 화면 렌더링 확인 |
| 6–8. 나머지 API | tsc --noEmit | 관련 화면 동작 확인 |
| 9–12. UI | tsc --noEmit + Playwright 스크린샷 | 주요 섹션 데이터 표시 확인 |
| 13–15. CLI | bun build 성공 여부 | npx init 로컬 실행 시나리오 |
| 16. CLI 번들 | 번들 파일 존재 + 실행 가능 여부 | - |

### 완료 기준 관점

| 완료 기준 | 핵심 구현 | 검증 방법 | 검증 주체 |
|---|---|---|---|
| npx init → codeburn 설치 + hook 등록 | `cli/src/init.ts`, `submit.mjs` 번들 | 로컬 npx 실행 후 .claude/settings.json hook 등록 확인 | 사람 |
| 대시보드 activities/projects/top sessions 표시 | `api/ingest`, `api/dashboard`, `dashboard/page.tsx` | Playwright 스크린샷으로 각 섹션 데이터 확인 | AI |
| 팀랭킹 MVP 합성 점수 | `api/team/route.ts`, `lib/rules/index.ts` | /api/team JSON에서 efficiencyScore 필드 확인 | AI |

## 개발 계획

1. **DB 스키마 교체**: `lib/db/schema.ts` — sessions/dailyAgg/suggestionFeedback 삭제, `userSnapshots` 테이블 추가 (user_id unique, raw_json JSONB, mirror 5컬럼)
2. **Supabase 마이그레이션 SQL**: `docs/migration.sql` 생성 — 기존 3개 테이블 DROP, user_snapshots CREATE
3. **ingest API 재작성**: `api/ingest/route.ts` — codeburn JSON 전체 수신, overallOneShot 계산(activities 가중 평균), user_snapshots upsert, users.lastSyncedAt 갱신
4. **dashboard API 재작성**: `api/dashboard/route.ts` — snapshot.rawJson 파싱, daily[] 기간 필터로 차트 데이터, 효율 지표는 overview에서
5. **team API 재작성**: `api/team/route.ts` — mirror columns 정렬, efficiencyScore = overallOneShot × cacheHitPct / (totalCost/sessionsCount)
6. **setup/status API 수정**: `api/setup/status/route.ts` — sessions 대신 user_snapshots 존재 여부 체크
7. **members API 재작성**: `api/members/[userId]/route.ts` — rawJson.daily[]로 heatmap, rawJson.projects[]로 프로젝트 목록
8. **rules 정리**: `lib/rules/index.ts` — generateSuggestions 제거, computeEfficiencyScore/generateMvpBlurb 시그니처를 새 데이터 구조에 맞게 수정
9. **대시보드 UI 전면 갱신**: `dashboard/page.tsx` — 비용 차트(daily.cost), 효율 4지표(cache hit/세션당 비용/one-shot rate/avg turns), activities(null 필터), projects(cost/sessions/avgCost), top sessions
10. **대시보드 디테일 갱신**: `dashboard/detail/page.tsx` — projects 상세 + "터미널에서 codeburn optimize 실행" 안내 카드
11. **팀랭킹 UI 갱신**: `team/page.tsx` — 3카드(최고 정확도/최고 효율/최다 활동), MVP 합성 점수 blurb 갱신
12. **멤버 프로필 갱신**: `team/[userId]/page.tsx` — heatmap 레벨을 tokens → cost 기반으로, 프로젝트 목록 cost 기준
13. **CLI init 수정**: `cli/src/init.ts` — codeburn 설치 여부 확인(`which codeburn`), 미설치 시 `npm install -g codeburn` 실행 또는 안내
14. **CLI submit 재작성**: `cli/src/submit.mjs` — ccusage spawn 제거, codeburn report --format json --provider claude --period all spawn + POST
15. **CLI sync 재작성**: `cli/src/sync.ts` + `sync.mjs` — 동일하게 codeburn으로 교체
16. **CLI 번들 재빌드**: `bun build` → cli/bin/ 갱신, git commit

## 단위 테스트 계획

- **schema.ts**: `tsc --noEmit` 타입 오류 없음 확인
- **ingest API**: codeburn JSON 샘플로 curl POST → 200 응답 + DB row 확인
- **dashboard API**: curl /api/dashboard → rawJson 파싱 결과 확인
- **team API**: curl /api/team → efficiencyScore 필드 존재 확인
- **rules.ts**: computeEfficiencyScore 반환값 수동 계산과 일치 확인
- **CLI submit.mjs**: ⚠️ 직접 실행 불가 — 실제 codeburn + 네트워크 의존. 수동: `node cli/src/submit.mjs` 후 서버 로그 확인
- **CLI init.ts**: bun build 성공 여부

## 통합 테스트 계획

- **CLI → ingest → dashboard 플로우**: submit.mjs 실행 → /api/dashboard 호출 → 응답에 activities/projects/topSessions 존재 확인 (Playwright)
- **팀랭킹 MVP 합성 점수**: /api/team 응답의 MVP efficiencyScore가 `overallOneShot × cacheHitPct / (totalCost/sessionsCount)` 공식과 일치 확인
- **npx init 엔드투엔드**: ⚠️ 직접 실행 불가 — npx는 npm registry 의존. 수동: 로컬에서 `npx github:eugene-eee-hongkyu/ai-usage-tracker init` 실행 후 hook 등록 확인

## 사람만 가능

- Supabase SQL 에디터에서 `docs/migration.sql` 실행 (기존 테이블 DROP + user_snapshots CREATE)

## 중단/롤백 조건

없음. DB 재시작 OK, 혼자 사용 중.

## 맥락

- 결정: ccusage → codeburn 교체 (codeburn JSON 실제 확인 후 결정)
- DB: 2-table 구조 (users + user_snapshots with JSONB), period_type enum 없이 daily[] 날짜 필터로 기간 처리
- mirror columns: total_cost, sessions_count, calls_count, cache_hit_pct, overall_one_shot (팀랭킹 정렬용)
- activities 표시 시 oneShotRate === null인 카테고리 숨김
- 프로젝트별 one-shot rate 없음 (codeburn projects에 해당 필드 없음)
- daily 차트: 토큰 → 비용(cost)으로 교체
- 일별 툴팁: cache hit/세션당 비용 제거 (daily에 해당 데이터 없음)
- optimize findings: 대시보드 표시 제거, "codeburn optimize 터미널에서 실행" 링크로 대체
- planning rate: 제거 (변별력 없음), avg turns/session으로 대체

---

## Report

**실행 결과**
- codeburn migration 16단계 전체 구현 완료 (커밋 6846510, Vercel 배포)
- DB 2-table JSONB 구조로 전환 (users + user_snapshots), mirror 5컬럼 유지
- CLI init/submit/sync 전면 재작성 (ccusage → codeburn)
- 대시보드·팀랭킹 UI codeburn 스키마 완전 정합, UX 전면 재설계

**완료 기준 검증 결과** (사용자 직접 확인 — 2026-04-26)
1. `npx init` → codeburn 설치 확인 + hook 등록 정상 완료 ✅
2. CLI submit.mjs → 대시보드 activities/projects/topSessions 표시 ✅
3. 팀랭킹 MVP = one-shot × cache hit / 세션당 비용 합성 점수 ✅

**이슈**
- codeburn 실제 스키마가 예상과 달라 필드 리매핑 필요 (summary→overview, cacheHitPercent 0-100 스케일, activities.name→category 등)
- multi-period sync 중 기존 flat 포맷 잔류 데이터와 충돌 → fallback 로직으로 하위호환 유지
- npx 구버전 캐시: 루트 package.json bin이 ccusage 기반 구버전 가리키던 것 수정 필요

**결정**
- planning rate 제거 (변별력 없음), turns/session으로 대체
- activities oneShotRate 0-100 → 0-1 정규화, 모든 카테고리 표시
- optimize findings 대시보드 표시 제거, codeburn optimize 터미널 링크로 대체

**다음 액션**
- 팀원 초대 (이메일 목록 확정 → Vercel/서비스 초대)
- Windows SessionEnd hook 발화 검증 (Windows 테스터 필요)

**남은 리스크**
- Windows hook 발화 미검증 (테스터 필요)
