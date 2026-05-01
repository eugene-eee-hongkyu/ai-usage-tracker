# backlog.md — 나중에 할 것들

---

## 대기 중

## 2026-05-01: 5/2 첫 daily 스냅샷 promote 검증

- **백로그 이유**: 시점 도래 전 검증 불가
- **할 것**: 5/2 00:00+ 첫 sync 후 `period_snapshots`에 `daily, 2026-05-01` 행이 INSERT되는지 확인 + 대시보드 `[이전 ▼]` 드롭다운 등장 확인
- **필요한 것**: 사용자 머신 launchd 정상 동작, payload-based boundary 코드 배포 후 첫 sync 도래
- **이전 검토**: 5/1 00:00 sync는 timezone NULL 버그로 promote 누락. fix 적용 후 다음 sync부터 자가 치유 예상

## 2026-04-29: 5/4 (월) 첫 weekly 스냅샷 promote 검증

- **백로그 이유**: 다음 주 월요일까지 대기 필요 (시점 도래 전 검증 불가)
- **할 것**: 5/4 00:00+ 첫 sync 후 `period_snapshots`에 `weekly, 2026-04-27` 행이 INSERT되는지 확인 + 대시보드 `[지난주 ▼]` 드롭다운 등장 확인
- **필요한 것**: 월요일 시점 도래
- **이전 검토**: 이번 세션 시점에서는 아직 첫 weekly promote 시점 미도래. payload-based boundary fix와 무관하게 자연 promote 예정

## 2026-05-01: 6/1 첫 monthly 스냅샷 promote 검증

- **백로그 이유**: 6월 1일까지 대기 필요 (5/1 promote는 timezone 버그로 영영 못 만들었음)
- **할 것**: 6/1 00:00+ 첫 sync 후 `period_snapshots`에 `monthly, 2026-05-01` 행이 INSERT되는지 확인 + 대시보드 `[지난달 ▼]` 드롭다운 등장 확인
- **필요한 것**: 5월 한 달 동안 정상 sync 누적, 6/1 시점 도래
- **이전 검토**: 5/1 sync에서 April monthly promote 실패. 새 코드는 6/1 sync 시점에 prev=5/1, new=6/1 boundary 감지하여 정상 promote 예상

<!-- 새 항목은 여기 위에 추가 -->

---

## 완료 / 취소

~~[1] 2026-04-29: 5월 1일 첫 monthly 스냅샷 promote 검증 — 영영 못 만듦, timezone NULL 버그로 누락. 코드 fix는 6/1 promote에서 검증 예정~~
