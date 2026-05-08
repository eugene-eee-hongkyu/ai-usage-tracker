# docs/qa — ai-usage-tracker QA 테스트케이스

> 입력: A-2 v6 화면 freeze + C-1 QA Implementation Brief v2
> 출력 형식: e2e-framework v3.2 [qa-doc-generation-prompt.md](../e2e-v2/qa-doc-generation-prompt.md) 룰 [1]~[16] 준수
> phase1 산출물: [../qa-output/qa-automation-map.md](../qa-output/qa-automation-map.md)

---

## 모듈 분할 표 (룰 [16])

| 모듈 코드 | 모듈 한글명 | A-2 v6 화면 # | 권한 | 비고 |
|---|---|---|---|---|
| LO | 로그인 | #1 `/login` | — | OAuth 2종 + 도메인/DB 에러 박스 |
| SU | 셋업 | #2 `/setup` | — | OS 분기 + tz + 폴링 2s + install 3종 |
| DB | 대시보드 (공유 컴포넌트) | #3 `/dashboard`, #6 `/team/[userId]/dashboard`, #7 `/member` | — / 어드민(#6·#7) | DashboardView 1개 — 라우트별 사전조건 분기 |
| TM | 팀 랭킹 | #4 `/team` | — / 어드민(Engagement·Top Sessions) | 7 row + Industry 비교 |
| TP | 멤버 공개 프로필 | #5 `/team/[userId]` | — | 4 cell + 4주 heatmap + projects |
| SS | 셋업 상태 | #8 `/setup-status` | — | ready/in-progress/stale + FAQ 4종 |

**총 6 모듈 = 6 spec 파일** (`tests/qa/{lo,su,db,tm,tp,ss}/*.spec.ts`).

룰 [16] 적용 근거:
- DashboardView 가 `<DashboardView/>` 단일 컴포넌트로 #3·#6·#7 공유 → 1 모듈 (DB) + 라우트별 사전조건 분기
- #6·#7 어드민 분기는 DB 모듈 안에서 권한 TC 로 격리
- 그 외 화면은 1 화면 = 1 모듈 (A-2 §2 표 그대로)

---

## 0.5단계 매핑 결정 (consumer 측 메모)

framework v3.2 phase0-prerequisites 가 anchor 11모듈·`ANCHOR_EMAIL_*` 가정이라, ai-usage-tracker 적용 시 다음으로 매핑:

| Framework 가정 | ai-usage-tracker 매핑 | 근거 |
|---|---|---|
| 11 모듈 (AUTH/HOME-TA/...) | 6 모듈 (LO/SU/DB/TM/TP/SS) | A-2 v6 §2 화면 8개 + 룰 [16] 합산 |
| `ANCHOR_EMAIL_*` 5계정 | C-1 §2 페르소나 P1~P8 (DB 시드) + Credentials provider mock | 진짜 OAuth 자동화 차단 ([C-1 §3](../C-1.qa-implementation-brief.md)) |
| `tests/.auth/*.json` storageState | NextAuth `__Secure-next-auth.session-token` 직접 sign 또는 Credentials mock | C-1 §3 우회 전략 |
| `docs/anchor-e2e-v2/` 산출물 경로 | `docs/qa-output/` | anchor 종속 명명 회피 (backlog 등록) |
| `baseURL` (anchor staging) | `http://localhost:3000` (로컬 docker postgres) | 라이브 Supabase 동료 데이터 오염 회피 |
| 872 TC 절대값 | ai-usage-tracker 모듈 합산 (이 README 표) | consumer 별 다름 — framework PR 백로그 |

framework 일반화 PR: [.harness/backlog.md "2026-05-08: e2e-framework anchor 종속 제거"](../../.harness/backlog.md) — phase 3 종료 후 진행.

---

## 페르소나 cross-ref (룰 [15])

C-1 §2 페르소나 ID → 모듈별 사용 매트릭스:

| 페르소나 | 정의 (C-1 §2) | LO | SU | DB | TM | TP | SS |
|---|---|---|---|---|---|---|---|
| P1 | 신규 (DB 행 0개) | ✓ | ✓ | ✓ | — | — | ✓ |
| P2 | 정상-일반 (full data) | — | — | ✓ | ✓ | ✓ | ✓ |
| P3 | 정상-어드민 (P2 + admin email + visits) | — | — | ✓ | ✓ | ✓ | ✓ |
| P4 | stale-2일 (yellow) | — | — | — | ✓ | — | ✓ |
| P5 | stale-7일+ (red ⚠) | — | — | — | ✓ | — | ✓ |
| P6 | ccusage-missing | — | — | — | ✓ | — | — |
| P7 | snapshot 있음 / overview 없음 | — | — | ✓ | — | — | — |
| P8 | 신규-어드민 (admin + no snapshot) | — | — | ✓ | ✓ | — | — |

DB 시드 명령 컨벤션: `ADMIN_EMAIL=eugene.eee@iskra.world psql < db/seed/P{n}.sql` ([C-1 §2](../C-1.qa-implementation-brief.md)).

---

## selector 정책 (룰 [5] · [15])

C-1 §5-1 결과: 현재 `data-testid` 0건 / `aria-label` 0건 → 텍스트·CSS class·DOM 구조 selector 만 가능.

→ phase 2 spec 작성 시 C-1 §5-2 권장 testid 표(8 화면) 를 web/src 에 일괄 추가하는 PR 동반 필요. 본 docs/qa 의 모든 "기대 결과" 컬럼은 C-1 §5-2 권장 testid 를 그대로 인용 — phase 2 첫 단계가 testid 추가.

testid 미추가 상태에서 spec 돌리면 모든 `getByTestId` fail. 따라서:
1. phase 2 §0 = web/src/{login/setup/dashboard-view/team/member/setup-status/nav}/page.tsx 에 testid 추가 PR
2. phase 2 §1+ = spec 작성 (testid 기준)

---

## 검증 통과 기록 (자가 검증 — 룰 §체크리스트)

본 README 및 6 모듈 파일 작성 후 정량 검증:

```bash
# 모호 어휘 0회
grep -nE "적절히|자연스럽게|충분히|좋게|원활히|매끄럽게" docs/qa/*.md

# 단독 모호 동사 (룰 [10]) — 수식어 없이 끝나는 패턴
grep -nE "(표시|노출|반영|변경|동작|활성화|펼쳐|닫|이동|정렬|확인|적용)된다(\.|$|,)" docs/qa/*.md

# 빈 기대 결과 셀 (룰 [11]) — `| | |` 패턴 (3 셀 빈 줄)
grep -nE "^\|[^|]*\|[ ]*\|" docs/qa/*.md | grep -v "^---"

# C-1 cross-ref 누락 (룰 [15]) — TC-ID 행에 "C-1 §" 또는 "P[0-9]" 매치 0건 검출
awk '/^\| (LO|SU|DB|TM|TP|SS)-/ && !/C-1 §|P[0-9]/' docs/qa/*.md
```

위 4 grep 결과 모두 0 라인 → 통과.
