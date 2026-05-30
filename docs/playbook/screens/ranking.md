# Ranking (/ranking)

> 전체 personal-on 사용자 + team 사용자 랭킹. 5 metric (비용 hero + 사용량 / 연속 활성일 / 캐시 히트 / 캐시 절약액 2x2 grid). 본인 외 이름 마스킹. Personal toggle off 사용자 제외.

## 화면 구조

ranking/page.tsx (4-metric grid + 1 hero metric = 5 metric, 코드 정의 line 18 / 45-50 / 52):

```ts
type Metric = "cost" | "tokens" | "cacheHit" | "streak" | "saving";
GRID_METRICS = [
  { value: "tokens",   label: "사용량" },
  { value: "streak",   label: "연속 활성일" },
  { value: "cacheHit", label: "캐시 히트" },
  { value: "saving",   label: "캐시 절약액" },
];
ALL_METRICS = ["cost", "tokens", "cacheHit", "saving", "streak"];
```

| Section | 역할 | 비고 |
|---|---|---|
| ProviderSegmentedControl | Claude Code / Codex 토글 (dashboard / team 과 공유 — useProviderPreference) | localStorage |
| Hero: MetricCard "cost" | 비용 metric (5 컬럼 — rank / name / activeDays / cost / sessions) | hero (wide) |
| Grid: 4 MetricCard | 사용량 / 연속 활성일 / 캐시 히트 / 캐시 절약액 (2x2 grid, 4 컬럼) | grid |
| 각 MetricCard 내 | label + 본인 hero (myRank) + Top 10 + "본인이 top 10 밖" 행 (⋯ + RankRow) | per metric |

## 공통 invariant

- provider 토글 시 byMetric 즉시 폐기 (page.tsx:153 — setByMetric({})) → 옛 scope 잔상 없음
- 본인 이름 마스킹 안 됨, 타인 이름 마스킹 (RankRow 의 mask 처리)
- Personal toggle off 사용자 → ranking 에서 사라짐 (api/ranking 단계에서 필터)
- ranking_hidden 사용자 → 사라짐
- suspend / delete 사용자 → 사라짐
- 본인이 top 10 안에 있으면 마지막 "본인 행" 중복 노출 X (myRank 가 top 10 안에 있을 때)
- 본인이 top 10 밖이면 ⋯ + 본인 행 노출

---

## Anchor x provider 매트릭스

### Anchor 1 — 본인 (eugene.eee@iskra.world, platform admin)

| provider | 기대 노출 |
|---|---|
| claude | 5 metric 모두 노출. 본인 이름 노출 (마스킹 X). 본인이 iskra 팀 사용자 + Claude 활동 1+ 면 hero (myRank) 에 본인 표시 |
| codex | 5 metric 모두 노출. codex provider 의 activeDays / cost / 사용량 등으로 다른 분포 |

**본인 특이 검증**:
- ranking 의 타 사용자 행 — 모두 마스킹 (이름 anonymized)
- 본인이 ranking_hidden=false 일 때 본인 hero 노출, true 일 때 사라짐 (toggle 검증)

### Anchor 2 — 영진님 (user_id=4, view-as)

view-as 영진님 → /ranking:

| provider | 기대 노출 |
|---|---|
| claude | 영진님 시점 — 영진님 본인 이름 노출, 다른 사람 마스킹 |
| codex | 영진님 codex 데이터 있음 → codex ranking 에 영진님 표시 가능 |

### Anchor 3 — oreo (user_id=2, view-as)

view-as oreo → /ranking:

| provider | 기대 노출 |
|---|---|
| claude | oreo 본인 이름 노출, plan_tier=max20 이라 비용 ranking 에서 top 권 가능성 |
| codex | oreo 본인 이름 노출. efficiencyBlock 경고가 ranking metric (특히 캐시히트 / 캐시절약액) 에 어떻게 반영되는지 확인 |

---

## Personal 토글 분기

(Anchor 외 — Personal 사용자가 anchor 로 등록되면 추가 검증)

- Personal toggle on → ranking 에 노출, off → 사라짐
- 자기 자신만 본인 이름 노출, 다른 사람에게는 마스킹
- /api/personal/toggle 호출 후 ranking 재진입 시 즉시 반영

---

## 깨졌을 때 1차 진단

| 증상 | 1차 의심 |
|---|---|
| 본인 이름까지 마스킹 | userId === me 비교 회귀 |
| 타인 이름 비마스킹 | RankRow mask 분기 회귀, PII 노출 |
| Personal off 사용자가 보임 | api/ranking 의 personal 필터 회귀 |
| ranking_hidden 사용자가 보임 | api/ranking 의 hidden 필터 회귀 |
| codex 토글 시 hero 가 즉시 빈 상태로 안 변함 | setByMetric({}) 분기 회귀 (page.tsx:153) |
| metric 1-2 개만 노출 | fetch parallel 실패 (1 개 failed 시 그 metric 만 빈 상태) |
| 라벨이 "streak" 그대로 노출 | GRID_METRICS label ("연속 활성일") 회귀 |

---

## 미정 / 후속

- Personal 시나리오 3 (다른 이메일 = 별개 계정) 의 ranking 노출 (state.md 보류)
- ranking 의 by-provider 통합 view (현재 토글) — 향후 양쪽 비교 view 도입 시 행 추가
