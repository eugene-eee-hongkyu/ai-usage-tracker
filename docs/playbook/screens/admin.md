# Admin (/admin/*)

> 팀 어드민 영역. 2026-05-30 평탄화 5 탭 (commit ece6494, 24a2e25). 마지막 선택 탭 자동 복귀 (commit da29b05). amber bar 라벨.

## 탭 구조 (admin/layout.tsx:60-66)

| href | 라벨 | 권한 |
|---|---|---|
| /admin/members | 팀원 | Membership Admin |
| /admin/team | 팀 | Billing Admin |
| /admin/team/ranking | 랭킹 | Billing Admin |
| /admin/users | 사용자 | Membership Admin |
| /admin/settings | 세팅 | Platform Admin or Team Owner |

## 공통 invariant

- visible 탭만 노출 (권한 기반 필터). 본인 (platform admin) 은 5 개 모두 visible
- 마지막 선택 탭 localStorage 저장 (`admin_last_tab`, admin/layout.tsx:48) → /admin 진입 시 그 탭으로 복귀
- longest-prefix active 매칭 — /admin/team/ranking 진입 시 ranking 만 active (line 82-85)
- amber bar 라벨 "Admin"
- ViewAsBanner 노출 (view-as 진행 중일 때)
- **/platform-admin/all-users 카드 클릭 시 view-as 활성 + /admin/members 로 landing** (2026-05-30 prod 검증). 그 사용자 시점 풀 dashboard 보려면 /dashboard 로 별도 navigate

---

## Anchor x 탭 매트릭스

### Anchor 1 — 본인 (eugene.eee@iskra.world, platform admin)

| 탭 | 진입 | 기대 노출 |
|---|---|---|
| /admin/members | "팀원" | iskra 팀 멤버 list + 가입 신청 (invitations / join_requests) 관리 |
| /admin/team | "팀" | iskra 팀 정보 (name, slug, auto_join_domains, auto_join_enabled, max_members) + rename |
| /admin/team/ranking | "랭킹" | 팀끼리 비교 랭킹 (Billing Admin 전용) — adminMode 활성 |
| /admin/users | "사용자" | iskra 멤버 list + suspend / delete 액션 (실행은 playbook 에서 X) |
| /admin/settings | "세팅" | 권한·옵션 |

**본인 특이 검증**:
- /admin 직접 진입 → 마지막 선택 탭 으로 복귀 (예: 직전이 /admin/users 면 그쪽으로). 한 번 다른 탭 클릭 후 /admin 재진입 → 그 탭으로
- /admin/team/ranking 진입 시 "팀" 탭 active 안 됨 ("랭킹" 만)
- /admin/team 진입 시 "랭킹" active 안 됨 ("팀" 만)

### Anchor 2 — 영진님 (user_id=4, view-as)

영진님 시점에서 /admin 진입 시:
- 영진님이 iskra 팀의 어드민 권한 보유 여부에 따라 탭 visible 달라짐
- 평사용자라면 admin 진입 자체 차단 또는 일부 탭만 visible

| 탭 | 영진님 권한에 따른 기대 |
|---|---|
| /admin/members | Membership Admin 면 visible, 아니면 미노출 |
| /admin/team | Billing Admin 면 visible |
| /admin/team/ranking | Billing Admin 면 visible |
| /admin/users | Membership Admin 면 visible |
| /admin/settings | Team Owner 면 visible |

**영진님 특이 검증**:
- view-as 영진님 시점에서 본인 (platform admin) 의 권한이 의도와 다르게 새지 않는지 (effective-team / view-as 격리)

### Anchor 3 — oreo (user_id=2, view-as)

영진님과 동일 패턴 (iskra 팀 권한에 따라).

---

## 깨졌을 때 1차 진단

| 증상 | 1차 의심 |
|---|---|
| 5 탭 외 다른 라벨 (옛 [Users/Team/Settings] 3 탭) | 평탄화 회귀 (commit ece6494 / 24a2e25 회귀) |
| /admin/team 과 /admin/team/ranking 둘 다 active 노출 | longest-prefix active 분기 회귀 (layout.tsx:82-85) |
| /admin 진입 시 항상 첫 탭 으로 | admin_last_tab localStorage 회귀 (commit da29b05) |
| view-as 시점에서 본인 권한이 새어 visible 탭이 어드민 시점에 안 맞음 | view-as 격리 회귀 (effective-team) |
| ViewAsBanner 미노출 | view-as cookie 또는 banner 컴포넌트 회귀 |

---

## 미정 / 후속

- M6c (owner 권한 이양 + 팀 관리 API) (state.md 보류) — 도입 후 settings 탭에 신규 항목 추가
- Phase 4.2 M6c 잔여 (state.md 보류) — 함께 갱신
