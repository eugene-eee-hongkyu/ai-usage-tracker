#!/bin/bash
# AI Usage Tracker — one-shot installer (Mac/Linux)
# Usage: curl -fsSL https://aiusage.z21labs.world/install.sh | bash

set -e

REPO="github:eugene-eee-hongkyu/ai-usage-tracker"
INSTALL_URL="https://aiusage.z21labs.world/install.sh"

ME=$(id -u)
WHO=$(whoami)
GRP=staff
BAR="════════════════════════════════════════════════════════════"

echo ""
echo "🚀 AI Usage Tracker 설치"
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
# Pass 1.5 — 다른 Node 버전 매니저 감지 (asdf/volta/fnm)
# ============================================================
# 다른 매니저가 이미 깔린 사용자에게 nvm 까지 설치하면 PATH 충돌 / Node
# 버전 우선순위 꼬임. 감지되면 nvm 자동 설치는 건너뛰고 그 매니저의
# 절차를 안내한다.

OTHER_MGR=""
if command -v asdf >/dev/null 2>&1; then
  OTHER_MGR="asdf"
elif command -v volta >/dev/null 2>&1; then
  OTHER_MGR="volta"
elif command -v fnm >/dev/null 2>&1 || [ -n "${FNM_DIR:-}" ]; then
  OTHER_MGR="fnm"
fi

if [ -n "$OTHER_MGR" ]; then
  echo "$BAR"
  echo "⚠️  $OTHER_MGR 가 감지되었습니다"
  echo ""
  echo "    nvm 자동 설치를 건너뜁니다 (버전 매니저 중복 충돌 방지)."
  echo "    수동으로 Node 22 를 설치한 뒤 다시 실행해주세요:"
  echo ""
  case "$OTHER_MGR" in
    asdf)
      echo "       asdf install nodejs 22.11.0"
      echo "       asdf global nodejs 22.11.0"
      ;;
    volta)
      echo "       volta install node@22"
      ;;
    fnm)
      echo "       fnm install 22"
      echo "       fnm default 22"
      ;;
  esac
  echo "       npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair"
  echo "$BAR"
  echo ""
  SKIP_NVM=1
fi

# ============================================================
# Pass 2 — .pkg installer Node 감지 + nvm 전환 권유 (macOS only)
# ============================================================
# /usr/local/bin/node 의 .pkg installer Node 는 npm global / cache 가
# root 소유로 자주 망가져 권한 사고가 반복된다. nvm 으로 전환하면
# 모든 npm 작업이 ~/.nvm 안에서만 일어나 sudo 의존이 사라진다.

if [ -z "${SKIP_NVM:-}" ] && command -v node >/dev/null 2>&1; then
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
      echo ""
      echo "    변경되는 것:"
      echo "      - ~/.zshrc 에 nvm 활성화 라인 추가 (자동 백업본 생성)"
      echo "      - 기본 Node: $(node -v) → v22.x.x (nvm)"
      echo "      - 시스템 Node ($NODE_PATH) 자체는 안 건드림"
      echo ""
      echo "    롤백:  nvm use system  또는  nvm alias default $(node -v | tr -d v)"
      echo "$BAR"
      echo ""
      if prompt_yn "   nvm 으로 자동 전환하시겠습니까? (Y/n): "; then
        # 백업 — shell profile + 글로벌 CLI 목록
        TS=$(date +%s)
        BACKUP_DIR="$HOME/.primus-usage-tracker"
        mkdir -p "$BACKUP_DIR"
        echo ""
        echo "💾 백업 중..."
        for rc in "$HOME/.zshrc" "$HOME/.bash_profile" "$HOME/.bashrc"; do
          if [ -f "$rc" ]; then
            cp "$rc" "$BACKUP_DIR/$(basename "$rc").bak-${TS}"
            echo "   ✓ $rc → $BACKUP_DIR/$(basename "$rc").bak-${TS}"
          fi
        done
        if command -v npm >/dev/null 2>&1; then
          npm list -g --depth=0 > "$BACKUP_DIR/old-node-globals.txt" 2>/dev/null || true
          echo "   ✓ 글로벌 CLI 목록 → $BACKUP_DIR/old-node-globals.txt"
        fi
        echo ""
        echo "📦 nvm 설치 중..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        # shellcheck disable=SC1091
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
        nvm install 22
        nvm use 22
        nvm alias default 22 >/dev/null 2>&1 || true
        echo ""
        echo "✅ nvm + Node 22 활성화 ($(node -v))"
        echo "   기본 Node 가 nvm 으로 설정됨 (새 쉘에서도 자동 적용)"
        echo "   옛 글로벌 CLI 가 필요하면: cat $BACKUP_DIR/old-node-globals.txt"
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
# Pass 3 — Node 미설치 시 nvm 으로 자동 설치 (다른 매니저 없을 때만)
# ============================================================
if ! command -v node >/dev/null 2>&1; then
  if [ -n "${SKIP_NVM:-}" ]; then
    echo "❌ Node 미설치 + 다른 버전 매니저($OTHER_MGR) 존재"
    echo "   위 매니저 절차로 Node 22 설치 후 다시 실행하세요."
    exit 1
  fi
  echo "📦 Node.js 가 없습니다. nvm 으로 설치합니다..."
  echo ""
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install 22
  nvm use 22
  nvm alias default 22 >/dev/null 2>&1 || true
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
