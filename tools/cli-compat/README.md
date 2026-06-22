# cli-compat-check — ccusage / codeburn 호환성 자동 검사

ccusage / codeburn 의 npm latest 가 우리 핀(`web/src/lib/pinned-versions.ts`)과 달라지면,
**격리된 환경에서 핀 버전과 최신 버전을 실제로 실행**해 우리가 읽는 명령·필드가 구조적으로
유지되는지 실측 대조하고, 변경 시 **버전당 1회만** `info@z21labs.xyz` 로 이메일을 보낸다.

## 왜 "실측"인가

ccusage 20.x 는 **컴파일된 네이티브 바이너리**라 소스로 출력 스키마를 유추할 수 없다.
릴리즈 노트(산문)만 보면 `date→period` 같은 회귀를 놓칠 수 있다(false negative = 조용한
데이터 깨짐). 그래서 **실제 실행 출력의 키/타입**을 ground truth 로 삼는다. 추론 0.

릴리즈 노트는 "구조는 같지만 값이 달라질 수 있는 변경"(가격·세션 포함범위 등) 힌트로만 쓴다.

## 입력은 합성 fixture (실사용 이력 불필요)

`fixtures/claude-home`(`~/.claude`) · `fixtures/codex-home`(`~/.codex`) 에 **합성 세션 데이터**를
두고, 실행 시 `HOME` 을 그쪽으로 덮어 도구가 우리 fixture 를 읽게 한다. 실제 사용 이력이
없는 깨끗한 CI 러너에서도 동일하게 동작한다.

## 구성

| 파일 | 역할 |
|---|---|
| `manifest.mjs` | 우리가 소비하는 명령·필드 계약 (run-ingest.ts / ccusage-row.ts 기반) |
| `fixtures/` | 합성 Claude / Codex 세션 데이터 |
| `verify.mjs` | 핀 vs 최신 격리 설치 → fixture 실행 → 구조 대조 (안전 게이트) |
| `release-notes.mjs` | from→to GitHub 릴리즈 노트를 값/구조/무관 버킷으로 분류 |
| `email.mjs` | verify + 노트 → HTML + plaintext 이메일 조립 |
| `run.mjs` | 오케스트레이터 (GitHub Actions 진입점): verify → dedup → 노트 → 이메일 → 발송 → 기록 |
| `preview.mjs` | 발송 없이 이메일 미리보기 |

## 로컬 실행

```bash
node tools/cli-compat/verify.mjs ccusage          # 구조 검사만
node tools/cli-compat/preview.mjs ccusage          # 이메일 미리보기(발송 X)
DRY_RUN=1 node tools/cli-compat/run.mjs            # 전체 흐름(발송·기록 X)
# 버전 강제: FROM_OVERRIDE / TO_OVERRIDE
```

## GitHub Actions

`.github/workflows/cli-compat-check.yml` 가 매일 09:00 UTC 실행.
필요한 레포 Secret (Settings → Secrets and variables → Actions):

| Secret | 용도 | 없으면 |
|---|---|---|
| `RESEND_API_KEY` | 이메일 발송 | 발송 skip |
| `DATABASE_URL` | dedup (앱과 동일한 postgres 연결 문자열 재사용) | dedup 비활성(중복 발송 가능) |
| `EMAIL_FROM` | 발신 주소 (선택) | 기본 `noreply@aiusage.z21labs.world` |
| `COMPAT_REPORT_TO_EMAIL` | 수신 주소 (선택) | 기본 `info@z21labs.xyz` |

`GITHUB_TOKEN` 은 Actions 가 자동 주입(릴리즈 노트 rate-limit 회피).
dedup 은 `DATABASE_URL` 로 postgres 직결해 `cli_compat_notifications` 테이블에 접근한다 (`pg` 사용, 워크플로가 `npm install --prefix tools/cli-compat` 로 설치).

dedup 은 기존 `cli_compat_notifications` 테이블 `(pkg, from_version, to_version)` 을 재사용한다.
