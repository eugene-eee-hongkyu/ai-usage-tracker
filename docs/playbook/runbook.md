# Runbook — release 전 체크리스트

> release 직전 10-15 분 안에 끝나도록 압축. 위에서 아래 순서대로. 불일치 발견 시 즉시 멈추고 해당 screens md 와 비교 / 원인 진단.

## 사전

- [ ] aiusage.z21labs.world 본인 (eugene.eee@iskra.world) 로그인 확인
- [ ] about-popover 의 빌드 SHA 가 이번 release 의 commit 인지 확인
- [ ] 변경 commit list 한 번 훑고 영향 받는 screens md 식별 (이번 release 의 핵심 변경 칸 위주로 본다)

## Screens 명세 cross-link

각 화면의 매트릭스·진단표는 screens md 본문 참조:
- [dashboard.md](screens/dashboard.md)
- [team.md](screens/team.md)
- [ranking.md](screens/ranking.md)
- [admin.md](screens/admin.md)
- [platform-admin.md](screens/platform-admin.md)

아래는 release 마다 빠르게 훑는 핵심 항목만. 의심 발생 시 해당 screens md 로 들어가 깊은 매트릭스 확인.

## Anchor 1 — 본인 (platform admin)

### /dashboard

- [ ] 헤더 nav (Personal / Team / Ranking / Setup) + 본인 dropdown (Eugene)
- [ ] 고지 alert ("Not an evaluation tool") + privacy notice ("🔒 only token count") 노출
- [ ] **Hero 5 카드** (tokens / cost / cache hit / 1-shot / Active N days) 노출
- [ ] provider segmented control "Claude Code" / "Codex" 노출
- [ ] period 토글 (Today / 8 days / This month / 30 days / All + Earlier 드롭다운) 노출
- [ ] Claude Code 토글: gauge (Power Index + Unit Cost) / efficiency / planSavings / unitCost / dailyCost / cacheStreak / activityHeatmap 모두 노출, token > 0
- [ ] "Show details ▼" 안에 by model / by project / top sessions / activity / tools / shell / MCP / dwell heatmap 노출
- [ ] Codex 토글: Codex 전용 카드 노출, Codex plan tier 카드의 Free 옵션 없음
- [ ] AI 자동 tier 추정 카드 노출 안 됨 (Phase 1 제거 회귀 X) — Unit Cost 카드 의 plan tier select 가 사용자 입력 채널
- [ ] 토글 전환 시 잔상 / 빈 깜빡임 없음
- [ ] 페이지 하단 transparency-card ("What your admin can see") 노출
- [ ] **(잠재 회귀 확인)** Daily Unit Cost 가 period=8days 일 때 30 일 보임? — memory `project_unit_cost_chart_30days` 정책 일치 여부. 사용자 결정 대기 항목

### /team

- [ ] iskra 팀 멤버 list 노출 (영진님, oreo 포함)
- [ ] codex 토글 시 양쪽 데이터 보유 멤버 (영진님, oreo) 표시 (commit 2f394b6 회귀 X)
- [ ] dailyUnitCostBlock 30 일 고정
- [ ] adminMode=false (= /team) 에서 teamPlanSavingsBlock / topTokensBlock 미노출

### /ranking

- [ ] 5 metric 모두 노출 (cost hero + 사용량 / streak / 캐시히트 / 캐시절약액 2x2)
- [ ] 본인 이름 마스킹 안 됨, 타인 이름 마스킹
- [ ] Personal hidden 사용자 사라짐, suspend / delete 사용자 사라짐

### /admin

- [ ] 마지막 선택 탭 자동 복귀 (다른 곳 갔다가 /admin 재진입)
- [ ] 5 탭 평탄화 노출: 팀원 / 팀 / 랭킹 / 사용자 / 세팅 (commit ece6494, 24a2e25)
- [ ] /admin/team/ranking 진입 시 "랭킹" 만 active ("팀" 은 dim)
- [ ] /admin/team 직접 진입 시 teamPlanSavingsBlock / topTokensBlock 추가 노출 (adminMode=true)

