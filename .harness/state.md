# state.md — 현재 상태 요약

> `/worklog` 명령으로 갱신한다.
> 1페이지 이내. 스크롤 없이 읽을 수 있는 길이를 유지한다.
> 추측 금지. 사실만 기록한다.

---

## 마지막 실행: 2026-04-26 16:58
## 마지막 업데이트: 2026-04-26 16:58
## 현재 모드: bypassPermissions

### 현재 집중

- codeburn migration 진행 중 (run: docs/runs/2026-04-26-codeburn-migration_run.md)
- 현재 run: docs/runs/2026-04-26-codeburn-migration_run.md — codeburn migration

### 이어서 할 것

1. codeburn migration 구현 시작 — 1단계: DB 스키마 교체 (`lib/db/schema.ts`)
2. 2단계: Supabase 마이그레이션 SQL 작성 → 사용자가 실행
3. 이후 API → UI → CLI 순서로 16단계 진행

### 막힌 것

- 없음

### 사람 판단 필요

- Supabase SQL 에디터에서 마이그레이션 SQL 실행 (기존 테이블 DROP + user_snapshots CREATE)
- Vercel 환경변수 `ALLOWED_EMAIL_DOMAINS` 업데이트 필요 (`iskra.world,primuslabs.world,z21labs.xyz`)

### 진행 상황

- [x] GitHub 저장소(`ai-usage-tracker`) 생성 및 `docs/` 첫 커밋 푸시
- [x] `/harness-init` 실행 — CLAUDE.md, .claude/settings.json, profiles, CONTEXT.md, .harness/ 산하 파일, .gitignore 생성
- [x] `docs/03_A-2`, `docs/05_B-1` 문서 기반 CONTEXT.md 초안 작성
- [x] B-1 §1 체크리스트 완료 (Node / Claude Code / Docker / GitHub OAuth / repo private / .env.local)
- [x] bypassPermissions 모드 전환
- [x] B-1 §5 빌드 순서 20단계 — 전체 코드 구현 완료 (53파일 커밋·푸시)
- [x] §10 시나리오 1: GitHub 로그인 → 대시보드 렌더링 확인
- [x] CLI npx 실행 오류 수정 (bin 엔트리, .mjs 전환, bun 번들)
- [x] UX 개선: 미설치 대시보드 CTA, setup 2단 카드, 다중 도메인 auth
- [x] 대시보드 UI 버그 수정 6배치 (차트 정렬, 타임존, 토큰 집계, 출력밀도, 활성일수, 지표 교체)
- [x] 절감 제안 룰 버그 수정 (mcp_unused 삭제, low_utilization 가드)
- [x] B-2 Vercel + Supabase 배포 완료 (ai-usage-tracker-web-psi.vercel.app)
- [x] GitHub OAuth App + NEXTAUTH_URL + CLI SERVER_URL 프로덕션 도메인으로 업데이트
- [x] 프로덕션 GitHub 로그인 성공 + 대시보드 데이터 표시 확인
- [x] CLI init 프로덕션 연결 성공 (API 키 발급 + hook 등록 + 백필 완료)
- [x] §10 시나리오 2: CLI init → 백그라운드 백필 → 프로덕션 대시보드 데이터 PASS
- [x] 탭 전환 로딩 UX 개선 (dimming + neverSynced polling)
- [x] Google OAuth 추가 (GitHub 없는 팀원도 로그인 가능)
- [x] Setup 페이지 UX 수정 (즉시 fetch, 자동 리다이렉트 제거 → 버튼으로 이동)
- [x] primuslabs 브랜딩 제거 (비임팩트 영역), README.md 작성
- [x] Setup 페이지 Node.js 설치 안내 추가 (OS 감지, 다운로드 링크, 단계별 설명)
- [x] 출력밀도·컨텍스트 압박률 제거, 세션당 평균 비용 카드 추가 (Vercel 배포 완료)
- [x] Cache hit·세션당 평균 비용 카드에 상세 팝업 모달 추가 (올리는법/줄이는법 버튼)
- [x] 최고 효율 지표 교체: oneShotRate → cache hit% × 100 / 세션당 비용 (합성 점수)
- [x] 셋업 상태 API 버그 수정: steps 배열→객체 불일치, sessionsCount/lastSyncedAt 누락
- [x] 팀랭킹 탭 전환 dimming 추가 (대시보드와 동일 패턴)
- [x] 5h utilization 기능 — "안 한다"로 확정 (백로그 미등록)
- [x] `ALLOWED_EMAIL_DOMAIN` 허용 도메인 확정: `iskra.world,primuslabs.world,z21labs.xyz`
- [x] ingest `onConflictDoUpdate` 수정 — 오늘 데이터 0 버그 해결
- [x] CLI sync 명령 오류 수정 (`program.parse(process.argv)`)
- [x] 차트 툴팁에 cache hit%, 세션당 비용 추가 (Vercel 배포 완료)
- [x] codeburn migration kickoff (docs/runs/2026-04-26-codeburn-migration_run.md)
- [ ] codeburn migration 구현 (16단계 — run 파일 참조)
- [ ] Supabase 마이그레이션 SQL 실행 (사람)
- [ ] Vercel 환경변수 `ALLOWED_EMAIL_DOMAINS` 프로덕션 업데이트
- [ ] 팀원 초대 및 팀랭킹 화면 검증
- [ ] Windows SessionEnd hook 발화 검증 (Hold 플래그)
