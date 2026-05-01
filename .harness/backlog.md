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

## 2026-05-01: AI 사용량 추적기 - sync 및 promote 확인

### 1. 팀원 4명 sync 후 자가 치유 promote 확인
- **백로그 이유**: 팀원 4명의 12:00/18:00 SGT sync가 아직 진행 중 — 완료 후 결과 검증 필요
- **할 것**: sync 완료 후 자가 치유(self-healing) promote 로직이 정상 동작하는지 확인
- **필요한 것**: 팀원 4명의 동기화 완료
- **이전 검토**: decision.md에 팀 stale 멤버 필터 결정 기록됨

### 2. 2026-05-02 첫 sync 후 daily promote 확인
- **백로그 이유**: 5/2 첫 동기화까지 대기 필요 — 본인 머신의 5/1 일일 promote는 그 이후 검증 가능
- **할 것**: 5/2 sync 완료 후 본인 머신에서 5/1 daily promote 동작 확인
- **필요한 것**: 2026-05-02 첫 sync 완료
- **이전 검토**: 30일 period 및 UTC TZ env 주입 관련 결정 완료

### 3. 2026-05-04(월) 첫 sync 후 weekly promote 확인
- **백로그 이유**: 5/4 첫 sync까지 대기 필요 — weekly 프로모션은 그 이후 검증 가능
- **할 것**: weekly promote 로직 정상 동작 확인
- **필요한 것**: 2026-05-04(월) 첫 동기화 완료
- **이전 검토**: 모든 promote 관련 결정사항 decision.md에 기록됨

<!-- 새 항목은 여기 위에 추가 -->

---

## 완료 / 취소

