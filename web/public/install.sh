#!/bin/bash
# Primus Usage Tracker — one-shot installer (Mac/Linux)
# Usage: curl -fsSL https://ai-usage-tracker-web-psi.vercel.app/install.sh | bash

set -e

REPO="github:eugene-eee-hongkyu/ai-usage-tracker"

echo ""
echo "🚀 Primus Usage Tracker 설치"
echo ""

# Check Node
if ! command -v node >/dev/null 2>&1; then
  echo "📦 Node.js가 없습니다. nvm으로 설치합니다..."
  echo ""

  # Install nvm
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

  # Load nvm into this shell
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

  # Install LTS Node
  nvm install --lts
  nvm use --lts

  echo ""
  echo "✅ Node.js 설치 완료 ($(node -v))"
else
  echo "✅ Node.js 확인됨 ($(node -v))"
fi

echo ""
echo "📥 Usage Tracker init 실행..."
echo ""

# Run init via npx
npx --yes --ignore-cache "$REPO" init
