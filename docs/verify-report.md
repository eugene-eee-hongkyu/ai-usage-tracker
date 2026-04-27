# Verify Report

scanned: 2026-04-27 18:30 SGT  
mode: verify  
docs_analyzed: 3  
synced_commit: edf230f

---

## 검토 필요 항목

### ① 03_A-2 + 05_B-1 — 데이터 수집 도구 ccusage → codeburn 교체됨

**무슨 문제인가**

두 문서 모두 데이터 수집 도구로 `ccusage`를 명시하고 있다. 실제 코드는 2026-04-26 codeburn migration을 통해 전면 교체됐다. 독자가 "왜 코드에 codeburn이 있는지" 알 수 없다.

**구체적으로 어디가 다른가**

| 항목 | 문서 | 실제 코드 |
|------|------|-----------|
| CLI 데이터 수집 | `ccusage export --json` spawn | `codeburn report --format json --provider claude --period all` ([submit.mjs:65](../cli/src/submit.mjs)) |
| lib/collectors | `collectors/claude-code.ts` 존재 (B-1 §4) | 삭제됨 (dead code 정리) |
| A-2 §1 기술 스택 | "ccusage CLI → child_process spawn" | codeburn |

**왜 생겼나**

B-1 빌드 이후 ccusage JSON 스키마 실사용 결과, codeburn이 더 적합해서 교체(2026-04-26). 두 설계 문서는 B-1 이전에 작성됐고, 이후 수정 없이 유지됨.

**왜 중요한가**

두 문서가 reading-guide의 1·2번 참조 문서인데, 독자가 "기술 스택을 왜 이렇게 선택했지?"를 보러 왔다가 ccusage 설명만 보면 혼란스럽다.

**어떻게 해야 하나**

추천: `reading-guide.md`의 두 문서 "읽어야 할 이유"에 "단, 데이터 수집 도구는 codeburn으로 교체됨 — `docs/runs/2026-04-26-codeburn-migration_run.md` 참조" 주석 추가.

이유: 원본 문서는 의사결정 맥락이 그대로 살아있어야 하므로 수정보다 reading-guide에서 교차 안내가 비침습적.

---

### ② 03_A-2 §4 화면 #5 — 팀 랭킹 구조 전면 재설계됨

**무슨 문제인가**

A-2 §4에서 설계한 팀 랭킹은 "Today's MVP + 최다/최고효율 병렬 + 프로젝트별 리더보드" 3파트 구조다. 실제 `/team` 페이지는 이와 완전히 다른 구조로 재설계됐다.

**구체적으로 어디가 다른가**

| 항목 | A-2 §4 설계 | 실제 코드 ([team/page.tsx:271~506](../web/src/app/team/page.tsx)) |
|------|-------------|------------------------------------------------------------------|
| Today's MVP 카드 | 핵심 섹션 (합성 점수 1명 부각) | 없음 |
| 최다/최고효율 병렬 | 두 카드 동등 크기 | 없음 |
| 프로젝트별 리더보드 | 드롭다운 + 멤버별 정렬 | 없음 |
| By Member 차트 | 없음 (설계 없음) | Area 차트 (멤버별 독립) |
| Efficiency 히트맵 | 없음 (설계 없음) | 5컬럼 등급 테이블 |
| Top Sessions | 없음 (설계 없음) | 비용 상위 15개 |
| Team Activities | 없음 (설계 없음) | 활동별 합산 바 차트 |

**왜 생겼나**

B-1 빌드 후 팀 화면이 여러 이터레이션을 거쳐 재설계됐다. A-2의 "Today's MVP" 구조는 현재 코드에 없고 `generateMvpBlurb`만 `lib/rules/index.ts:18`에 남아 있으나 팀 UI에서는 미사용.

**왜 중요한가**

A-2 §4-b UX 의도("최다 vs 최고효율 동등성 시각화")를 보고 현재 팀 페이지에서 그 의도를 찾으려 하면 찾을 수 없다. 현재 팀 페이지 구조 설명이 아무 문서에도 없다.

**어떻게 해야 하나**

추천: `reading-guide.md`에서 A-2 화면 #5 설명에 "현재 팀 페이지 구조는 B-1 이후 재설계됨 — A-2 §4 화면 #5는 UX 원칙(동등성 시각화)은 유효하나 구체 레이아웃은 다름" 안내 추가.

대안: 팀 페이지 현재 구조를 설명하는 별도 섹션을 `docs/reading-guide.md`에 직접 추가 (문서 추가 없이 가이드 내 인라인 설명).

---

### ③ 03_A-2 §4 화면 #4 + 05_B-1 §5-11 — 5개 최적화 룰·suggestion 시스템 제거됨

**무슨 문제인가**

A-2 화면 #4 디테일과 B-1 §5 빌드 순서 11번에 "5개 최적화 룰 + 신뢰도 라벨 + Done/무시/👍👎 피드백 버튼"이 명시돼 있다. 실제 코드에서 suggestion 시스템은 완전히 제거됐다.

**구체적으로 어디가 다른가**

| 항목 | 문서 | 실제 코드 |
|------|------|-----------|
| lib/rules/index.ts | 5개 룰 (`generateSuggestions`) | `computeEfficiencyScore` + `generateMvpBlurb`만 존재 ([rules/index.ts:1](../web/src/lib/rules/index.ts)) |
| suggestion_feedback 테이블 | DB 스키마에 있음 (B-1 §4) | `schema.ts`에 없음 ([schema.ts:1](../web/src/lib/db/schema.ts)) |
| /api/feedback | 실제 피드백 저장 | stub만: `return NextResponse.json({ ok: true })` ([feedback/route.ts:4](../web/src/app/api/feedback/route.ts)) |
| 화면 #4 디테일 | 5개 룰 + Done/무시 버튼 | codeburn optimize 터미널 링크 카드로 교체 |

