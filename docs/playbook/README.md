# Playbook — prod 계정 기반 회귀 검증

> ai-usage 는 모니터링 사이트라 검증 본질이 "특정 계정의 특정 화면이 어떻게 보여야 맞는가" 다. dev 환경 / synthetic seed 로는 prod 의 실제 데이터 분포 (영진님 dual-domain, oreo Codex 경고, 외부 회사 첫 가입 케이스) 가 재현되지 않으므로, **prod 의 실 계정을 anchor 로 삼아 release 마다 회귀 체크** 한다.

## 무엇이 아닌가

- 데이터 격리·권한 같은 로직 회귀 검증은 기존 `docs/e2e-v2/` (e2e framework v3.2 카피본) 이 담당한다. playbook 은 거기 손대지 않는다.
- 정확값 (토큰 합계 12,345 같은) 을 assert 하지 않는다. prod 데이터는 매일 변하므로 **상대 assertion** 만 한다.
- 자동 visual diff 도 기본은 off. 카드 재배치 같이 의도된 시각 변경이 있을 때만 켠다.

## 3 layer 구조

| Layer | 형태 | 무엇을 검증 | 누가·언제 |
|---|---|---|---|
| 1 | 명세 markdown (이 디렉토리) | 어떤 계정의 어떤 화면이 어떻게 보여야 하는가 | release 마다 사람이 runbook 따라 체크 |
| 2 | Playwright smoke (선택, 후속) | 화면 진입 + 분기·존재 (provider toggle 노출, 카드 노출) | release 직전 자동 |
| 3 | 시각 회귀 (필요 시 한정) | 화면 스크린샷 diff | 카드 이동·재배치 시점에만 |

Layer 1 이 본체다. 2/3 은 1 이 가리키는 항목 중 자동화 가치 있는 것만 골라 옮긴다.

## 디렉토리

```
docs/playbook/
├── README.md          ← 이 파일 (사용법, 정책)
├── anchors.md         ← Anchor 계정 list + 왜 이 계정인지 + 깨졌을 때 감지
├── runbook.md         ← release 전 체크리스트 (10-15 분 안에 끝나도록 압축)
└── screens/
    ├── dashboard.md   ← Anchor x 화면 매트릭스 (provider 별 분기 포함)
    ├── team.md        ← (예정)
    ├── ranking.md     ← (예정)
    ├── admin.md       ← (예정)
    └── platform-admin.md ← (예정)
```

## 갱신 정책

- **release 마다 runbook 한 번 훑기**. 깨진 항목 발견 시 그 화면 md 갱신.
- **Anchor 깨짐 (계정 이사, 사용 중단, 케이스 변동)** 알면 즉시 `anchors.md` 갱신 + 영향 받는 screens md 같이 손봄.
- **새 화면 / 새 provider / 새 카드 추가** 시 해당 screens md 매트릭스 행 / 열 추가. PR 머지 전에.
- **보류 항목이 anchor 의 케이스** 인 경우 (예: oreo Codex efficiency 경고) anchors.md 에 명시. 보류 풀릴 때까지 anchor 역할 유지.

## 사용 흐름

1. release 직전 `runbook.md` 열고 위에서 아래로 순서대로 체크.
2. 본인 (platform admin) 으로 로그인 → view-as 로 anchor 계정 시점 진입 → 해당 screens md 매트릭스 행 비교.
3. 불일치 시:
   - 의도된 변경 → screens md 갱신 후 ✓
   - 의도 안 한 변경 → 버그. release 보류, 해당 run 에 기록.
4. 끝나면 runbook 의 그 release 칸에 날짜·체크 결과 1줄 남김.

## 한계

- 본인이 platform admin 이라 view-as 가 가능하므로 본인 계정 1개로 모든 anchor 시점을 본다. 본인이 손 못 대는 anchor 화면 (예: 영진님 본인만 보이는 setup-status) 은 anchor 본인에게 의뢰하거나 검증 제외 명시.
- prod 에 mutate 액션 (suspend, delete, invitation 발송) 은 playbook 에서 실행하지 않는다. 분기 존재만 확인.
