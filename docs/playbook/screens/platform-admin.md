# Platform Admin (/platform-admin/*)

> ADMIN_EMAIL 화이트리스트 전용 (fallback 없음 — H2 감사 결정). rose bar 라벨. 본인 (eugene.eee@iskra.world) 만 진입. view-as entry point.

## 탭 구조 (platform-admin/layout.tsx:41-47)

| href | 라벨 |
|---|---|
| /platform-admin/all-users | All Team Users |
| /platform-admin/all-personal | All Personal |
| /platform-admin/all-teams | All Teams |
| /platform-admin/audit | Audit |
| /platform-admin/settings | Settings |

## 공통 invariant

- ADMIN_EMAIL 외 사용자는 진입 차단 (layout.tsx:39 — `status === "authenticated" && !isPlatformAdmin` → null 렌더)
- LOCAL_MODE 면 가드 bypass (layout.tsx:37) — playbook 범위 외
- rose bar 라벨 "Platform Admin"
- ViewAsBanner 노출

---

## Anchor x 탭 매트릭스

### Anchor 1 — 본인 (eugene.eee@iskra.world, platform admin) — 유일한 anchor

이 화면은 본인만 진입 가능. 영진님 / oreo view-as 시 platform admin 권한이 그쪽에 전파되면 안 됨 (격리 검증).

| 탭 | 진입 | 기대 노출 |
|---|---|---|
| /platform-admin/all-users | "All Team Users" | 모든 팀 사용자 카드 그리드. iskra 멤버 (본인, 영진님, oreo) 노출. 외부 회사 멤버도 노출 |
| /platform-admin/all-personal | "All Personal" | Personal 사용자 어드민 뷰 |
| /platform-admin/all-teams | "All Teams" | 모든 팀 비교 (활용지수 desc). Codex scope 누락 없음 (commit ae5aabb) — claude / codex 양쪽 metric 포함 |
| /platform-admin/audit | "Audit" | audit_logs hash chain integrity 표시. prev_hash / row_hash 연쇄 |
| /platform-admin/settings | "Settings" | Platform 옵션 |

**본인 특이 검증**:
- /platform-admin/all-users 의 사용자 카드 클릭 → view-as 진입
- view-as 진입 시 effective-team 격리 (effective-team.ts) — view-as 한 사용자의 팀으로 화면 전환
- view-as 종료 → 본인 시점 복귀, view-as cookie 정리

---

## /platform-admin/all-teams 의 핵심 검증

- iskra 팀이 활용지수 순으로 어디 위치하는지 (anchor 의 누적 데이터 반영)
- claude / codex 양쪽 metric 노출 — codex scope 누락 회귀 (commit ae5aabb) 신호 1순위
- 외부 회사 팀들도 노출 (전체 비교 의미)

## /platform-admin/audit 의 핵심 검증

- hash chain integrity OK 표시 (audit.ts 의 verify 로직)
- actor_is_platform_owner 플래그 노출 — 본인 액션은 그 플래그 true
- 최근 액션 (view-as 진입, anchor 진입) 이 audit 에 기록되는지

## /platform-admin/all-personal

- Personal 사용자 list
- 다른 이메일 = 별개 계정 분기 (Personal 시나리오 3, state.md 보류) 영향 확인

---

## 격리 검증 (view-as 사용 시)

본인 → view-as 영진님 / oreo:
- view-as 중에는 /platform-admin/* 진입 시 본인 시점 자동 복귀 또는 view-as 유지 동작 명확화
- view-as 종료 후 /platform-admin 다시 정상 진입

---

## 깨졌을 때 1차 진단

| 증상 | 1차 의심 |
|---|---|
| 비-ADMIN_EMAIL 사용자가 /platform-admin 진입 | isPlatformAdmin 가드 회귀 (admin.ts 의 ADMIN_EMAIL fallback 도입 — H2 결정 위반) |
| /platform-admin/all-teams 에서 codex metric 누락 | commit ae5aabb 회귀 |
| view-as 진입 후 platform admin 권한이 anchor 시점에 새어 보임 | effective-team 격리 회귀 |
| audit 의 hash chain verify 실패 | audit_logs row 변조 / 직접 INSERT (수동 SQL) 흔적 |
| view-as cookie 정리 안 됨 (종료 후에도 banner 유지) | view-as 종료 endpoint 회귀 |

---

## 미정 / 후속

- audit_logs 의 환경 분리 (state.md 보류 항목들 중 환경 분리 결정 시 검증 항목 추가)
- 평가 지표 변경 (활용지수) 시 all-teams 순서 변동 확인
