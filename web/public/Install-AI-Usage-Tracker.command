#!/bin/bash
# AI Usage Tracker — macOS 더블클릭 설치 wrapper
# install.sh 를 자동 다운로드·실행. 사용자는 더블클릭만.

clear
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  AI Usage Tracker — 자동 설치"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "  설치 스크립트를 다운로드하고 실행합니다..."
echo ""
echo "────────────────────────────────────────────────────────────"
echo ""

if ! command -v curl >/dev/null 2>&1; then
  echo "  ❌ curl 이 설치되어 있지 않습니다."
  echo "     macOS 기본 도구라 보통 있어야 하는데, 시스템을 점검해주세요."
  echo ""
  read -p "  Press Enter to close..." dummy
  exit 1
fi

curl -fsSL https://ai-usage-tracker-web-psi.vercel.app/install.sh | bash
EXIT_CODE=$?

echo ""
echo "────────────────────────────────────────────────────────────"
echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "  ✅ 완료되었습니다. 이 창을 닫아도 됩니다."
else
  echo "  ⚠️  설치 중 문제가 있었습니다 (exit code $EXIT_CODE)."
  echo "     위 메시지를 확인하거나 가이드 문서를 참고하세요."
fi
echo ""
read -p "  Press Enter to close..." dummy
