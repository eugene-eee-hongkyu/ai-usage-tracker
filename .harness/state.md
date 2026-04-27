# state.md — 현재 상태 요약

> `/worklog` 명령으로 갱신한다.
> 1페이지 이내. 스크롤 없이 읽을 수 있는 길이를 유지한다.
> 추측 금지. 사실만 기록한다.

---

## 마지막 실행: 2026-04-27 12:48
## 마지막 업데이트: 2026-04-27 12:48
## 현재 모드: bypassPermissions

### 현재 집중

- submit.mjs 파이프라인 안정화 (self-detach, API 키 폴백) + 탭 닫기 재테스트 대기 중.

### 이어서 할 것

1. 탭 닫기(VS Code 종료) 후 SessionEnd hook → submit.mjs 정상 완료 재테스트
2. 수동 실행 후 2분 뒤 대시보드 갱신 확인
3. Vercel 배포 확인 (팀 배지 렌더링)

### 막힌 것

- 없음

### 사람 판단 필요

- 팀원 초대 (Vercel/서비스 접근 권한, 초대 이메일 목록 결정)

### 백로그 요약
- 대기 중: 2개
- 최근 추가: 2026-04-26 — 팀원 초대

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
- [x] codeburn migration 16단계 구현 완료 (커밋 6846510, Vercel 배포)
- [x] Supabase 마이그레이션 SQL 실행 (DROP old tables + CREATE user_snapshots)
- [x] Vercel 환경변수 `ALLOWED_EMAIL_DOMAINS` 프로덕션 업데이트
- [x] 파비콘 적용 (docs/favicon/ 커밋, web/public/ 복사, layout.tsx metadata)
- [x] 대시보드 클라이언트 에러 수정 (fetchError 핸들링, neverSynced 조건, 신규→setup 리다이렉트)
- [x] Setup 체크 단계 2개로 정리 (hook 등록 + 첫 데이터 수신), API steps 버그 수정
- [x] Nav 로그아웃 두 줄 버그 수정 + 모바일 반응형 grid 적용
- [x] npx 구버전 캐시 원인 수정 (루트 package.json bin → cli/src/index.mjs, v0.2.0)
- [x] codeburn 실제 스키마 완전 정합 (overview/category/turns/sessionId 등 필드 매핑)
- [x] multi-period sync 구현 (codeburn 4회 병렬 호출, today/week/month/all 중첩 저장)
- [x] 대시보드 UI codeburn 스타일 전면 재설계 (neutral-950, font-mono, 컬러 border)
- [x] By Model / MCP Servers / Core Tools / Shell Commands 섹션 추가
- [x] 대시보드 섹션 비율 기반 가로 바 교체 (opacity dot → proportional bar, 6개 섹션)
- [x] Efficiency 4개 지표 tip 모달 + indigo pill 버튼 (cache hit/one-shot/cost/calls)
- [x] 팀랭킹 period 필터 추가 (오늘/이번주/이번달/전체)
- [x] By Activity 전체 항목 표시 + cost/turns/1-shot 컬럼 재설계
- [x] codeburn migration run 완료 기준 3개 사용자 직접 검증 완료
- [x] 대시보드 UX: Period 버튼 고정 너비, Daily Activity 세로 목록, Tabs/Overview 너비 정렬
- [x] Daily Activity 목록 스크롤 제거 (전체 표시)
- [x] Overview Bar 마지막 수신 시각 표시 (MM-DD HH:mm)
- [x] Efficiency 버튼 컬럼 정렬 (w-28 / w-20 고정)
- [x] Efficiency 종합 등급 배지 (탁월/양호/보통/부족/경고)
- [x] Efficiency 지표별 개별 등급 배지 + 모달 등급표 한글화
- [x] "개선 필요" → "부족" 전면 교체 + 종합 배지 hover 툴팁 + 액션 버튼 분리
- [x] 대시보드 카드 순서 재배치 (Daily Activity+Efficiency 상단 고정)
- [x] 개별 메트릭 배지 hover 시 등급표+설명 표시 (전 등급)
- [x] Cache hit 표준 공식 적용 (cacheWrite 분모 포함, 95.x% 정확 표시)
- [x] 카드 순서 2차 재배치 (By Activity↔Top Sessions 교환, Core Tools+Shell Commands 묶음, MCP 하단)
- [x] 카드 아이템 수 헤더 표시(7개↑) + 하단 페이드 그라디언트
- [x] Efficiency 종합 배지 양호 시 hover 없음, Calls 최적화 팁 조건부 렌더링
- [x] SessionEnd hook 경로 안정화 (~/.primus-usage-tracker/) + shell:true + 4-period 통일
- [x] CLI init 한글 깨짐 수정 (영어 UI + charset=utf-8)
- [x] CLI init 프로세스 미종료 수정 (process.exit(0))
- [x] submit.mjs 동시 실행 방지 lock 파일 추가 (TTL 90s)
- [x] sync.mjs multi-period 버그 재발 수정 (hardcoded --period all → 4-period 병렬)
- [x] bun build 자동화 (build:index + build:sync + build:init 통합 스크립트)
- [x] 팀 랭킹 lastSyncedAt 경고 배지 (2일↑ 노랑, 5일↑ 빨강, 미수신 빨강)
- [x] init 실행 시 일간 자동 동기화 등록 (Mac launchd / Windows Task Scheduler XML)
- [x] Windows Task Scheduler XML `StartWhenAvailable` 추가
- [x] submit.mjs API 키 폴백 파일(`~/.primus-usage-key`) 항상 저장하도록 수정
- [x] SessionEnd hook 발화 확인 (debug.log)
- [x] submit.mjs self-detach 패턴 적용 (VS Code 종료 시 SIGKILL 대응, 백그라운드 자식 프로세스 분리)
- [ ] 탭 닫기(VS Code 종료) 후 SessionEnd hook → submit.mjs 정상 완료 재테스트
- [ ] Vercel 배포 확인 (팀 배지 렌더링)
- [ ] 팀원 초대 및 팀랭킹 화면 검증
- [ ] Windows SessionEnd hook 발화 검증 (Hold 플래그)