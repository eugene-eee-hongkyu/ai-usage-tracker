# Installer — .pkg (mac) / .msi (windows) 빌드

100% 로컬 모드 단독 동작 인스톨러. 외부 회사 데모용 + 내부 사용자도 로컬 + 회사 서버 fan-out 가능.

## 구조

```
installer/
├── launcher.mjs            cross-platform Node 스크립트 (Next.js standalone 띄움)
├── mac/
│   ├── build.sh            .pkg 빌드 진입점
│   └── scripts/postinstall pkgbuild 후처리
└── windows/                .msi (WiX) — Phase 3.5
```

## 페이로드 (인스톨 위치 `/usr/local/lib/ai-usage-tracker/`)

| 경로 | 역할 |
|---|---|
| `web/server.js` + `web/node_modules` | Next.js standalone server |
| `web/.next/static`, `web/public` | 정적 자산 |
| `web/drizzle-sqlite/` | SQLite migration SQL |
| `installer/launcher.mjs` | 앱 실행 entry — 서버 띄움 + dashboard 오픈 |
| `cli/sync.mjs` | launchd 가 호출하는 sync binary |
| `cli/destinations.mjs` (번들 안에 포함) | config.json 로더 |

## 빌드 (mac)

```bash
installer/mac/build.sh [version]
# 예: installer/mac/build.sh 0.1.0
# 출력: installer/mac/dist/ai-usage-tracker-0.1.0.pkg
```

요구사항:
- mac (pkgbuild = Xcode CLI tools)
- Node 22+ (시스템에 설치되어야 함, 인스톨러는 본체만 동봉)
- `npm run build` 가 `web/` 에서 통과해야 함

Apple Developer 인증서가 없으면 Gatekeeper 가 차단 → 우클릭 → "열기" 로 우회. notarize 는 별도 단계.

## 설치 (사용자 환경)

```
# 1. .pkg 더블클릭 → 설치
# 2. 터미널 또는 Finder
usage-tracker
# → 브라우저에 http://localhost:3737/dashboard 자동 오픈
```

## 첫 실행 동작 (launcher.mjs)

1. `~/.usage-tracker/` 디렉토리 생성
2. **legacy 환경 detect** — `~/.primus-usage-key` 발견 시 config.json 의 destinations 에 회사 서버 자동 추가 (`local` + `company` fan-out)
3. `~/.usage-tracker/config.json` 생성 (없으면)
4. `~/.usage-tracker/data.sqlite3` 생성 + migration 적용
5. `~/Library/LaunchAgents/world.z21labs.ai-usage-tracker.sync.plist` 등록 (legacy launchd 가 없을 때만)
6. Next.js standalone server 백그라운드 시작 (포트 3737)
7. 시스템 브라우저로 dashboard 오픈

## 데이터 흐름

```
launchd (2h)  →  cli/sync.mjs  →  ccusage + codeburn 실행
                                ↓
                          fan-out (config.json)
                       ↙             ↘
              localhost:3737      https://aiusage.z21labs.world
              (SQLite write)      (Supabase write, apiKey 있으면)
```

사용자가 `~/.usage-tracker/config.json` 직접 수정해서 destination 추가/제거 가능.

## Legacy 호환 (기존 5명)

기존 install.sh 로 셋업된 사용자가 .pkg 를 추가 설치하면:

1. launcher 가 `~/.primus-usage-key` 감지 → config.json 자동 마이그레이션 (`local + company`)
2. legacy launchd plist (`com.primus.usage-tracker.daily.plist`) 그대로 유지
3. 기존 sync (`npx github:...`) 가 새 config.json 을 자동 사용 → 양쪽 (로컬 + 회사) 둘 다 정상 누적

새 launchd plist 는 만들지 않음 (legacy 와 중복 방지). 사용자가 legacy 폐기 원하면:
```
launchctl unload ~/Library/LaunchAgents/com.primus.usage-tracker.daily.plist
rm ~/Library/LaunchAgents/com.primus.usage-tracker.daily.plist
# launcher 다시 실행 → 새 launchd plist 자동 생성
```

## TODO

- Phase 3.5: Windows .msi (WiX)
- codesign + notarize 자동화
- universal binary (arm64 + x86_64)
- 인스톨러 GUI 의 destinations 편집 UI (현재는 config.json 수동 편집)
