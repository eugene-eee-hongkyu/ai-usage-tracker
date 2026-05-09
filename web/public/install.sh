#!/bin/bash
# Primus Usage Tracker — one-shot installer (Mac/Linux)
# Usage: curl -fsSL https://ai-usage-tracker-web-psi.vercel.app/install.sh | bash

set -e

REPO="github:eugene-eee-hongkyu/ai-usage-tracker"
INSTALL_URL="https://ai-usage-tracker-web-psi.vercel.app/install.sh"

ME=$(id -u)
WHO=$(whoami)
GRP=staff
BAR="════════════════════════════════════════════════════════════"

echo ""
echo "🚀 Primus Usage Tracker 설치"
echo ""
echo "🔍 환경 점검 중..."
echo ""

# Portable stat -- returns owner uid
get_uid() {
  if stat -f "%u" "$1" >/dev/null 2>&1; then
    stat -f "%u" "$1"
  else
    stat -c "%u" "$1"
  fi
}

# Read-from-tty prompt (works under `curl | bash` via /dev/tty)
prompt_yn() {
  local prompt="$1"
  local ans=""
  if [ ! -e /dev/tty ]; then
    return 1
  fi
  printf "%s" "$prompt"
  read -r ans < /dev/tty 2>/dev/null || return 1
  ans=${ans:-Y}
  case "$ans" in
    Y|y|YES|yes) return 0 ;;
    *) return 1 ;;
  esac
}

# ============================================================
# Pass 1 — Ownership preflight
# ============================================================
# Check every path our system touches. If any are owned by another
# user (typically root), abort and print the exact chown commands so
# the user fixes everything in one shot — never piecewise discovery.

ISSUES=""
CHOWN_CMDS=""

check_owner() {
  local p="$1"
  local label="$2"
  local kind="$3"  # dir|file
  if [ -e "$p" ]; then
    local owner
    owner=$(get_uid "$p")
    if [ "$owner" != "$ME" ]; then
      ISSUES="${ISSUES}  uid=${owner}  ${label}
"
      if [ "$kind" = "dir" ]; then
        CHOWN_CMDS="${CHOWN_CMDS}    sudo chown -R \"${WHO}:${GRP}\" \"${p}\"
"
      else
        CHOWN_CMDS="${CHOWN_CMDS}    sudo chown \"${WHO}:${GRP}\" \"${p}\"
"
      fi
    fi
  fi
}

check_owner "$HOME/.npm" "$HOME/.npm (npm 캐시)" "dir"
check_owner "$HOME/.primus-usage-tracker" "$HOME/.primus-usage-tracker" "dir"
check_owner "$HOME/.primus-usage-key" "$HOME/.primus-usage-key (API 키)" "file"
if [ "$(uname)" = "Darwin" ]; then
  check_owner "$HOME/Library/LaunchAgents/com.primus.usage-tracker.daily.plist" "LaunchAgent plist" "file"
fi

if [ -n "$CHOWN_CMDS" ]; then
  echo "$BAR"
  echo "❌ 다른 사용자 소유의 파일이 있습니다 (보통 root)"
  echo "   원인: 과거에 elevated 권한으로 npm/install 이 실행됨"
  echo ""
  printf "%s" "$ISSUES"
  echo ""
  echo "🛠  아래 명령을 한 번에 복사·붙여넣기 하세요:"
  echo ""
  printf "%s" "$CHOWN_CMDS"
  echo ""
  echo "그 다음 install 을 다시 실행:"
  echo "    curl -fsSL ${INSTALL_URL} | bash"
  echo "$BAR"
  echo ""
  exit 1
fi

echo "✅ 소유권 OK"
echo ""

# ============================================================
# Pass 2 — .pkg installer Node 감지 + nvm 전환 권유 (macOS only)
# ============================================================
# /usr/local/bin/node 의 .pkg installer Node 는 npm global / cache 가
# root 소유로 자주 망가져 권한 사고가 반복된다. nvm 으로 전환하면
# 모든 npm 작업이 ~/.nvm 안에서만 일어나 sudo 의존이 사라진다.

