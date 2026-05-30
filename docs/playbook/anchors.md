# Anchors — prod 회귀 검증 anchor 계정

> playbook 의 anchor 는 "특정 케이스를 대표하는 prod 실 계정" 이다. 각 anchor 가 깨지면 (= 그 계정의 화면 노출이 기대와 다르면) 그 케이스가 회귀했다는 신호.

## 갱신 규칙

- Anchor 가 계정 이사 / 사용 중단 / 핵심 케이스 상실 시 즉시 갱신.
- 보류 항목이 anchor 케이스인 경우 보류 풀릴 때까지 anchor 유지.
- 새 케이스 (새 provider, 새 권한 분기) 발생 시 anchor 추가 검토.

---

## Anchor 1 — 본인 (platform admin)

- **이메일**: eugene.eee@iskra.world
- **권한**: platform admin (ADMIN_EMAIL 화이트리스트)
- **팀**: iskra

### 왜 anchor 인가

- platform admin 전용 화면 (/platform-admin/all-users, /platform-admin/all-teams, /platform-admin/audit) 노출 검증의 유일한 경로.
- view-as 의 entry point. 다른 모든 anchor 시점 진입을 본인 계정으로 한다.
- 5 metric ranking 의 "본인 마스킹 안 됨" 분기 검증.

### 대표 케이스

- Platform admin 권한 진입
- view-as 진입 / 종료 흐름
- ranking 에서 본인 이름 노출 (타인은 마스킹)
- /admin 의 마지막 선택 탭 자동 복귀 (commit da29b05)
- provider preference 화면 간 공유 (useProviderPreference, commit fb3f595)

### 검증 대상 화면

- /dashboard
- /team, /admin/team, /admin/team/ranking
- /ranking
- /admin/users, /admin/members
- /platform-admin/all-users, /platform-admin/all-teams, /platform-admin/all-personal, /platform-admin/audit, /platform-admin/settings
- /setup-status

### 깨졌을 때 신호

- ADMIN_EMAIL 환경변수 변경 / 본인 이메일 변경 시 platform admin 진입 자체 불가 → 즉시 감지.

---

## Anchor 2 — 영진님 (Youngjin Kim)

- **user_id**: 4
- **이메일**: youngjin.kim@z21labs.xyz
- **도메인**: z21labs.xyz (가입 이메일) + iskra.world (팀 매핑)
- **팀**: iskra
- **plan_tier**: max5 (Claude) / codex_plan_tier: null (사용자 입력 대기 — Codex modal 자동 trigger 대상)
- **device 수**: 2 (Mac + Windows — 2026-05-30 확인)
- **provider 데이터**: claude + codex 양쪽 보유

### 왜 anchor 인가

두 가지 까다로운 케이스를 동시에 대표:

1. **Dual domain 케이스** — iskra 회사가 z21labs.xyz 와 iskra.world 두 도메인을 함께 사용. z21labs.xyz 가입자가 iskra 팀에 보여야 정상. auto-join 매핑 회귀의 1차 신호. (memory: project_team_dual_accounts)
2. **Multi-device 분리 (M6f)** — Mac + Windows 두 device 에서 동시 사용. user_snapshots.token_id 분기, dashboard device 별 line 분리 검증.

### 대표 케이스

- z21labs.xyz 이메일 → iskra 팀 멤버 표시 (auto-join 정확성)
- /dashboard 에서 device 2 개 분리 노출 (Mac + Windows)
- /admin/users (본인 시점) 의 iskra 멤버 list 에 영진님 노출
- ingest 수신 정상 (양 device 에서)

### 검증 대상 화면 (본인 view-as)

- /dashboard (provider claude / codex 양쪽)
- /admin/users
- /team

### 깨졌을 때 신호

- iskra 도메인 auto-join 룰 변경 → z21labs.xyz 매핑 끊김
- M6f token_id 로직 회귀 → device 분리 사라지고 합쳐서 표시
- 영진님 계정 suspend / delete / 팀 이전 → anchor 자체 무효, 갱신 필요

### 본인 검증 가능 여부

- ✓ /dashboard, /admin/users, /team — 본인이 platform admin view-as 로 가능
- ✗ /setup-status (영진님 본인 device 관리 화면) — 영진님 본인만. 필요 시 본인에게 요청.

---

## Anchor 3 — oreo (Codex efficiency 경고 케이스)

- **user_id**: 2
- **이메일**: jinwoo.park@z21labs.xyz
- **팀**: iskra (z21labs.xyz 도메인 → iskra 매핑, dual-domain 케이스)
- **plan_tier**: max20 (Claude) / codex_plan_tier: null (사용자 입력 대기 — Codex modal 자동 trigger 대상)
- **device 수**: 1
- **provider 데이터**: claude + codex 양쪽 보유 (Codex 가 anchor 의 본 케이스)
- **상태**: state.md 의 보류 항목 — "oreo Codex efficiency 합계 경고 원인 정밀 진단 (선택)"

### 왜 anchor 인가

- 보류 항목 자체가 "특정 사용자의 특정 화면 노출이 기대와 다른" 케이스.
- 진단 풀리기 전까지 oreo 의 /dashboard (Codex 토글) 노출은 "현재 알려진 경고 상태" 가 baseline.
- 보류 해제 후에는 "정상 상태" 가 새 baseline 이 되며, anchor 로 유지하여 재발 방지.

### 대표 케이스

- Codex efficiency 카드 의 합계 경고 노출 (현재 baseline)
- Codex provider 전용 metric (Phase 3a, commit 9cd7a4c / 8cf6dea / af07e7f) 정확성
- Codex plan tier 분리 카드 (codex_plan_tier 컬럼, commit ce1b364) 노출

### 검증 대상 화면 (본인 view-as)

- /dashboard provider=codex

### 깨졌을 때 신호

- 경고 사라짐 → 진단 풀린 건지, 정상 회귀인지 / 데이터 변동인지 확인 필요. 보류 항목 상태 재평가.
- Codex 카드 자체 사라짐 → Phase 3a 회귀 가능성.

### 갱신 트리거

- state.md 의 "oreo Codex efficiency 합계 경고" 보류 항목 해제 시 anchor 의 baseline 갱신.

---

## 후속 anchor 후보 (현재 미포함, 추후 확장)

state.md / memory 에서 보이는 케이스들. 필요 시 anchor 로 승격:

| 후보 | 케이스 | 추가 시점 |
|---|---|---|
| kj | thenexa.io 도메인 auto-join 검증 | kj 재로그인 + auto-join 확정 후 |
| 외부 회사 첫 사용자 1-2명 | invitation 수락 + 첫 ingest + ranking 마스킹 | 외부 회사 정식 도입 시 |
| Personal 모드 사용자 1명 | personal toggle, 다른 이메일 분기 | Personal Phase 6+ 안정 후 |
| Suspend / delete 처리 사용자 | 화면 사라짐 확인 | 처리 케이스 발생 시 |
