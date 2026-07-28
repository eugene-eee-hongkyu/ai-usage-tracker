# Installer — Electron desktop app

100% 로컬 모드 단독 동작. 외부 회사 데모용 + 내부 사용자도 로컬 + 회사 서버 fan-out 가능.

## 구조

```
installer/
├── electron/                Electron desktop app (권장 배포 채널)
│   ├── main.js              Electron main process
│   ├── package.json         electron-builder config 포함
│   ├── scripts/stage.js     standalone build + cli 를 staged/ 로 모음
│   └── staged/              빌드 산출물 (gitignored)
└── README.md
```

## 빌드 (Electron, mac arm64, self-signed)

```bash
cd installer/electron
npm install                                         # 처음만
node scripts/stage.js                                # 또는 npm run stage
CSC_IDENTITY_AUTO_DISCOVERY=false \
  npx electron-builder --mac --arm64                 # self-signed (identity: null)

# 출력
#   installer/electron/dist/AI Usage Tracker-0.1.0-arm64.dmg  (~100MB)
#   installer/electron/dist/mac-arm64/AI Usage Tracker.app    (~250MB unpacked)
```

전체 한 줄: `npm run build` (web build → stage → electron-builder).

## 설치 + 실행

```bash
# 1. .dmg 더블클릭 → Applications 로 드래그
# 2. 처음 실행 시 Gatekeeper 가 막으면 우클릭 → "열기"
# 3. (선택) quarantine 강제 제거:
xattr -dr com.apple.quarantine "/Applications/AI Usage Tracker.app"
```

## 첫 실행 동작 (main.js)

1. `~/.usage-tracker/` 디렉토리 생성
2. SQLite `data.sqlite3` + migration 자동 적용
3. **legacy 환경 detect** — `~/.primus-usage-key` 발견 시 마이그레이션 위저드가 `local + company` 옵션을 default 추천
4. 시스템 Node 를 찾아 Next.js standalone server 백그라운드 시작 (포트 3737)
5. BrowserWindow 가 첫 실행이면 `/wizard?locale=ko`, 이후엔 `/dashboard?locale=ko` 로드
6. 시스템 locale 자동 감지 (`app.getLocale()`) → 위저드 / 대시보드 UI 언어 적용
7. 위저드 완료 후 `~/.usage-tracker/config.json` 생성. 다음 sync 부터 자동 fan-out

## 마이그레이션 위저드 다국어

- 현재 지원: **한국어 (ko), 영어 (en)**
- 시스템 locale 자동 감지. 미지원 locale 은 영어 fallback
- 메시지 catalog: [`web/src/lib/i18n/messages/`](../web/src/lib/i18n/messages/)
- **다국어 확장 방법** (예: 일본어 추가):
  1. `web/src/lib/i18n/messages/ja.ts` 작성 — `en.ts` 의 `Messages` 타입을 import 해서 구조 유지 (누락 키는 컴파일러가 잡음)
  2. `web/src/lib/i18n/index.ts` 의 `byLocale` 에 `ja` 추가
  3. 빌드 → 자동 활성화. macOS 의 `app.getLocale()` 이 `"ja-JP"` 면 자동으로 일본어로 전환

## 알려진 이슈

### better-sqlite3 NODE_MODULE_VERSION mismatch

`better-sqlite3` 는 native binary 라 빌드 시 Node 와 실행 시 Node 의 ABI 가 일치해야 합니다.

- 빌드 환경: `web/node_modules/better-sqlite3` 가 빌드된 Node 의 ABI
- 실행 환경: `main.js` 의 `findSystemNode()` 가 찾는 첫 Node (`/opt/homebrew/bin/node` 우선)

**불일치 발견 케이스**:
- 빌드 = Node 20 (115), 실행 시스템 = Node 22 (141) → 500 Internal Server Error

**임시 우회**:
- 빌드 환경의 Node 버전과 실행 환경 PATH 의 첫 Node 를 일치시킴
- 또는 `~/.usage-tracker/server.log` 확인 후 `npm rebuild better-sqlite3` (web 디렉토리에서)

**근본 해결 후속**:
- prebuild-install 로 멀티-ABI prebuilt binary 자동 fetch
- 또는 Node 자체 동봉 (인스톨러 크기 +60MB)

## 데이터 흐름

