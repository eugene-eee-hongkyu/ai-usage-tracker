# decision.md — 의사결정 기록

> 대안 비교와 선택 이유가 있는 경우만 기록한다.

---

## 2026-04-26: 최고 효율 지표 — cache hit% × 100 / 세션당 비용 채택

- **선택**: `efficiencyScore = (cacheRead / (cacheRead + cacheWrite)) × 100 × 100 / (totalCost / sessionsCount)`
- **대안 검토**:
  - oneShotRate (기존): `submit.mjs`에서 oneShotEdits/totalEdits 하드코딩 0 → 항상 0, 의미 없음
  - 토큰 대비 비용 (cost/tokens): 모델 선택(Sonnet vs Haiku)만으로 1등 결정 가능 — 실력 아님
  - 세션당 비용 단독: 짧은 세션만 자주 여는 사람이 유리 — 단일 지표 편향
  - cache hit 단독: 10명 모두 95% 근처라 변별력 없음
  - 합성 점수 (선택): cache hit(질) × 1/세션당 비용(효율) — 두 요소 동시 반영
- **선택 이유**: 사내 10명 규모에서 활동량 보정(log) 불필요. 수식이 직관적이고 "캐시 잘 쓰면서 + 작업당 싸게"라는 의도에 정합.
- **영향 범위**: `lib/rules/index.ts`, `api/team/route.ts`, `team/page.tsx`
- **되돌리는 방법**: `computeEfficiencyScore` → `computeTodayMvpScore(tokens, oneShotRate)`로 복원, `byEfficiency` 정렬 기준을 `oneShotRate`로 복원

---

## 2026-04-25: CLI npx 배포 방식 — bun 번들 채택

- **선택**: `bun build`로 JS 의존성 인라인 번들 → `cli/bin/cli.mjs` 커밋, root `package.json` bin 참조
- **대안 검토**:
  - root `package.json`에 모든 deps 추가: workspace 구조 유지하면서 가능하지만, keytar(native) 포함 시 node-gyp 빌드 실패 위험
  - CLI TypeScript 직접 참조 + tsx 실행: 사용자 머신에 tsx 설치 필요, 신뢰성 낮음
  - 번들(선택): 순수 JS 의존성 인라인, keytar만 optional external — npx 설치 시 의존성 문제 없음
- **선택 이유**: `commander` 등 순수 JS 패키지는 번들로 인라인하면 npm 의존성 해결 불필요. keytar는 동적 import + try/catch fallback이라 설치 실패해도 파일 저장으로 대체됨.
- **영향 범위**: `cli/bin/cli.mjs` (빌드 산출물, 커밋 대상), root `package.json`, `.gitignore`
- **되돌리는 방법**: root `package.json`에 `commander`, `keytar`, `open` dependencies 추가 후 bin을 `cli/src/index.mjs`로 변경
