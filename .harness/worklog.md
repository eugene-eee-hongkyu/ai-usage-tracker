# worklog.md — 작업 기록

> 최신 세션이 위에 오도록 역순으로 작성한다.

---

## Session 2026-04-26 19:43 — codeburn migration 완료 검증 + 대시보드 UX 개선

### 작업 요약
- **codeburn migration run 완료 기준 3개 사용자 직접 검증 완료**:
  1. `npx github:eugene-eee-hongkyu/ai-usage-tracker init` → codeburn 설치 확인 + hook 등록 정상 완료
  2. CLI submit.mjs → codeburn JSON POST → 대시보드 활동별 one-shot rate, 프로젝트별 비용, Top sessions 정상 표시
  3. 팀랭킹 MVP 점수 = one-shot × cache hit / 세션당 비용 합성 점수 계산 확인
- **대시보드 UX 개선**:
  - Period 버튼 크기 통일: `px-3` 가변 → `w-16 text-center` 고정 (dashboard + team 양쪽)
  - Daily Activity 세로 목록 전환: Recharts BarChart 제거 → `날짜 | 비례 bar | cost | sessions` 행 목록 (max-h-52 스크롤, 마우스오버 없음)
  - Period Tabs / Overview Bar 너비 정렬: `max-w-6xl mx-auto` 래퍼 적용 (아래 그리드와 동일 너비)

### 다음 액션
1. 팀원 초대 (이메일 목록 확정 → Vercel/서비스 초대)
2. Windows SessionEnd hook 발화 검증 (Windows 테스터 필요)

---

## Session 2026-04-26 19:35 — 대시보드 UX 개선 (바 그래프·tip 모달·팀랭킹 period·By Activity 전체)

### 작업 요약
- **비율 기반 가로 바로 전환**: By Project, Top Sessions, By Model, MCP Servers, Core Tools, Shell Commands 6개 섹션 — opacity dot(`w-1.5 h-3.5`) → `w-16 h-1.5` 비율 fill bar
- **Efficiency tip 모달 전체 추가**:
  - Cache hit `[늘리는 법]` → `CacheHitModal` (기존 연결)
  - One-shot rate `[늘리는 법]` → `OneShotRateModal` 신규 작성
  - Cost/session `[줄이는 법]` → `CostPerSessionModal` 개선
  - Calls/session `[설명]` → `CallsPerSessionModal` 신규 작성 (양면성 솔직 명시)
  - 버튼 스타일: 회색 언더라인 → `TipBtn` indigo pill (`bg-indigo-600 text-white`)
- **팀랭킹 period 필터 추가**: 오늘/이번주/이번달/전체 탭 — team page + team API
  - API: `?period=` 파라미터, `all`은 mirror 컬럼 사용, 나머지는 rawJson에서 기간별 추출
  - 해당 기간 세션 0인 멤버 랭킹 제외
- **By Activity 전체 항목 표시**: `oneShotRate != null` 필터 제거 → 10개 모두 표시
  - 컬럼 재설계: `[cost bar] | activity | cost | turns | 1-shot%`
  - `sessions` → `turns` 필드명 정정

