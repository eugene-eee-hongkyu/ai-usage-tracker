# worklog.md — 작업 기록

> 최신 세션이 위에 오도록 역순으로 작성한다.

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
