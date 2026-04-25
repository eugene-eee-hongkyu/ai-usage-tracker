# state.md — 현재 상태 요약

> `/worklog` 명령으로 갱신한다.
> 1페이지 이내. 스크롤 없이 읽을 수 있는 길이를 유지한다.
> 추측 금지. 사실만 기록한다.

---

## 마지막 실행: 2026-04-26 01:29
## 마지막 업데이트: 2026-04-26 01:29
## 현재 모드: bypassPermissions

### 현재 집중

- B-2 프로덕션 운영 중 — 대시보드 효율 지표 개선 및 팀원 초대 단계

### 이어서 할 것

1. 컨텍스트 압박률 대안 결정: 원샷 성공률 교체 또는 "세션당 캐시 쓰기(M)" 표시 중 선택
2. 팀원에게 `https://ai-usage-tracker-web-psi.vercel.app` 공유 및 초대
3. B-1 §3 Hold 플래그: Windows 환경 친구 1명 확보 — SessionEnd hook 발화 검증

### 막힌 것

- 컨텍스트 압박률 지표: `cacheRead/sessions/200K` 공식이 턴마다 누적값이라 수백% 나오는 근본 오류. "세션 종료 시 컨텍스트 크기" 데이터가 DB에 없어 정확한 계산 불가 — 대안 선택 필요

### 사람 판단 필요

- 컨텍스트 압박률 대안 선택: 원샷 성공률 교체 vs 세션당 캐시 쓰기(M) 표시 중 방향 결정 필요
- B-1 §3 Hold 플래그: Windows 환경 친구 1명 확보 필요 (SessionEnd hook 발화 검증용)

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
- [x] 출력밀도 카드 제거, 세션당 평균 비용·컨텍스트 압박률 카드 추가 구현 (Vercel 배포 완료)
- [ ] 컨텍스트 압박률 지표 대안 구현 (원샷 성공률 또는 세션당 캐시 쓰기)
- [ ] 팀원 초대 및 팀랭킹 화면 검증
- [ ] Windows SessionEnd hook 발화 검증 (Hold 플래그)