---
last_updated: 2026-05-21
file: web/public/install.sh
serves: https://aiusage.z21labs.world/install.sh
audience: AI 에이전트 + 유지보수 개발자
---

# install.sh 분기 구조

> `curl -fsSL https://aiusage.z21labs.world/install.sh | bash` 한 줄로 깔리는 macOS/Linux 인스톨러.
> 모든 분기·결정·환경 변수의 단일 출처. 코드 수정 시 이 문서도 같이 갱신.

## 한눈에

```
┌──────────────────────────────────────────────────────────────────┐
│  Pass 1   권한 점검 (ownership preflight)                        │
│  ├─ 정상  → 계속                                                 │
│  └─ 비정상→ chown 명령 출력 + exit 1                              │
│                                                                  │
│  Pass 1.5 다른 Node 매니저 (asdf/volta/fnm) 감지                  │
│  ├─ 없음  → 계속                                                 │
│  └─ 있음  → SKIP_NVM=1 셋 + 매니저별 안내 출력 (계속 진행)        │
│                                                                  │
│  Pass 2   .pkg Node 감지 + nvm 전환 prompt (macOS only)           │
│  ├─ 해당 없음 → 계속                                              │
│  ├─ Y 응답 → ~/.zshrc 등 백업 + nvm 설치 + Node 22 전환           │
│  └─ N 응답 → .pkg Node 그대로 진행                                │
│                                                                  │
│  Pass 3   Node 버전 가드 (NODE_MAJOR < 22 또는 없음)              │
│  ├─ Node 22+ 이미 있음 → ✓ 출력 후 계속                           │
│  ├─ SKIP_NVM=1 이면서 부족 → exit 1                               │
│  └─ 부족 → nvm 설치 + Node 22 자동 설치                            │
│                                                                  │
│  Final    설치 실행                                              │
│  ├─ migrate (silent, 옛 primus 경로 → z21labs 마이그)              │
│  └─ 기존 key 있음? ─ Y → repair / N → init                        │
└──────────────────────────────────────────────────────────────────┘
```

## Pass 1 — 권한 점검 (Ownership Preflight)

**위치**: install.sh 44~101행. `check_owner()` 함수.

**검사 경로**:

| 경로 | 종류 | 의미 |
|---|---|---|
| `~/.npm` | dir | npm 캐시 (root 소유면 npm install 깨짐) |
| `~/.z21labs` | dir | 데이터 root |
| `~/.z21labs/usage-tracker` | dir | submit.mjs / historical.mjs / 백업 |
| `~/.z21labs/usage-key` | file | API 키 (keytar 실패 시 fallback) |
| `~/.primus-usage-tracker` | dir | **legacy** — 옛 잔존 사용자 |
| `~/.primus-usage-key` | file | **legacy** |
| `~/Library/LaunchAgents/world.z21labs.ai-usage-tracker.sync.plist` | file | mac LaunchAgent (z21labs) |
| `~/Library/LaunchAgents/com.primus.usage-tracker.daily.plist` | file | mac LaunchAgent (**legacy**) |

**조건**: 위 경로 중 하나라도 owner uid 가 현재 사용자 uid 와 다르면 (보통 root).

**동작**: `sudo chown` 명령을 모아서 한 번에 출력 → `exit 1`.

**왜**: piecewise discovery 회피. "고치고 다시 깨지는" 패턴 차단. 옛 sudo install / root-깔린 nvm / brew 충돌 등 한 번에 정리.

**디자인 결정**: 절대 `sudo chown` 을 install.sh 가 직접 실행하지 않음 — 사용자가 명시적으로 복사·붙여넣기. install.sh 자체는 sudo 없이 동작.

## Pass 1.5 — 다른 Node 매니저 감지

**위치**: install.sh 103~145행.

**검사 순서** (먼저 발견된 것만):

1. `command -v asdf`
2. `command -v volta`
3. `command -v fnm` OR `$FNM_DIR` 셋 (fnm 은 shell init 안 됐어도 디렉토리는 있을 수 있음)

**조건**: 하나라도 발견.

**동작**:
- `SKIP_NVM=1` 셋 (Pass 2·3 분기 변경)
- 안내 박스 출력 (매니저별 Node 22 설치 명령 + 재실행 안내)
- **중단하지 않음** — 그대로 계속 진행 (Node 22+ 가 이미 깔려 있을 수도 있음)

**왜**: 다른 매니저 위에 nvm 추가 설치하면 PATH 우선순위 꼬임 + 둘 다 default Node 주장.

