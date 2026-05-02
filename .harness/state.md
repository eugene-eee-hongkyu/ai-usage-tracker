# state.md — 현재 상태 요약

> `/worklog` 명령으로 갱신한다.
> 1페이지 이내. 스크롤 없이 읽을 수 있는 길이를 유지한다.
> 추측 금지. 사실만 기록한다.

---

## 마지막 실행: 2026-05-02 09:41
## 마지막 업데이트: 2026-05-02 09:41
## 현재 모드: bypassPermissions

### 현재 집중

- 운영 안정화 — codeburn timeout/allSettled/today.period 파싱 fix 배포. 본인 + 팀원 repair로 새 코드 적용 + 다음 launchd sync 검증

### 이어서 할 것

1. 본인 머신 repair → 새 submit.mjs(timeout 600s + allSettled) 적용 + 다음 launchd sync에서 timeout 미발생 확인
2. 팀원 4명도 repair 안내 → ccusage 5/1 entry 가져와 자가 치유 promote
3. 5/4(월) 첫 weekly promote 검증

### 막힌 것

- 없음

### 사람 판단 필요

- 없음

### 백로그 요약

- 대기 중: 4개
- 최근 추가: 2026-05-02 — 팀원 4명 자가 치유 promote 검증

### 진행 상황

- [x] B-1 / B-2 — 빌드, 배포, codeburn 마이그레이션, 대시보드/팀 UI 전체 (이전 누적)
- [x] 데이터 수집 파이프라인 — launchd 4회/일, repair 즉시 수집, ccusage 통합, repair fallback
- [x] 스냅샷 누적 — period_snapshots 테이블, ingest promote, retention (5주/12달/7일)
- [x] 대시보드 / 팀 페이지 전체 카드 구성 + period localStorage
- [x] 보안 — Supabase RLS 활성
- [x] Supabase 마이그레이션 0001 / 0002 적용 완료
- [x] 한방 설치 스크립트 — install.sh / install.ps1
- [x] ADMIN 배지 — nav 팀원 / team Last Sync / Top Sessions
- [x] boundary timezone 의존성 제거 — `deriveUserTodayFromBody`
- [x] codeburn UTC 버그 우회 — payload max date + CLI TZ 주입
- [x] submit.log via appendFileSync — 모든 호출 경로 로그
- [x] dashboard 오늘 override — codeburn UTC daily → ccusage local-today
- [x] period button 모든 offset 리셋 + 드롭다운 라벨 통일
- [x] 30일 period 추가 (codeburn parity)
- [x] 팀 stale 멤버 필터 — 4월/5월 mixed 방지
- [x] 본인 머신 자가 치유 검증 — daily/monthly promote 자동 발생
- [x] codeburn/ccusage timeout 600s 확장 + Promise.allSettled (`d29ed62`, `a95dae2`)
- [x] today.period 라벨 정규식 파싱 — daily 빈 케이스 boundary 감지 (`fb5815e`)
- [ ] 본인 repair → 새 submit.mjs + 다음 sync에서 timeout 미발생 검증
- [ ] 팀원 4명 자가 치유 promote 검증
- [ ] 5/4 첫 weekly 스냅샷 promote 검증
- [ ] 6/1 첫 monthly 스냅샷 promote 검증
- [ ] codeburn npm 새 버전 배포 시 `--timezone` flag 활용 (현재는 TZ env로 우회)
