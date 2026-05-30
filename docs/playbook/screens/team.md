# Team (/team, /team/[userId], /team/[userId]/dashboard)

> "우리 팀 한눈에" + 멤버 프로필 + 어드민의 멤버 시점 view-as. team-view 컴포넌트가 body, 진입점은 /team / 어드민의 같은 컴포넌트 (adminMode=true).

## 화면 구조

team-view.tsx 의 const Block 들 (provider segmented control 공유 — useProviderPreference, commit fb3f595):

| Block | 역할 | 비고 |
|---|---|---|
| byMemberBlock | 멤버 별 사용량 | provider 별 |
| totalBlock | 팀 총합 | provider 별 |
| byMemberTokenBlock | 멤버 별 토큰 | provider 별 |
| totalTokenBlock | 팀 총합 토큰 | provider 별 |
| activityBlock | 팀 활동 | provider 별 |
| costBlock | 비용 | provider 별 |
| powerRankBlock | 파워 랭크 | provider 별 |
| dailyUnitCostBlock | 일별 토큰 단가 (line 888) — `data.dailyUnitCostByMember` 그대로 받음 (line 914), period 토글 따라감 |
| headlineBlock | 산업 비교 (industryComparison.activeDayCount > 0 일 때만) | 분기 |
| teamPlanSavingsBlock | 팀 Plan 절약 | **adminUser 만** 노출 |
| topTokensBlock | 상위 토큰 멤버 | **adminUser 만** 노출 |
| efficiencyBlock | 효율 | provider 별 |
| teamActivitiesBlock | 팀 활동 list | provider 별 |
| byModelBlock | 모델 별 분포 | provider 별 |

## 공통 invariant

- provider segmented control 노출 (claude / codex). 멤버 중 provider 별 의미 있는 사용 1+ 있어야 enabled (Multi-provider Phase 2, code line 199-200).
- 토글 전환 시 setData(null) 즉시 분기 → 옛 scope 데이터 잔상 없음 (team-view line 496-501)
- period 필터 (day / week / month) — fetch 쿼리에 ?period=...
- adminMode=true (= /admin/team 경로) 일 때만 teamPlanSavingsBlock / topTokensBlock 노출

---

## Anchor x provider 매트릭스

### Anchor 1 — 본인 (eugene.eee@iskra.world, platform admin)

| 진입 | provider | 기대 노출 |
|---|---|---|
| /team | claude | iskra 팀 멤버 list (영진님, oreo, 본인 포함). byMember / total / activity / cost / powerRank / efficiency 모두 노출. teamPlanSavingsBlock / topTokensBlock 미노출 (adminMode=false) |
| /team | codex | claude+codex 양쪽 데이터 있는 멤버 (영진님, oreo) 만 byMember 에 노출. claude-only 멤버는 빈 행 또는 제외 |
| /admin/team | claude | adminMode=true → teamPlanSavingsBlock / topTokensBlock 추가 노출 |

**본인 특이 검증**:
- 멤버 카드 클릭 → /team/[userId] (멤버 프로필) 진입
- 어드민 시점에서 멤버 카드 클릭 → /team/[userId]/dashboard (멤버 시점 dashboard view) 진입

### Anchor 2 — 영진님 (user_id=4, view-as)

| 진입 | provider | 기대 노출 |
|---|---|---|
| /team (영진님 시점) | claude | iskra 팀 노출. 본인 (영진님) 이 byMember 에 highlight |
| /team (영진님 시점) | codex | 양쪽 데이터 보유 → codex 토글에서도 본인 표시 |

**영진님 특이 검증**:
- 멤버 카드 의 device 2 개 분리 표시 (혹은 합산) — dashboard 의 device 분리와 일치하는지

### Anchor 3 — oreo (user_id=2, view-as)

| 진입 | provider | 기대 노출 |
|---|---|---|
| /team (oreo 시점) | claude | iskra 팀 노출. oreo 가 byMember 에 highlight, plan_tier=max20 반영 |
| /team (oreo 시점) | codex | codex 토글에서도 oreo 표시. efficiencyBlock 의 멤버 별 경고가 oreo 행에 노출되는지 (dashboard 의 efficiency 경고가 team-view 에도 전파되는지 확인) |

---

## /team/[userId] (멤버 프로필) 검증 — 2026-05-30 prod 검증

**중요: 단순화된 프로필 view 이지 dashboard-view 풀 화면이 아님.** 구조:

| 영역 | 노출 |
|---|---|
| 헤더 | "← Team ranking" 링크 + "{name} profile" 제목 |
| provider 토글 | Claude Code / Codex (데이터 있을 때만) |
| Hero 4 카드 | Total cost / Sessions / Cache hit / 🔥 Streak |
| Activity heatmap | **4 weeks**, by cost (본인 /dashboard 는 24 weeks) |
| Top projects | 10 개 list (project path + cost + sessions) |

**없는 것** (본인 /dashboard 와 다름):
- device 별 line 분리 (M6f 의 device 분리는 /platform-admin/all-users 의 카드 분리로 노출)
- gauge / planSavings / unitCost / efficiency 카드 / cacheStreak / Activity heatmap 24 weeks
- Codex modal 자동 trigger
- AI tier 추정 카드 (이건 본인 /dashboard 에도 없음, 일관)

**"No data yet" 분기** — 최근 활동 없는 멤버는 hero / heatmap / projects 모두 미노출, "Data is collected automatically after the user finishes their first Claude Code session." 카피만. provider 토글도 안 그림. (2026-05-30 oreo 케이스 검증 — DB 데이터 있어도 최근 활동 기준 미충족 시 이 분기)

---

## /team/[userId]/dashboard → 실제로는 /team/[userId] 로 redirect

CONTEXT.md 에 "/team/[userId]/dashboard — 어드민이 멤버 시점 dashboard view" 로 적혀있으나 **2026-05-30 prod 검증 시 /team/4/dashboard → /team/4 로 redirect**. 파일은 존재 (`web/src/app/team/[userId]/dashboard/page.tsx`) 하나 routing 결과는 단순화 view. CONTEXT.md 갱신 필요 (별 이슈).

**대신 멤버 시점 풀 dashboard 보려면**: /platform-admin/all-users → 멤버 카드 클릭 → view-as 활성 → /admin/members landing → /dashboard 로 navigate (view-as 유지 상태로 멤버 시점 dashboard 노출)

---

## 깨졌을 때 1차 진단

| 증상 | 1차 의심 |
|---|---|
| iskra 팀에 oreo / 영진님 누락 | auto-join 매핑 회귀 (z21labs.xyz → iskra) |
| codex 토글 시 양쪽 데이터 보유 멤버 누락 | team route codex 탭 멤버 필터 회귀 (commit 2f394b6) |
| dailyUnitCostBlock 의 멤버 색 dot 누락 | line 896 의 monthlyPriceUsd 필터 회귀 |
| /admin/team 에서 teamPlanSavingsBlock / topTokensBlock 미노출 | adminMode 또는 adminUser 분기 회귀 |
| 토글 전환 시 옛 멤버 잔상 | team-view setData(null) 분기 회귀 (commit 151c72b 회귀) |

---

## 미정 / 후속

- team route user-level 집계 union 합산 (state.md 보류) — 결정 후 행 추가
- All Teams 화면 lazy load — 팀 두 자릿수 되면 (state.md 보류)
- M6f team route 의 device 별 line 분리 (Phase 3, 1-2 주 후)