### 다음 액션
1. multi-period re-sync 실행 → period별 데이터 표시 검증 (run 완료 기준 #2)
2. `npx github:eugene-eee-hongkyu/ai-usage-tracker init` 실행 → codeburn 설치 + hook 등록 확인 (run 완료 기준 #1)
3. 팀원 초대 및 팀랭킹 화면 검증

---

## Session 2026-04-26 19:06 — 대시보드 codeburn 스키마 완전 정합 + 기간별 데이터 + UI 전면 재설계

### 작업 요약
- **npx sync 충돌 수정**: `program.parse()` → `program.parse(process.argv)`, CLI 번들 재빌드
- **toFixed crash 수정**: `dashboard/route.ts`, `members/[userId]/route.ts`에서 `projects`/`topSessions` 필드 `?? 0` 정규화
- **codeburn 실제 스키마 정합** (Supabase 직접 조회로 확인):
  - `summary` → `overview`, `totalCost` → `cost`, `cacheHitPct` → `cacheHitPercent` (0-100 스케일)
  - `activities[].name` → `category`, `sessions` → `turns`, `oneShotRate` 0-100 → 0-1 정규화
  - `projects[]` `avgCost` 없음 → `cost/sessions` 직접 계산
  - `topSessions[]` `id` → `sessionId`, `turns` → `calls`
  - Supabase SQL로 기존 스냅샷 컬럼 (`total_cost`, `sessions_count`, `cache_hit_pct`, `overall_one_shot`) 재계산 업데이트
- **multi-period sync 구현**: `sync.ts`에서 codeburn 4번 병렬 호출 (`today/week/month/all`)
  - rawJson 구조: `{ today: {...}, week: {...}, month: {...}, all: {...} }`
  - 기존 flat 포맷 하위호환 유지 (`getPeriodData` fallback)
  - codeburn `--period week` vs `--period all` 실제로 다른 데이터 리턴 확인 (week $769 vs all $1395)
- **dashboard API 전면 재작성**: `overview` 기반, `projectPath` 조회맵, `oneShotRate` period별 계산
- **대시보드 UI codeburn 스타일 전면 재설계**:
  - `bg-neutral-950` 다크 테마, `font-mono`, 섹션별 색상 좌측 border
  - 레이아웃: Overview bar → Daily+Project 2열 → Top Sessions 전체폭 → Efficiency+Activity 2열
  - 경로 포매팅: `/Users/xxx/` prefix 제거 표시
- **4개 섹션 추가**: By Model (cache% 토큰 계산), MCP Servers, Core Tools, Shell Commands
- **Efficiency 섹션 상단 정렬** 수정 (테이블 레이아웃)

### 실패한 시도
- multi-period sync 후 "아직 같다" → DB 확인 결과 이전 single-period 데이터 잔류, re-sync 필요 상태

### 다음 액션
1. `npm cache clean --force` + `npx sync` 재실행 → period별 데이터 DB 저장 확인 (오늘/이번주/이번달/전체 각기 다른 값)
2. Vercel 재배포 후 대시보드 전체 UI 확인
3. 팀랭킹 efficiencyScore 검증 (run 완료 기준 #3)

---

## Session 2026-04-26 18:08 — 파비콘 적용, 대시보드 버그 수정, npx 구버전 캐시 문제 해결

### 작업 요약
- **파비콘 적용**: `docs/favicon/` 커밋, `web/public/` 복사, `layout.tsx` metadata icons 설정
- **대시보드 클라이언트 에러 수정**: API 500 → `data.user` undefined crash
  - `fetchError` state 추가, 에러 시 "다시 시도" 버튼 표시
  - `neverSynced` 조건: `!lastSyncedAt || !summary` — summary null일 때 crash 방지
  - 신규 사용자(`!lastSyncedAt`) → `/setup` 자동 리다이렉트
  - 기존 사용자 snapshot 없음(`!summary`) → sync 명령어 + 복사 버튼 화면
- **Setup 페이지 체크 단계 2개로 정리**: Node 18+/keytar 제거, hook 등록 + 첫 데이터 수신 유지. API steps 객체→배열 변환 버그 수정
- **Nav 버그 수정**: 로그아웃 드롭다운 두 줄 → `whitespace-nowrap` 추가
- **모바일 반응형**: 효율지표 `grid-cols-2 sm:grid-cols-4`, 팀랭킹 `grid-cols-1 sm:grid-cols-3`, 멤버 프로필 `grid-cols-2 sm:grid-cols-4`, Nav 브랜드명 모바일 숨김
- **"동기화 필요" 화면 개선**: Nav → 미니멀 헤더(로그아웃만), 복사 버튼 추가
- **npx 구버전 캐시 원인 분석 및 수정**:
  - 루트 `package.json` bin이 `./cli/bin/cli.mjs` (ccusage 기반 구버전) 가리키던 것 발견
  - `./cli/src/index.mjs` (codeburn 기반 신버전)로 수정
  - 루트 버전 0.1.0 → 0.2.0 bump (캐시 무효화)
  - Supabase 0값 스냅샷 삭제 (구버전 sync가 summary 없는 포맷으로 저장했던 것)

### 실패한 시도
- `npx --force github:... sync` 재실행 → 여전히 구버전 실행 (루트 package.json bin이 원인이었으나 그 이전에 시도)
- `npm cache clean --force` 안내했으나 실제 원인은 루트 bin 항목이었음

### 다음 액션
1. `npm cache clean --force` 후 `npx github:eugene-eee-hongkyu/ai-usage-tracker sync` 재실행 → "codeburn 데이터 수집 중..." 메시지 확인 후 대시보드 데이터 표시 검증 (run 완료 기준 #2)
2. `npx github:eugene-eee-hongkyu/ai-usage-tracker init` 실행 → codeburn 설치 확인 + hook 등록 정상 완료 확인 (run 완료 기준 #1)
3. 팀랭킹 `/api/team` efficiencyScore 필드 확인 (run 완료 기준 #3)

---

## Session 2026-04-26 17:17 — codeburn migration 16단계 전체 구현 완료

### 작업 요약
- **DB 스키마 교체**: `sessions/dailyAgg/suggestionFeedback` 제거, `userSnapshots` (JSONB + mirror 5cols) 추가
- **Supabase 마이그레이션 SQL 실행** (`docs/migration.sql`) — 사용자가 직접 실행 완료
- **ingest API**: codeburn JSON 통째로 저장, `overallOneShot` 활동 가중 평균 계산
- **dashboard API**: `rawJson.daily[]` 날짜 필터, activities/projects/topSessions 반환
- **team API**: mirror 컬럼으로 3개 순위 (정확도/효율/활동), `efficiencyScore = overallOneShot × cacheHitPct / costPerSession`
- **setup/status API**: `user_snapshots` 존재 여부로 교체
- **members API**: cost 기반 heatmap 레벨, 프로젝트 cost 정렬
- **rules 정리**: `generateSuggestions` 제거, `computeEfficiencyScore` 시그니처 교체
- **대시보드 UI**: 비용 차트, 효율 4지표, 활동별 one-shot, 프로젝트, top sessions
- **대시보드 detail**: 프로젝트 목록 + `codeburn optimize` 터미널 안내 카드
- **팀랭킹 UI**: 3카드 (최고 정확도/최고 효율/최다 활동), MVP 새 공식
- **멤버 프로필**: cost 기반 heatmap (0/$0.5/$2/$5 경계), 프로젝트 cost 정렬
- **CLI init**: `codeburn` 설치 확인 + npm install -g 자동 설치 옵션 추가
- **CLI submit/sync**: `ccusage daily --json` → `codeburn report --format json --provider claude --period all` 교체
- **CLI 번들 재빌드**: `bun build` index/init/sync 3개 번들
- **Vercel push**: `git push` 자동 배포 완료
- **Vercel `ALLOWED_EMAIL_DOMAINS` 업데이트**: 사용자 완료
- **feedback/route.ts**: `suggestionFeedback` 참조 제거 (no-op 응답으로 교체)
- `tsc --noEmit` 타입 체크 통과

### 다음 액션
1. `npx github:eugene-eee-hongkyu/ai-usage-tracker sync` 실행 → 대시보드 데이터 확인 (run 완료 기준 검증)
2. 팀원 초대 및 팀랭킹 화면 검증
3. Windows SessionEnd hook 발화 검증 (Hold)

---

## Session 2026-04-26 16:58 — codeburn migration kickoff + 차트 툴팁 개선

### 작업 요약
- codeburn 실제 JSON 출력 분석 (`overview`, `daily`, `activities`, `projects`, `topSessions`, `models`, `tools`, `mcpServers`)
- 제안 검토: ccusage → codeburn 교체 타당성 확인, 3가지 제약 발견 (optimize JSON 미지원 / daily 토큰 없음 / planning rate 변별력 없음)
- DB 재설계 확정: 2-table JSONB (users + user_snapshots), mirror columns 5개
- 합성 MVP 점수 업데이트 결정: `one-shot × cache hit / 세션당 비용`
- 대시보드 차트 툴팁에 cache hit%, 세션당 비용 추가 (`dashboard/page.tsx`) — Vercel 배포됨
- codeburn migration run kickoff (`docs/runs/2026-04-26-codeburn-migration_run.md`)
- bypassPermissions 모드 전환

### 다음 액션
1. codeburn migration 구현 시작 (16단계, run 파일 참조)

---

## Session 2026-04-26 15:59 — worklog 정리 및 상태 파일 커밋

### 작업 요약
- worklog.md 상단 잘못된 자동 생성 항목을 올바른 세션 내용으로 교체
- state.md 업데이트 후 관련 harness 파일들 git add → commit → push

### 다음 액션
- Vercel 환경변수 `ALLOWED_EMAIL_DOMAINS` 프로덕션 업데이트 (수동)
- 팀원에게 프로덕션 URL 공유 및 초대
- Windows SessionEnd hook 발화 검증

---

## Session 2026-04-26 15:49 — 오늘 데이터 0 버그 수정 (ingest + CLI sync)

### 작업 요약
- **버그 원인 분석**: `ccusage daily`로 오늘(04-26) 데이터가 있음에도 대시보드 "오늘" 탭이 0을 표시
  - 원인: SessionEnd hook 첫 발화 시 JSONL race condition → 0토큰으로 삽입 → `onConflictDoNothing`이 이후 정확한 데이터 업데이트 차단
- **`api/ingest/route.ts` 수정**: `.onConflictDoNothing()` → `.onConflictDoUpdate(...)` — hook 발화마다 최신값으로 갱신
- **CLI `sync` 오류 수정**: `program.parse()` → `program.parse(process.argv)` — 번들 환경에서 commander가 process.argv를 자동 감지 실패
- CLI 번들 재빌드 후 커밋·푸시, 사용자 확인: 수정 후 오늘 데이터 정상 표시

### 다음 액션
1. Vercel 환경변수 `ALLOWED_EMAIL_DOMAINS` 프로덕션 업데이트 (수동)
2. 팀원에게 프로덕션 URL 공유 및 초대

---

## Session 2026-04-26 02:07 — 팀랭킹 탭 전환 dimming + 5h utilization 보류

### 작업 요약
- 팀랭킹 탭 전환 dimming 구현 (대시보드와 동일 패턴)
- **5h utilization 구현 안 함** (사용자 명시 결정): ccusage JSONL에 플랜 정보 없음, `activeHours` 하드코딩 0

---

## Session 2026-04-25 21:10 — 대시보드 UI 버그 수정 6배치 + B-2 Vercel+Supabase 배포

### 작업 요약
- 차트 정렬/타임존/토큰 집계/출력밀도/활성일수/지표 교체 버그 수정
- `mcp_unused` 룰 삭제, `low_utilization` 가드 추가
- Vercel + Supabase 배포 완료 (ai-usage-tracker-web-psi.vercel.app)
- GitHub OAuth App + NEXTAUTH_URL + CLI SERVER_URL 프로덕션 도메인 업데이트

---

## Session 2026-04-25 19:15 — CLI npx 실행 오류 수정 및 UX 개선

### 작업 요약
- `dashboard/page.tsx` CTA, `setup/page.tsx` 2단 카드, `auth.ts` 다중 도메인 지원
- CLI: root package.json bin 엔트리, `.mjs` 전환, bun 번들 (keytar 외부)

---

## Session 2026-04-25 18:17 — B-1 MVP 전체 빌드 완료 및 깃허브 푸시

### 작업 요약
- B-1 §5 빌드 순서 20단계 완료 (53개 파일 커밋·푸시)