### /platform-admin

- [ ] /platform-admin/all-users — 모든 팀 사용자 카드 그리드. iskra 멤버 (본인, 영진님, oreo) 노출
- [ ] /platform-admin/all-teams — 모든 팀 비교 (활용지수 desc), Codex scope 누락 없음 (commit ae5aabb)
- [ ] /platform-admin/all-personal — Personal 사용자 노출
- [ ] /platform-admin/audit — hash chain integrity 표시
- [ ] /platform-admin/settings — Platform 옵션

## Anchor 2 — 영진님 (user_id=4, youngjin.kim@z21labs.xyz, view-as)

진입: /platform-admin/all-users → 영진님 카드 → view-as

### /dashboard

- [ ] **device 분리 line 2 개** (Mac + Windows) 노출 — 1 개로 합쳐졌으면 M6f 회귀
- [ ] team badge "iskra" 노출 (이메일은 z21labs.xyz 인데 팀은 iskra — dual-domain auto-join 정확성)
- [ ] provider 토글 claude / codex 둘 다 노출, 양쪽 데이터 보유 확인
- [ ] codex 토글 시 codex_plan_tier=null 이면 Codex modal 자동 trigger (Free 옵션 없음)
- [ ] plan_tier=max5 게이지 반영

### /team

- [ ] iskra 팀에 본인 (영진님) highlight

### /admin/users

- [ ] iskra 멤버 list 에 영진님 노출

### 종료

- [ ] view-as 종료 → 본인 시점 복귀 정상, view-as cookie 정리

## Anchor 3 — oreo (user_id=2, jinwoo.park@z21labs.xyz, view-as, Codex baseline)

진입: /platform-admin/all-users → oreo → view-as → /dashboard

### /dashboard provider=claude

- [ ] plan_tier=max20 게이지 반영
- [ ] device 1 개 line

### /dashboard provider=codex

- [ ] efficiencyBlock 합계 경고 노출 (현재 baseline)
  - 경고 사라짐 시 → 별도 진단 필요. state.md 의 "oreo Codex efficiency 합계 경고" 보류 항목 상태 확인
- [ ] Codex 전용 metric 카드 노출 (Phase 3a)
- [ ] **codex_plan_tier=null** → Codex modal 자동 trigger 노출 (Free 옵션 없음, commit 47e49e5)
- [ ] modal 닫고 그대로 두면 다음 진입 시 다시 trigger 되는지 확인 (= 사용자 입력 강제)

### 종료

- [ ] view-as 종료

## 사후

- [ ] 이번 release 의 결과 1 줄 기록 (아래 history 에)
- [ ] 불일치 발견 항목은 별도 issue / run 으로 트래킹
- [ ] anchor 깨짐 발견 시 anchors.md 갱신

---

## History

> release 마다 1 줄: 날짜 / commit / 통과·실패 / 비고

| 날짜 | release commit | 결과 | 비고 |
|---|---|---|---|
| 2026-05-30 | 24bf0dd (playbook 작성 직후) | Anchor 1 (본인) /dashboard 부분 통과, 정정 사항 발견 → screens md 갱신 | Hero 5 카드 / Period 토글 / nav / Daily Activity 차트 / "Show details" 가 dashboard.md 매트릭스에 누락되어 있어 추가. Daily Unit Cost 가 period=8days 일 때 8 일치만 보여 `unit_cost_chart_30days` 정책 회귀 의심 — 사용자 확인 대기. ranking.md 의 "streak" 라벨 → "연속 활성일" 정정. Anchor 2 / 3 (영진님 / oreo view-as) 미실행 (이번 라운드는 Anchor 1 + 코드 정적 검증 + DB 검증 위주) |