if command -v node >/dev/null 2>&1; then
  NODE_PATH=$(command -v node)
  if [ "$(uname)" = "Darwin" ] && [ "$NODE_PATH" = "/usr/local/bin/node" ]; then
    REAL_NODE=$(readlink "$NODE_PATH" 2>/dev/null || echo "$NODE_PATH")
    if ! echo "$REAL_NODE" | grep -q "\.nvm"; then
      echo "$BAR"
      echo "⚠️  Node.js 가 .pkg installer 로 설치되어 있습니다"
      echo "    경로: $NODE_PATH"
      echo ""
      echo "    이 방식은 npm global/cache 가 root 소유로 자주 망가져"
      echo "    이번 같은 권한 사고가 반복될 수 있습니다."
      echo ""
      echo "    nvm 으로 전환하면 모든 npm 작업이 ~/.nvm 안에서만 일어나"
      echo "    sudo 없이 깨끗하게 동작합니다."
      echo "$BAR"
      echo ""
      if prompt_yn "   nvm 으로 자동 전환하시겠습니까? (Y/n): "; then
        echo ""
        echo "📦 nvm 설치 중..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        # shellcheck disable=SC1091
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
        nvm install --lts
        nvm use --lts
        nvm alias default 'lts/*' >/dev/null 2>&1 || true
        echo ""
        echo "✅ nvm + Node LTS 활성화 ($(node -v))"
        echo "   기본 Node 가 nvm 으로 설정됨 (새 쉘에서도 자동 적용)"
      else
        echo ""
        echo "ℹ️  .pkg Node 그대로 사용합니다 (권한 사고 위험은 인지하셨습니다)"
        echo "   비대화형 실행이라 묻지 못한 경우, 새 쉘에서 직접 실행하세요:"
        echo "      curl -fsSL ${INSTALL_URL} | bash"
      fi
      echo ""
    fi
  fi
fi

# ============================================================
# Pass 3 — Node 미설치 시 nvm 으로 자동 설치
# ============================================================
if ! command -v node >/dev/null 2>&1; then
  echo "📦 Node.js 가 없습니다. nvm 으로 설치합니다..."
  echo ""
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install --lts
  nvm use --lts
  nvm alias default 'lts/*' >/dev/null 2>&1 || true
  echo ""
  echo "✅ Node.js 설치 완료 ($(node -v))"
else
  echo "✅ Node.js 확인됨 ($(node -v))"
fi

# ============================================================
# Pass 4 — Node 버전 가드 (codeburn ≥ 0.9.7 은 Node 22+ 권장)
# ============================================================
# 현재는 codeburn 0.9.7 이 Node 20 에서 advisory 로만 경고하고 실제 동작은
# 함. 다만 다음 codeburn major 가 진짜로 Node 22+ 기능 쓰면 break 가능.
# 명시적으로 안내해서 사용자가 미리 인지하도록.

NODE_MAJOR=$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*$/\1/')
if [ -n "$NODE_MAJOR" ] && [ "$NODE_MAJOR" -lt 22 ]; then
  echo ""
  echo "$BAR"
  echo "⚠️  Node $NODE_MAJOR 감지 — codeburn 0.9.7+ 는 Node 22 이상 권장"
  echo ""
  echo "    현재는 동작하지만 다음 codeburn major 에서 break 될 수 있습니다."
  echo "    여유 있을 때 Node 22 로 업그레이드 권장:"
  echo ""
  echo "       nvm install 22"
  echo "       nvm alias default 22"
  echo ""
  echo "    (자동 업그레이드는 의도적으로 안 함 — 다른 프로젝트의 Node 의존성"
  echo "     영향 줄 수 있어 사용자 판단으로 진행)"
  echo "$BAR"
  echo ""
fi

echo ""
echo "📥 Usage Tracker init 실행..."
echo ""

# Run init via npx
npx --yes --ignore-cache "$REPO" init
