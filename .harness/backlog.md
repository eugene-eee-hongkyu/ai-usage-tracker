# backlog.md — 나중에 할 것들

---

## 대기 중

## 2026-05-02: 팀원 4명 자가 치유 promote 검증

- **백로그 이유**: 다른 팀원들이 새 코드 받기 전엔 진행 안 됨. repair 또는 다음 launchd sync 필요
- **할 것**: 팀원 4명(oreo, Junghwan, Youngjin x2)의 다음 sync 후 `period_snapshots`에 daily(4/30) + monthly(2026-04-01) 행이 INSERT되는지 확인
- **필요한 것**: 그분들이 repair 실행하거나 launchd 자동 sync로 새 submit.mjs 받음 + ccusage 5/1 entry 누적
- **이전 검토**: deriveUserTodayFromBody fix 후 본인은 자가 치유 검증 완료. period_snapshots DELETE해서 재검증 대기 중

## 2026-05-01: 5/2 첫 daily 스냅샷 promote 검증

- **백로그 이유**: 시점 도래 전 검증 불가. 본인 5/2 00:00 sync에선 today.daily 비어있어 boundary 미감지 — 새 코드(today.period 파싱)로 다음 sync 시점부터 정상화 예상
- **할 것**: 다음 sync 후 `period_snapshots`에 `daily, 2026-05-01` 행이 INSERT되는지 확인 + 대시보드 `[이전 ▼]` 드롭다운에 `어제 (5/1)` 등장
- **필요한 것**: 사용자 머신 launchd 정상 동작 + repair 1번으로 새 코드 적용
- **이전 검토**: 5/1 06:00 자가 치유 OK, 그 후 user 요청으로 DELETE해서 재검증

## 2026-04-29: 5/4 (월) 첫 weekly 스냅샷 promote 검증

- **백로그 이유**: 다음 주 월요일까지 대기 필요
- **할 것**: 5/4 00:00+ 첫 sync 후 `period_snapshots`에 `weekly, 2026-04-27` 행 INSERT 확인 + `[지난주 ▼]` 드롭다운 등장
- **필요한 것**: 월요일 시점 도래
- **이전 검토**: payload-based boundary + today.period 파싱 fix와 무관하게 자연 promote 예정

## 2026-05-01: 6/1 첫 monthly 스냅샷 promote 검증

- **백로그 이유**: 6월 1일까지 대기 필요
- **할 것**: 6/1 00:00+ 첫 sync 후 `period_snapshots`에 `monthly, 2026-05-01` 행 INSERT 확인 + `[지난달 ▼]` 드롭다운 등장
- **필요한 것**: 5월 한 달 정상 sync 누적, 6/1 시점 도래
- **이전 검토**: 5/1 sync에서 April monthly는 자가 치유 OK 후 사용자 요청 DELETE. 6/1엔 새 코드로 prev=5/1, new=6/1 boundary 정상 감지 예상

NONE

세션 요약에서 명시적으로 미뤄진 항목이 없습니다. 진행된 작업들(worklog 아카이브, 파일 정리, 커밋)이 완료되었고, "다음" 항목은 계획된 다음 단계이지 현재 세션에서 백로그로 남겨진 것이 아닙니다.

<!-- 새 항목은 여기 위에 추가 -->

---

## 완료 / 취소

