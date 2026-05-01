# state.md — 현재 상태 요약

> `/worklog` 명령으로 갱신한다.
> 1페이지 이내. 스크롤 없이 읽을 수 있는 길이를 유지한다.
> 추측 금지. 사실만 기록한다.

---

## 마지막 실행: 2026-05-01 10:37
## 마지막 업데이트: 2026-05-01 10:37
## 현재 모드: bypassPermissions

### 현재 집중

- 운영 안정화 — codeburn UTC 버그 우회 + 30일 period + 팀 stale 필터 배포 완료. 다른 4명 팀원의 다음 sync로 자가 치유 재검증 대기

### 이어서 할 것

1. 다른 팀원들의 12:00/18:00 SGT launchd sync 후 period_snapshots에 daily(4/30) / monthly(4/1) 자동 promote 확인
2. 5/2 00:00+ 첫 sync 후 본인 머신의 5/1 daily promote 확인
3. 5/4(월) 첫 sync 후 weekly 스냅샷 promote 확인

### 막힌 것

- 없음

### 사람 판단 필요

- 없음

### 백로그 요약

- 대기 중: 3개
- 최근 추가: 2026-05-01 — 6/1 첫 monthly 스냅샷 promote 검증

### 진행 상황

- [x] B-1 / B-2 — 빌드, 배포, codeburn 마이그레이션, 대시보드/팀 UI 전체 (이전 누적)
- [x] 데이터 수집 파이프라인 — launchd 4회/일, repair 즉시 수집, ccusage 통합, repair fallback
- [x] 스냅샷 누적 — period_snapshots 테이블, ingest promote, retention (5주/12달/7일)
- [x] 대시보드 / 팀 페이지 전체 카드 구성 + period localStorage
- [x] 보안 — Supabase RLS 활성
- [x] Supabase 마이그레이션 0001 / 0002 적용 완료
- [x] 한방 설치 스크립트 — install.sh / install.ps1
- [x] ADMIN 배지 — nav 팀원 / team Last Sync / Top Sessions
- [x] boundary timezone 의존성 제거 — `deriveUserTodayFromBody` (`a4a82bf`)
- [x] codeburn UTC 버그 우회 — payload max date (`82698a9`) + CLI TZ 주입 (`1eb917f`, `c2b655e`)
- [x] submit.log via appendFileSync — 모든 호출 경로 로그 (`cc17d9b`)
- [x] dashboard 오늘 override — codeburn UTC daily → ccusage local-today (`e58a475`)
- [x] period button 모든 offset 리셋 + 드롭다운 라벨 통일 (`8e20ef9`)
- [x] 30일 period 추가 (codeburn parity, `4fc5db8`)
- [x] 팀 stale 멤버 필터 — 4월/5월 mixed 방지 (`f81a8dd`)
- [x] 본인 머신 자가 치유 검증 — daily/monthly promote 자동 발생 + DB 클린업
- [ ] 다른 팀원 4명의 다음 sync로 자가 치유 재검증
- [ ] 5/2 첫 daily 스냅샷 promote 검증
- [ ] 5/4 첫 weekly 스냅샷 promote 검증
- [ ] 6/1 첫 monthly 스냅샷 promote 검증
- [ ] codeburn npm 새 버전 배포 시 `--timezone` flag 활용 가능 (현재는 TZ env로 우회 중)