## Pass 2 — .pkg Node 감지 + nvm 전환 prompt

**위치**: install.sh 147~206행. **macOS only.**

**조건 (모두 만족)**:
- `SKIP_NVM` 없음 (Pass 1.5 통과)
- `command -v node` 있음
- `uname == Darwin`
- `NODE_PATH == /usr/local/bin/node`
- `readlink` 결과가 `.nvm` 경로 아님 (nvm 이 symlink 만든 경우 제외)

**동작**:
1. .pkg Node 설명 + 전환 효과 + 롤백 방법 출력
2. `prompt_yn` 으로 Y/n 입력 (default Y)
3. **Y 응답**:
   - `~/.zshrc`, `~/.bash_profile`, `~/.bashrc` 를 `~/.z21labs/usage-tracker/<rc>.bak-<ts>` 로 백업
   - `npm list -g --depth=0` 을 `old-node-globals.txt` 로 저장 (글로벌 패키지 복구 참고용)
   - nvm 설치 (`v0.40.1`) + Node 22 install/use/alias default
4. **N 응답**: .pkg Node 그대로 진행 (메시지만 출력)

**왜**: `/usr/local/bin/node` 의 .pkg 인스톨러 Node 는 npm global / 캐시가 root 소유로 자주 망가짐 → 권한 사고 반복. nvm 으로 전환하면 모든 npm 작업이 `~/.nvm` 안에서만 일어나 sudo 의존 0.

**알려진 quirk**: **Node<22 + .pkg** 인 경우 Pass 2 에서 N 을 눌러도 Pass 3 가 NEEDS_NVM=1 로 어차피 nvm 자동 설치함. 즉 N 선택의 의미는 "Node 22+ 가 이미 .pkg 로 깔린 경우" 에만 유효. UX 버그 후보 — 현재는 의도된 동작 (Node 22+ 필수라서).

## Pass 3 — Node 버전 가드

**위치**: install.sh 208~244행.

**핀 정책 (왜 22 필수)**:
- `codeburn@0.9.7` — ink 7 → `engines.node >=22`
- `ccusage@19.0.2` — `engines.node >=22`

**조건 산출**:
```bash
NEEDS_NVM=1  if  node 명령 없음
             |   node -v 파싱 실패
             |   메이저 < 22
```

**분기**:

| NEEDS_NVM | SKIP_NVM | 동작 |
|---|---|---|
| 0 | (무관) | `✓ Node $(node -v)` 출력 후 통과 |
| 1 | 1 | `❌ Node 부족` 에러 + `$OTHER_MGR` 로 설치 안내 + `exit 1` |
| 1 | 0 (node 있음) | "Node X → Node 22 전환 중..." → nvm 설치/활성/Node 22 |
| 1 | 0 (node 없음) | "Node.js 설치 중..." → nvm 설치/활성/Node 22 |

**왜 명시 22 가드**: 옛 흐름은 "node 있으면 통과" 였는데, 그러면 init 의 `preflightNodeVersion()` 이 거부 → install.sh 가 init 또 호출 → 무한 루프. 명시 가드로 차단.

## Final — 설치 실행

**위치**: install.sh 246~262행.

```
npx --yes --ignore-cache $REPO migrate   # silent, 실패해도 || true
                                          # → 새 사용자 noop
                                          # → 옛 primus 사용자만 출력

if [ -f ~/.z21labs/usage-key ] || [ -f ~/.primus-usage-key ]; then
  AIUSAGE_FROM_INSTALL_SH=1 npx ... repair
else
  AIUSAGE_FROM_INSTALL_SH=1 npx ... init
fi
```

- `migrate`: `cli/src/migrate.ts` — keytar / data dir / API key file / LaunchAgent plist 의 primus → z21labs 리네임. 새 사용자엔 모든 단계 noop.
- `repair`: 기존 설치 갱신 (`cli/src/index.ts` 의 `repair` 명령). 키 파일 존재가 트리거.
- `init`: 신규 설치 (`cli/src/init.ts`). 브라우저 OAuth → API 키 발급 → keytar 저장 → submit.mjs 배치 → LaunchAgent 등록.

## 환경/전달 변수

