# Dashboard (/dashboard)

> 개인 메인. M6c 재구조 이후 옛 detail 탭 통합. provider segmented control 로 Claude Code / Codex 분리.

## 화면 구조 (top → bottom)

본인 (eugene.eee@iskra.world) 시점 prod 진입 (2026-05-30 검증) 기준:

1. **헤더 (Nav)** — 좌 "AI Usage Tracker · iskra.world", 중앙 nav (Personal / Team / Ranking / Setup), 우 KO/EN 토글 + "i" Version info popover (about-popover, 빌드 SHA) + 본인 dropdown ("Eugene ▾")
2. **고지 alert** — "ⓘ Not an evaluation tool. Your efficiency score is for self-coaching, not performance reviews." (dismissable)
3. **provider segmented control** — "Claude Code" / "Codex" 두 버튼 (실 라벨, 코드는 claude / codex)
4. **Period 토글** — Today / 8 days / This month / 30 days / All + "Earlier ▼" 드롭다운 (지난 주 / 2주 전 / 3주 전 ...)
5. **Privacy notice** — "🔒 This tool only collects token count · tool names. Code · prompts · Claude responses are NOT collected." (dismissable)
6. **Hero 5 카드 (UsageHero 컴포넌트, dashboard-view line 28 import)** — tokens / cost / cache hit / 1-shot / Active N days (Last received 시각 + 타임존 토글)
7. **Daily Activity (토큰) 차트 + Daily Cost (비용) 차트** — 2 columns
8. **Daily Unit Cost ($ / 1M)(log) 차트 + Plan Savings 카드** — 2 columns
9. **Power Index 카드 + Unit Cost (plan tier select 포함) 카드** — 2 columns (게이지)
10. **Activity heatmap (24 weeks, by cost)** — react-activity-calendar
11. **비용 원인 Top 3 카드** — Project / Model / Activity 3 행
12. **"Show details ▼" 토글** — 안에 by model / by project / top sessions / by activity / tools / shell / MCP / dwell heatmap
13. **N days avg efficiency 카드** — Score + cache + one-shot + cost + usage 분해 + 24주 efficiency heatmap (Warning / Improve / Good / Exemplary)
14. **하단**: "ⓘ What your admin can see ▼" (transparency-card, page.tsx:9, 77) / footer (릴리즈 노트 · 제안하기)

## 화면 구조 (Block 단위)

dashboard-view.tsx 의 const Block 들 (line 번호는 2026-05-30 기준):

| Block | 라인 | 역할 | provider 분기 |
|---|---|---|---|
| UsageHero | line 28 import | Hero 5 카드 (tokens / cost / cache hit / 1-shot / Active) | provider 별 |
| gaugeBlock | 402 | Power Index + Unit Cost 게이지. **period 평균** (line 382) | provider 별 |
| dailyCostBlock | 2137 | Daily Cost 차트 ("$ per day") | provider 별 |
| (Daily Activity) | 동일 영역 | Daily Activity (토큰) 차트 — dailyCostBlock 옆 column | provider 별 |
| unitCostBlock | 1538 | Daily Unit Cost (log scale) — **period 따라감** (data.dailyPlanUnitCost, line 1548) | provider 별 |
| planSavingsBlock | 1686 | Plan 절약 추정 — period 무관 monthRecovery hero + period 별 절감 fallback (line 1740-1742) | claude 만 (Codex 는 별도 tier 카드) |
| activityHeatmapBlock | 2176 | Activity heatmap (24 weeks, by cost) | provider 별 분기 |
| costCauseTop3Block | 2032 | 비용 원인 top 3 (Project / Model / Activity) | provider 별 |
| efficiencyBlock | 1876 | N days avg efficiency + 24주 efficiency heatmap | provider 별 |
| cacheStreakBlock | 2082 | "Current cache hit ≥ 90% Streak" + team cache hit rank | claude 만 |
| mcpServersBlock | 1438 | MCP 서버 list (**Show details 안에 숨어있음**) | claude 만 |
| dwellHeatmapBlock | 1476 | dwell heatmap (**Show details 안**) | provider 무관 |

provider 토글은 dashboard / team / ranking 간 공유 (useProviderPreference, commit fb3f595).

## 공통 invariant (모든 anchor)

- provider segmented control "Claude Code" / "Codex" 두 버튼 노출
- period 토글 (today / 8days / month / 30days / all + Earlier 드롭다운) 노출 (dashboard-view line 55)
- 한쪽 provider 에 데이터 없으면 토글은 보이되 선택 시 빈 상태 카피 노출 (data=null 분기)
- 토글 전환 시 화면 깜빡임 없이 카드 series 만 교체 (잔상 fix, commit 151c72b)
- about-popover (헤더 "i" 버튼) 빌드 SHA 노출
- AI 자동 tier 추정 카드 노출 X (Phase 1 제거, commit bbc4eed) — 사용자 입력 강제 (Unit Cost 카드 의 select 가 사용자 입력 채널)
- transparency-card ("What your admin can see") 노출

---

## Anchor x provider 매트릭스

### Anchor 1 — 본인 (eugene.eee@iskra.world, platform admin)

| provider | 진입 방법 | 기대 노출 (2026-05-30 본인 시점 검증 완료) |
|---|---|---|
| Claude Code | /dashboard 직접 | Hero 5 카드 + 2 차트 + Daily Unit Cost + Plan Savings + Power Index 게이지 (100/100) + Unit Cost 게이지 (Max 20x select) + Activity heatmap (24 weeks) + 비용 원인 Top 3 + efficiency 카드 + cache streak 카드 모두 노출. token 합계 > 0 |
| Codex | provider 토글 → Codex | Codex 전용 카드 (Phase 3a, commit 9cd7a4c) 노출. Codex plan tier 카드가 별도로 (codex_plan_tier, commit ce1b364). Free 옵션 X (commit 47e49e5) |

