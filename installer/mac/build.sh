#!/usr/bin/env bash
#
# ⚠️ DEPRECATED — 옛 .pkg 인스톨러 빌드 (Phase 3.0~3.2).
# 현 방식: .dmg (Electron) — `installer/electron/` 의 `npm run build` 로 대체.
# 이 스크립트는 history 보존용으로만 남아 있고 더 이상 호출되지 않음.
# installer/launcher.mjs 와 함께 차기 cleanup 사이클에 삭제 예정.
#
# mac .pkg 인스톨러 빌드.
#
# 출력: installer/mac/dist/ai-usage-tracker-<version>.pkg
#
# 페이로드 layout (/usr/local/lib/ai-usage-tracker/):
#   web/server.js              ← Next.js standalone entry
#   web/node_modules/...
#   web/.next/static/          ← 정적 자산
#   web/public/                ← public 자산
#   web/drizzle-sqlite/        ← migration SQL
#   installer/launcher.mjs
#   cli/sync.mjs               ← launchd 가 호출하는 sync binary
#   cli/destinations.mjs
#
# postinstall:
#   /usr/local/bin/usage-tracker  → launcher wrapper 생성
#   사용자 launchd plist 는 first-run 시 launcher 가 등록 (root vs user 권한 분리).
#
# 요구사항: Node 22+ 가 시스템에 설치되어 있어야 함 (자체 동봉 X). ccusage/codeburn
# 도 별도 npm 설치 필요 — 인스톨러는 web/CLI 본체만 책임.
#
# 사용:
#   installer/mac/build.sh [version]
#
# Apple Developer 인증서가 없으면 Gatekeeper 가 열 때 우클릭 → 열기 필요.
# notarize 는 별도 단계.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION="${1:-0.1.0}"
PKG_ID="world.z21labs.ai-usage-tracker"
INSTALL_DIR="/usr/local/lib/ai-usage-tracker"

BUILD_DIR="$ROOT/installer/mac/build"
PAYLOAD_DIR="$BUILD_DIR/payload$INSTALL_DIR"
DIST_DIR="$ROOT/installer/mac/dist"

echo "==> 빌드 디렉토리 초기화"
rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$PAYLOAD_DIR" "$DIST_DIR"

echo "==> Next.js standalone build"
(cd "$ROOT/web" && npm run build)

echo "==> 페이로드 구성"
# Next.js standalone — server.js + node_modules
cp -R "$ROOT/web/.next/standalone/." "$PAYLOAD_DIR/web/"
# standalone 은 static + public 을 자동 복사하지 않음 — 별도로 위치 맞춤.
mkdir -p "$PAYLOAD_DIR/web/.next"
cp -R "$ROOT/web/.next/static" "$PAYLOAD_DIR/web/.next/static"
cp -R "$ROOT/web/public" "$PAYLOAD_DIR/web/public"
# SQLite migration SQL
cp -R "$ROOT/web/drizzle-sqlite" "$PAYLOAD_DIR/web/drizzle-sqlite"

# launcher + CLI sync 번들
mkdir -p "$PAYLOAD_DIR/installer" "$PAYLOAD_DIR/cli"
cp "$ROOT/installer/launcher.mjs" "$PAYLOAD_DIR/installer/launcher.mjs"
cp "$ROOT/cli/src/sync.mjs" "$PAYLOAD_DIR/cli/sync.mjs"
cp "$ROOT/cli/src/index.mjs" "$PAYLOAD_DIR/cli/index.mjs"
cp "$ROOT/cli/src/init.mjs" "$PAYLOAD_DIR/cli/init.mjs"

# config 예시 (참고용)
cp "$ROOT/cli/config.example.json" "$PAYLOAD_DIR/config.example.json"

echo "==> postinstall 스크립트 복사"
SCRIPTS_DIR="$BUILD_DIR/scripts"
mkdir -p "$SCRIPTS_DIR"
cp "$ROOT/installer/mac/scripts/postinstall" "$SCRIPTS_DIR/postinstall"
chmod +x "$SCRIPTS_DIR/postinstall"

echo "==> pkgbuild"
PKG_PATH="$DIST_DIR/ai-usage-tracker-$VERSION.pkg"
pkgbuild \
  --root "$BUILD_DIR/payload" \
  --identifier "$PKG_ID" \
  --version "$VERSION" \
  --scripts "$SCRIPTS_DIR" \
  --install-location / \
  "$PKG_PATH"

SIZE=$(du -sh "$PKG_PATH" | awk '{print $1}')
echo ""
echo "✅ 빌드 완료: $PKG_PATH ($SIZE)"
echo ""
echo "다음 단계:"
echo "  1. 더블클릭으로 설치 (signing 안 했으면 우클릭 → 열기)"
echo "  2. 터미널에서 'usage-tracker' 실행 → 대시보드 자동 오픈"
echo ""
