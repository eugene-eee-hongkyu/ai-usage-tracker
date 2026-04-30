# Primus Usage Tracker — one-shot installer (Windows)
# Usage: irm https://ai-usage-tracker-web-psi.vercel.app/install.ps1 | iex

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Primus Usage Tracker 설치" -ForegroundColor Cyan
Write-Host ""

# Check Node
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  Write-Host "Node.js가 없습니다. winget으로 설치합니다..." -ForegroundColor Yellow

  $wingetCmd = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $wingetCmd) {
    Write-Host ""
    Write-Host "winget이 없습니다. Node.js를 직접 설치해주세요:" -ForegroundColor Red
    Write-Host "   https://nodejs.org/ko/download"
    Write-Host ""
    Write-Host "설치 후 새 터미널에서 아래 명령을 실행하세요:" -ForegroundColor Yellow
    Write-Host "   npx --yes --ignore-cache github:eugene-eee-hongkyu/ai-usage-tracker init"
    exit 1
  }

  winget install OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements

  # Refresh PATH for current session so npx is found right away
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

  Write-Host ""
  Write-Host "Node.js 설치 완료 ($(node -v))" -ForegroundColor Green
} else {
  Write-Host "Node.js 확인됨 ($(node -v))" -ForegroundColor Green
}

Write-Host ""
Write-Host "Usage Tracker init 실행..." -ForegroundColor Cyan
Write-Host ""

# Run init via npx
npx --yes --ignore-cache github:eugene-eee-hongkyu/ai-usage-tracker init