**본인 특이 검증**:
- /admin 마지막 선택 탭 자동 복귀 (commit da29b05) — /admin 진입 후 다른 곳 갔다가 /admin 재진입 시 마지막 탭으로
- transparency-card 노출 (page.tsx:9, 77) — 페이지 하단 "What your admin can see"
- Unit Cost 게이지 의 plan tier select 에 Max 20x 선택됨 (DB plan_tier=max20 반영)

### Anchor 2 — 영진님 (user_id=4, view-as)

| provider | 진입 방법 | 기대 노출 |
|---|---|---|
| Claude Code | /platform-admin → view-as 영진님 → /dashboard | **device 분리 line 2 개** (Mac + Windows) — M6f token_id 분기. 1 개로 합쳐 보이면 회귀. team badge "iskra" (z21labs.xyz 도메인 가입자임에도). Unit Cost plan tier select 에 Max 5x 선택됨 (plan_tier=max5) |
| Codex | provider 토글 → Codex | claude+codex 양쪽 데이터 보유 (확인됨). Codex 카드 노출. codex_plan_tier=null 이므로 Codex modal 자동 trigger 검증 가능 |

**영진님 특이 검증**:
- dual domain 표시 정합성 — 이메일은 z21labs.xyz 인데 team 은 iskra
- device 별 line 의 라벨이 device 이름 (api_tokens.name) 으로 노출되는지
- device_count = 2 유지 (DB 변경 시 회귀 신호)

### Anchor 3 — oreo (user_id=2, view-as, Codex baseline)

| provider | 진입 방법 | 기대 노출 |
|---|---|---|
| Claude Code | view-as oreo → /dashboard | claude 데이터 보유 (max20). Hero + gauge + planSavings + unitCost + activityHeatmap 등 모두 노출 |
| Codex | provider 토글 → Codex | **efficiencyBlock 합계 경고 노출** (현재 baseline — state.md 보류 항목). 경고 사라지면 진단 풀린 것인지 / 데이터 변동인지 / 회귀인지 확인 필요. **codex_plan_tier=null** 이므로 Codex modal 자동 trigger (Free 옵션 없음, commit 47e49e5 / ce1b364) 노출 여부 검증 |

**oreo 특이 검증**:
- Codex 전용 metric (Phase 3a, commit 9cd7a4c / 8cf6dea / af07e7f) 노출
- Codex modal 자동 trigger — codex_plan_tier=null 상태에서 codex 토글 진입 시 modal 노출 정상 동작 (사용자 입력 강제, Phase 1)
- Codex plan tier 카드의 Free 옵션 없음 (commit 47e49e5)

---

## view-as 자체 검증 (전 anchor 공통)

- view-as 진입 시 page.tsx:18 의 ViewAsBlockedNotice 가 **노출되지 않아야** (= view-as 가 허용된 상태). 노출 시 권한 회귀.
- view-as 종료 → 본인 시점 복귀 (commit ae5aabb 의 all-teams Codex scope 누락 fix 와 같은 회복 로직)

---

## 깨졌을 때 1차 진단

| 증상 | 1차 의심 |
|---|---|
| 영진님 device line 1 개로 합침 | M6f token_id 분기 (user_snapshots.token_id 컬럼 사용 회귀) |
| 영진님 team badge "iskra" 가 아닌 z21labs | auto-join 도메인 매핑 회귀 (teams.auto_join_domains) |
| oreo Codex 경고 사라짐 | efficiencyBlock 의 경고 트리거 조건 변경 또는 oreo 데이터 분포 변화 |
| 토글 전환 시 카드 잔상 | 151c72b 회귀 (옛 멤버 표시 버그 재발) |
| AI tier 추정 카드 재등장 | Phase 1 제거 (commit bbc4eed) 회귀 |
| Codex tier 에 Free 옵션 재등장 | commit 47e49e5 회귀 |
| Hero 5 카드 1 개 누락 | UsageHero 컴포넌트 회귀 |
| Period 토글 옵션 변동 | dashboard-view line 55 (Period type) 변경 |
| Daily Unit Cost 가 항상 30 일 고정 | API tier 분기 (line 1553) 또는 data.dailyPlanUnitCost 길이 강제 변경 |

---

## 잠재 회귀 / 정책 변동 (2026-05-30 playbook 1차 실행 발견)

- **Daily Unit Cost 차트가 period 따라감** — period=8days 본인 시점 진입 시 8 일치만 노출 확인. memory `project_unit_cost_chart_30days` 는 "항상 30일 (사용자 결정 2026-05-21)" 로 기록되어 있어 모순. 두 가지 가능성:
  - A. **정책 회귀** — API 또는 chart 로직이 period 따라가도록 변경됨 → 사용자가 정책 유지 원하면 fix 필요
  - B. **정책 의도적 폐기** — period 따라가도록 변경 의도 → memory 삭제 + 본 매트릭스 가정 변경
- 사용자 확인 후 결정. 진단 entry point: `web/src/app/api/dashboard/route.ts` 의 `dailyPlanUnitCost` 응답이 period 따라 잘리는지 / 30 일 그대로인지 확인.

---

## 미정 / 후속 (현재 매트릭스 미포함)

- by model / project / activity / top sessions / hero 의 strict today 통일 (state.md 보류) — 통일 후 행 추가
- ccusage daily vs user_blocks 5h 통일 결정 후 cacheStreakBlock 정의 재확인
- 차트 device 별 line 분리 (M6f Phase 3, 1-2 주 후) — Anchor 2 영진님 매트릭스 갱신