| 변수 | 어디서 셋 | 어디서 사용 | 의미 |
|---|---|---|---|
| `SKIP_NVM` | Pass 1.5 | Pass 2·3 | 다른 Node 매니저 감지 → nvm 분기 비활성 |
| `NEEDS_NVM` | Pass 3 (로컬) | Pass 3 내부 | Node 버전 부족 여부 |
| `AIUSAGE_FROM_INSTALL_SH=1` | Final | `init` / `repair` (cli) | preflight 가 install.sh 재호출 무한 루프 방지 |
| `NODE_MAJOR` | Pass 3 | Pass 3 | `node -v` 의 메이저 숫자 (없으면 빈 문자열) |
| `NODE_PATH` | Pass 2 | Pass 2 | `command -v node` 결과 |
| `REPO` | top | `npx` 호출 | `github:eugene-eee-hongkyu/ai-usage-tracker` |
| `INSTALL_URL` | top | 안내 메시지 재실행 명령 | https://aiusage.z21labs.world/install.sh |
| `ME` / `WHO` / `GRP` | top | Pass 1 chown 명령 | uid / username / staff 그룹 |
| `BAR` | top | 모든 박스 출력 | `═` 60자 |

## 헬퍼 함수

| 함수 | 위치 | 역할 |
|---|---|---|
| `get_uid()` | 19~26 | BSD stat (`-f`) / GNU stat (`-c`) 자동 분기 |
| `prompt_yn()` | 28~42 | `curl \| bash` 환경에서도 `/dev/tty` 로 입력 받기. default Y |
| `check_owner()` | 54~73 | 경로 owner 가 현재 사용자와 다르면 `ISSUES` + `CHOWN_CMDS` 누적 |

## 결정 매트릭스 (Pass 2·3 종합)

| 시작 상태 | Pass 1.5 | Pass 2 | Pass 3 | 결과 |
|---|---|---|---|---|
| Node 없음 | (해당없음) | (skip — node 없음) | nvm 자동 설치 | nvm Node 22 |
| Node 22 (.pkg) | (해당없음) | prompt Y → 전환 | (skip — 22+) | nvm Node 22 |
| Node 22 (.pkg) | (해당없음) | prompt N → 유지 | (skip — 22+) | .pkg Node 그대로 |
| Node 22 (nvm/brew) | (해당없음) | skip (nvm 인 경우) | skip | 그대로 |
| Node 18 (.pkg) | (해당없음) | prompt Y → 전환 | nvm 이미 있어 22 활성 | nvm Node 22 |
| Node 18 (.pkg) | (해당없음) | prompt N → 유지 | NEEDS_NVM=1 → nvm 설치 | nvm Node 22 (**N 무력화**) |
| asdf 있음 + Node 22 | SKIP_NVM=1 | skip | skip | asdf Node 그대로 |
| asdf 있음 + Node 18 | SKIP_NVM=1 | skip | `exit 1` + 안내 | 사용자 수동 |
| asdf 있음 + Node 없음 | SKIP_NVM=1 | skip | `exit 1` + 안내 | 사용자 수동 |

## 관련 파일

| 파일 | 역할 |
|---|---|
| [web/public/install.sh](../web/public/install.sh) | 본 문서 대상 (canonical, URL 으로 서빙) |
| [web/public/install.ps1](../web/public/install.ps1) | Windows mirror — 동일 구조 (PowerShell 문법) |
| [cli/src/init.ts](../cli/src/init.ts) | 신규 설치 흐름. `preflightOwnership()` / `preflightNodeVersion()` / `runInstallShAndExit()` 가 install.sh 의 가드와 거울처럼 동작 |
| [cli/src/migrate.ts](../cli/src/migrate.ts) | primus → z21labs 4단계 마이그 (keytar / data dir / key file / LaunchAgent) |
| installer/electron/staged/web/public/install.sh | Electron build stage 카피본 (build 시 자동 갱신) |

## 변경 시 체크리스트

install.sh 의 분기를 만지면:

- [ ] 이 문서의 "한눈에" 다이어그램 + 영향받은 Pass 섹션 갱신
- [ ] 결정 매트릭스에 새 row 가 필요한지 확인
- [ ] `cli/src/init.ts` 의 `preflightOwnership` / `preflightNodeVersion` 과 검사 경로·임계값 일치 (CLI 가 install.sh 재호출하므로 mismatch 시 무한 루프)
- [ ] `web/public/install.ps1` 도 동일 분기 반영 (Windows 사용자 위해)
- [ ] `bash -n web/public/install.sh` 문법 확인
- [ ] (선택) `installer/electron/staged/web/public/install.sh` 는 build 가 카피하므로 직접 수정 X
