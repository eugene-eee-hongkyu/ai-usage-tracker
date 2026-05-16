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
├── mac/                     legacy pkgbuild .pkg (Electron 도입 전, 보존만)
├── launcher.mjs             CLI-only launcher (Electron 안 쓰는 시나리오용)
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

## Legacy 호환 (기존 5명)

- `~/.primus-usage-key` 발견 시 위저드가 자동으로 `local + company` 추천 → 클릭 한 번에 마이그레이션
- 기존 launchd plist (`com.primus.usage-tracker.daily`) 그대로 유지 — 같은 sync 가 새 config.json 을 자동 사용
- 새 launchd 안 만듦 (중복 sync 방지)
- 사용자가 legacy 폐기 원하면 `launchctl unload …com.primus.usage-tracker.daily.plist; rm …plist`

## TODO

- ABI mismatch 자동 해결 (prebuild fetch 또는 Node 동봉)
- Windows .msi (electron-builder `--win`)
- universal binary (arm64 + x64)
- Apple Developer 계정 확보 후 codesign + notarize
- 아이콘 적용 (현재 기본 Electron 아이콘)
- 대시보드 페이지에도 i18n 적용 (현재는 위저드만)