**왜 생겼나**

codeburn migration(2026-04-26)에서 "optimize findings 대시보드 표시 제거, codeburn optimize 터미널 링크로 대체"로 결정됨. A-2에서 계획했던 §7-1(신뢰도 라벨 검증 데이터 수집) 전략도 함께 폐기됨.

**왜 중요한가**

A-2 §7-1이 "신뢰도 라벨 검증 의도"를 설명하는 중요 섹션인데, 지금 코드에는 그 기반 자체가 없다. 독자가 "피드백 API가 왜 stub이지?"라고 물을 때 답을 찾을 수 없다.

**어떻게 해야 하나**

추천: `reading-guide.md`에서 A-2 설명에 "§7-1 신뢰도 라벨 검증 시스템은 codeburn migration에서 제거됨. 현재 `/api/feedback`은 stub" 안내 추가.

---

### ④ 05_B-1 §4 — DB 스키마 교체됨

**무슨 문제인가**

B-1 §4 프로젝트 구조에 `sessions`·`daily_agg`·`suggestion_feedback` 3개 테이블이 명시돼 있다. 실제 스키마는 2-table JSONB 구조로 교체됐다.

**구체적으로 어디가 다른가**

| B-1 §4 명시 테이블 | 실제 schema.ts |
|---|---|
| `sessions` | 없음 |
| `daily_agg` (matview) | 없음 |
| `suggestion_feedback` | 없음 |
| — | `users` ([schema.ts:12](../web/src/lib/db/schema.ts)) |
| — | `user_snapshots` (rawJson JSONB) ([schema.ts:24](../web/src/lib/db/schema.ts)) |

**왜 생겼나**

codeburn migration에서 "DB 2-table JSONB 구조"로 전면 교체. `runs/2026-04-26-codeburn-migration_run.md`에 기록돼 있음.

**왜 중요한가**

B-1은 "기술 스택과 구조의 이유"를 보러 가는 문서인데 DB 스키마 섹션이 실제와 완전히 다르다. 다만, codeburn-migration run 문서가 reading-guide의 실행 기록 섹션에 있으므로 교차 참조로 해소 가능.

**어떻게 해야 하나**

추천: `reading-guide.md` B-1 설명에 "단, §4 DB 스키마는 교체됨 — 현재 스키마는 `lib/db/schema.ts` 직접 참조 또는 codeburn-migration run 문서 참조" 안내 추가.

---

## 일치 확인

| 문서 | 확인 내용 |
|------|---------|
| A-2 §2 화면 7개 라우트 | `/login`, `/setup`, `/dashboard`, `/dashboard/detail`, `/team`, `/team/[userId]`, `/setup-status` — 모두 실존함 |
| A-2 §5 화면 #6 멤버 프로필 | heatmap(cost 기반) + streak 수치 모두 구현됨 ([team/[userId]/page.tsx:46-99](../web/src/app/team/%5BuserId%5D/page.tsx)) |
| A-2 §5 화면 #6 공개 범위 | 효율 지표·제안 없음 (본인만 공개 SO2 결정) 코드와 일치 |
| B-1 §2 react-activity-calendar | 멤버 프로필에서 실사용 중 ([team/[userId]/page.tsx:8](../web/src/app/team/%5BuserId%5D/page.tsx)) |
| B-1 §3 리스크 2 Windows hook | state.md 기준 검증 완료됨 |
| B-1 §3 리스크 3 keytar | 현재 CLI에서 정상 사용 중 |
| codeburn-migration DB 결과 | `users` + `user_snapshots` (rawJson JSONB + mirror 5컬럼) schema.ts 완전 일치 |

---

## 검증 불가 (코드 대응 없음)

- `03_A-2_프로세스를_화면으로…` §6 SO1~SO6 결정, §7 운영 관제 원칙, §8 Kill/Go/Hold: 전략·설계 배경 문서. 코드와 직접 비교 대상 없음.
- `05_B-1_로컬에서만들기…` §6 LLM system prompt, §7 플래너 결정, §8 재량 범위, §9 멈춤 트리거, §13 Kill/Go/Hold: 빌드 지침 원칙. 코드와 직접 비교 대상 없음.
- `runs/2026-04-26-codeburn-migration_run.md` 전체: 실행 기록. 코드 결과물(DB 스키마 등)은 "일치 확인"에서 검증됨.

---

## 추가 발견 사항

### `/team/[userId]/dashboard` — A-2·B-1에 없는 어드민 전용 뷰어

B-1 이후 추가된 어드민 기능. ADMIN_EMAIL 환경변수로 지정된 사용자가 임의 팀원의 전체 대시보드를 볼 수 있다 ([team/[userId]/dashboard/page.tsx](../web/src/app/team/%5BuserId%5D/dashboard/page.tsx)). 설계 문서에 언급 없음.

### Google OAuth 추가

A-2·B-1 모두 GitHub OAuth만 명시. 실제는 Google OAuth도 지원됨 ([api/auth/[...nextauth]/route.ts](../web/src/app/api/auth/%5B...nextauth%5D/route.ts)).

### 타임존 선택 + 일일 자동 동기화

두 설계 문서에 없는 기능: 사용자별 타임존 선택 (SGT/KST 등), launchd/Windows Task Scheduler 자동 등록. 코드에 구현됨.

### 5h utilization 지표 제거

A-2 §4 화면 #3 효율 지표에 명시됐으나 "안 한다"로 확정 후 제거됨. 현재 대시보드는 6개 지표 (cache hit / 1-shot / $/session / calls/session / $/call / out/in).