```
launchd / Task Scheduler (2h)
   │
   ▼
cli/sync.mjs  ──┬─►  codeburn + ccusage (시스템 npm 글로벌)
                │
                ▼
        fan-out (~/.usage-tracker/config.json)
        ┌──────┴───────────┐
        ▼                  ▼
http://localhost:3737    https://aiusage.z21labs.world
(SQLite write)           (Supabase write, apiKey 필요)
```

## Legacy 호환 (기존 5명 + Primus → z21labs 리네임 단계 1~3)

- `~/.z21labs/usage-key` (현 표준) 또는 `~/.primus-usage-key` (옛 잔존) 발견 시 위저드가 자동으로 `local + company` 추천 → 클릭 한 번에 마이그레이션 (`web/src/app/api/config/status/route.ts` 가 새 path 우선 + 옛 fallback)
- 기존 launchd plist (`com.primus.usage-tracker.daily.plist` legacy 또는 `world.z21labs.ai-usage-tracker.sync.plist` 현 표준) 그대로 유지 — 같은 sync 가 새 config.json 을 자동 사용
- 새 launchd 안 만듦 (중복 sync 방지). 단 `installer/electron/main.js` 의 `ensureLaunchAgentMac` 은 새 plist 의 내용 (Node 경로 / PATH) 이 stale 하면 자동 regen
- 사용자가 legacy 폐기 원하면 `launchctl unload …com.primus.usage-tracker.daily.plist; rm …plist`

## Codesign + Notarize (Apple Developer 받은 후)

현재 self-sign (unsigned) 상태 — Gatekeeper 가 "확인되지 않은 개발자" 차단,
사용자가 우클릭 → "열기" 로 우회해야 함. Apple Developer Program 가입 ($99/년)
후 아래 절차로 정식 서명 + notarize 가능 → 일반 더블클릭 설치 가능.

### 사전 준비 (1회)

1. **Apple Developer Program 가입** — https://developer.apple.com/programs/
2. **Developer ID Application 인증서 발급**
   - Keychain Access → 인증서 지원 → 인증 기관에서 인증서 요청
   - https://developer.apple.com → Certificates → "Developer ID Application" 생성
   - Keychain 에 download 후 `.p12` 로 export (개인 키 포함, 비밀번호 설정)
3. **App-Specific Password 생성** — https://appleid.apple.com → 보안 → 앱 암호
4. **Team ID 확인** — https://developer.apple.com/account 의 Membership

### 빌드 명령

```bash
# unsigned (현재 default — Apple Developer 없을 때)
npm run dist:mac:unsigned

# signed + notarized
CSC_LINK="file://$PWD/build-resources/cert.p12" \
CSC_KEY_PASSWORD="<.p12 비밀번호>" \
APPLE_ID="<Apple ID 이메일>" \
APPLE_APP_SPECIFIC_PASSWORD="<App-Specific Password>" \
APPLE_TEAM_ID="<10자리 Team ID>" \
  npm run dist:mac:signed
```

`build-resources/cert.p12` 는 gitignored. 또는 base64 인코딩 후 환경변수:
`CSC_LINK="$(base64 -i cert.p12)"`.

### 빌드 산출물 차이

| 빌드 | Gatekeeper | 첫 실행 | notarize ticket |
|---|---|---|---|
| Unsigned | 차단 (우클릭 → 열기) | 우클릭 → 열기 (1회) | 없음 |
| Signed + Notarized | 허용 | 일반 더블클릭 | 동봉됨 |

### CI/CD 자동화 (GitHub Actions 예시)

```yaml
env:
  CSC_LINK: ${{ secrets.MAC_CERT_P12_BASE64 }}
  CSC_KEY_PASSWORD: ${{ secrets.MAC_CERT_PASSWORD }}
  APPLE_ID: ${{ secrets.APPLE_ID }}
  APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
  APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

GitHub macOS runner 에서 `npm run dist:mac:signed` 실행. notarize 단계는
약 5-15분 소요.

## TODO

- Windows .msi (electron-builder `--win`)
- universal binary (arm64 + x64)
- dashboard 의 나머지 한국어 텍스트 (등급 라벨, tooltip 등) i18n 적용
- 첫 빌드 후 사용자가 OS 의 다른 locale 로 변경 시 자동 갱신 (UI 새로고침)
