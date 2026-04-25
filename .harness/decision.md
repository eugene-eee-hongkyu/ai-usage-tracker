# decision.md — 의사결정 기록

> 대안 비교와 선택 이유가 있는 경우만 기록한다.

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
