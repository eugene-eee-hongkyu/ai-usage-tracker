# state.md — 현재 상태 요약

> `/worklog` 명령으로 갱신한다.
> 1페이지 이내. 스크롤 없이 읽을 수 있는 길이를 유지한다.
> 추측 금지. 사실만 기록한다.

---

## 마지막 실행: 2026-04-30 15:59
## 마지막 업데이트: 2026-04-30 15:59
## 현재 모드: bypassPermissions

### 현재 집중

- 운영 단계 — 팀/개인 화면 기능 안정화 + 한방 설치 스크립트 배포 완료, 첫 스냅샷 promote 검증 대기

### 이어서 할 것

1. 5월 5일(다음 주 월요일) 첫 weekly 스냅샷 promote 검증 → `[지난주 ▼]` 드롭다운 등장
2. 5월 1일 첫 monthly 스냅샷 promote 검증 → `[지난달 ▼]` 드롭다운 등장
3. 팀원 대상 install.sh / install.ps1 한방 설치 안내 (Mac/Win 모두 가능)

### 막힌 것

- 없음

### 사람 판단 필요

- 없음

### 백로그 요약

- 대기 중: 2개
- 최근 추가: 2026-04-29 — 다음 주 월요일 첫 weekly 스냅샷 promote 검증

### 진행 상황

- [x] B-1 / B-2 — 빌드, 배포, codeburn 마이그레이션, 대시보드/팀 UI 전체 (이전 세션 누적)
- [x] 데이터 수집 파이프라인 — launchd 4회/일, repair 즉시 수집, ccusage 통합, repair fallback
- [x] 주별/월별/일별 스냅샷 누적 — period_snapshots 테이블, ingest promote, retention (5주/12달/7일)
- [x] 대시보드 — Daily Activity(토큰)+Daily Cost, Efficiency, By Model, By Project/Activity, Top Sessions+MCP, Core Tools+Shell, period localStorage
- [x] 팀 페이지 — By Member+Team Total, Activity+Cost, Efficiency+Team Activities, Core Tools+Shell, By Model, Last Sync+Top Sessions(admin), 총토큰 합계, period localStorage
- [x] 보안 — Supabase RLS 활성 (3 테이블)
- [x] Supabase 마이그레이션 — 0001 (period_snapshots), 0002 (current_day_*) 적용 완료
- [x] 한방 설치 스크립트 — install.sh (nvm), install.ps1 (winget), Setup 페이지 OS-aware one-liner
- [x] ADMIN 배지 — nav 팀원 탭, team Last Sync/Top Sessions
- [x] 2026-04-30 세션 워크로그 정리 — worklog.md / state.md / backlog.md 갱신, git commit/push, snooze_attention 실행
- [ ] 5월 5일 첫 weekly 스냅샷 promote 검증
- [ ] 5월 1일 첫 monthly 스냅샷 promote 검증