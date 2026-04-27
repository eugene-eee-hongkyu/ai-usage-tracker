---
last_updated: 2026-04-27
last_synced_commit: edf230f
last_verified: 2026-04-27
---

# 프로젝트 이해를 위한 문서 안내

> 오랜만에 돌아왔을 때 "왜 이렇게 됐지?" / "어떤 결정이 있었지?"를 빠르게 파악하기 위한 독서 순서 가이드.

---

## 읽기 순서 (추천)

```
1. docs/03_A-2_프로세스를_화면으로_사용량대시보드_직행.md   ← 화면 UX 의도 + 설계 결정 전체
2. docs/05_B-1_로컬에서만들기_사용량대시보드_압축.md        ← 기술 스택 선택 근거 + 리스크 조사
3. docs/runs/2026-04-26-codeburn-migration_run.md           ← ccusage→codeburn 전환 경위 (선택)
```

---

## 1. 설계 의도 · 결정 근거

### [03 A-2 — 화면 설계 직행](./03_A-2_프로세스를_화면으로_사용량대시보드_직행.md)

**읽어야 할 이유**: 현재 구현된 화면 7개의 UX 의도가 여기에 있다. "backfill을 init 종료 조건에서 왜 분리했는지" 같이 코드만 봐서는 알 수 없는 결정의 근거가 §4·§5·§6에 집중돼 있다. 팀 페이지 UX 원칙(§4 화면 #5)은 현재 구조와 달라졌으나, "동등성 시각화" 의도는 여전히 유효하다. §7 운영 관제 노트(backfill 첫인상 완화책)는 setup polling 구조의 이유를 설명한다.

> ⚠ **어긋남**: 데이터 수집 도구(`ccusage`)·DB 스키마(`sessions`/`daily_agg`)·팀 랭킹 레이아웃(화면 #5)·5개 최적화 룰(화면 #4)은 현재 코드와 다릅니다. 현재 상태: [codeburn-migration_run.md](./runs/2026-04-26-codeburn-migration_run.md)

### [05 B-1 — 로컬 빌드 지침서](./05_B-1_로컬에서만들기_사용량대시보드_압축.md)

**읽어야 할 이유**: 기술 선택의 이유가 스택 테이블에 한 줄씩 명시돼 있다. 특히 "외부 CLI를 라이브러리가 아닌 child_process spawn으로 쓴 이유", "버전 pin 없이 매번 최신을 받는 의식적 결정"(도구가 codeburn으로 교체됐어도 이 원칙은 그대로 적용됨), "Auth.js 버전을 빌드 시점 npm view로 자동 선택한 근거"처럼 지금 코드 구조를 그렇게 짠 이유가 §2·§3에 있다. §8·§9 재량 범위·멈춤 트리거는 빌드 시 AI에게 준 제약이어서, 현재 코드에 특이한 점이 있다면 여기서 이유를 찾을 수 있다.

> ⚠ **어긋남**: §4 DB 스키마(`sessions`/`daily_agg`/`suggestion_feedback`)와 `lib/collectors/claude-code.ts`(삭제됨), suggestion 시스템(제거됨)은 현재 코드와 다릅니다. 현재 DB: [web/src/lib/db/schema.ts](../web/src/lib/db/schema.ts)

---

## 2. 실행 기록

> "무슨 이유로 구조를 바꿨고, 그때 어떤 이슈가 있었는가"가 필요할 때 참조.

| 파일 | 시점 | 핵심 교훈 |
|------|------|---------|
| [runs/2026-04-26-codeburn-migration_run.md](./runs/2026-04-26-codeburn-migration_run.md) | 2026-04-26 | ccusage→codeburn 전환. 실제 JSON 스키마가 예상과 달라 필드 리매핑 필요. multi-period sync 충돌·npx 구버전 캐시 이슈 발생 및 해결. |

---

## 문서에 없는 현재 기능

아래 기능은 A-2·B-1 설계 이후 추가됐으며 관련 설계 문서 없음.

| 기능 | 코드 위치 |
|------|---------|
| 어드민 팀원 대시보드 뷰어 | `web/src/app/team/[userId]/dashboard/` |
| Google OAuth | `web/src/app/api/auth/[...nextauth]/route.ts` |
| 사용자별 타임존 선택 | `web/src/app/api/user/timezone/route.ts` |
| 일일 자동 동기화 (launchd/Task Scheduler) | `cli/src/init.mjs` |

---

## 이 가이드에서 제외한 문서

| 파일 | 제외 이유 |
|------|---------|
| `docs/favicon/README.md` | Next.js favicon 적용 절차서(how-to). 이미 `web/public/`에 적용 완료. 결정 맥락 없음. |
