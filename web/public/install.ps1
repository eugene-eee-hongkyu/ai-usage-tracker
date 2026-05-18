# AI Usage Tracker — one-shot installer (Windows)
# Usage: irm https://aiusage.z21labs.world/install.ps1 | iex

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "AI Usage Tracker 설치" -ForegroundColor Cyan
Write-Host ""

# ----------------------------------------------------------------------
# Node 22+ 강제 — codeburn (engines >=22) / ccusage (engines >=22.0.0).
# Node 없음 또는 < 22 면 winget 으로 LTS (현재 v22) 설치/업그레이드.
# ----------------------------------------------------------------------
function Get-NodeMajor {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $cmd) { return $null }
  try {
    $v = node -v 2>$null
    if ($v -match '^v(\d+)') { return [int]$matches[1] }
    return $null
  } catch { return $null }
}

function Refresh-Path {
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

$nodeMajor = Get-NodeMajor
$needsInstall = ($null -eq $nodeMajor) -or ($nodeMajor -lt 22)

if ($needsInstall) {
  if ($null -eq $nodeMajor) {
    Write-Host "Node.js가 없습니다. winget으로 설치합니다..." -ForegroundColor Yellow
  } else {
    Write-Host "Node $nodeMajor 감지 — Node 22 (LTS) 로 자동 전환합니다..." -ForegroundColor Yellow
  }

  $wingetCmd = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $wingetCmd) {
    Write-Host ""
    Write-Host "winget이 없습니다. Node.js 22 LTS 를 직접 설치해주세요:" -ForegroundColor Red
    Write-Host "   https://nodejs.org/ko/download (LTS 선택)"
    Write-Host ""
    Write-Host "설치 후 새 PowerShell 창에서:" -ForegroundColor Yellow
    Write-Host "   irm https://aiusage.z21labs.world/install.ps1 | iex"
    exit 1
  }

  # winget install 은 기존 패키지 있으면 skip — upgrade 도 같이 시도.
  winget install OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements 2>$null
  winget upgrade OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements 2>$null

  Refresh-Path

  $nodeMajor = Get-NodeMajor
  if ($null -eq $nodeMajor -or $nodeMajor -lt 22) {
    Write-Host ""
    Write-Host "Node 22 자동 설치 실패. 수동 설치 필요:" -ForegroundColor Red
    Write-Host "   https://nodejs.org/ko/download (LTS 선택)"
    Write-Host "   설치 후 새 PowerShell 창에서:"
    Write-Host "     irm https://aiusage.z21labs.world/install.ps1 | iex"
    exit 1
  }
  Write-Host "Node $(node -v) 활성화" -ForegroundColor Green
} else {
  Write-Host "Node.js 확인됨 ($(node -v))" -ForegroundColor Green
}

# ----------------------------------------------------------------------
# 기존 API 키 감지 시 repair (멱등, prompt 없음), 없으면 init (OAuth 흐름).
# install.sh 와 동일 패턴.
# ----------------------------------------------------------------------
$apiKeyPath = Join-Path $env:USERPROFILE ".z21labs\usage-key"
$legacyKeyPath = Join-Path $env:USERPROFILE ".primus-usage-key"

Write-Host ""
if ((Test-Path $apiKeyPath) -or (Test-Path $legacyKeyPath)) {
  Write-Host "Usage Tracker repair 실행 (기존 키 감지)..." -ForegroundColor Cyan
  Write-Host ""
  $env:AIUSAGE_FROM_INSTALL_SH = "1"
  npx --yes --ignore-cache github:eugene-eee-hongkyu/ai-usage-tracker repair
} else {
  Write-Host "Usage Tracker init 실행 (신규)..." -ForegroundColor Cyan
  Write-Host ""
  $env:AIUSAGE_FROM_INSTALL_SH = "1"
  npx --yes --ignore-cache github:eugene-eee-hongkyu/ai-usage-tracker init
}
