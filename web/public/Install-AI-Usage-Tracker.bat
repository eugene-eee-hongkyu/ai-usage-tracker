@echo off
chcp 65001 >nul
title AI Usage Tracker - Install
cls
echo.
echo ============================================================
echo   AI Usage Tracker - Auto Install
echo ============================================================
echo.
echo   PowerShell installer를 다운로드하고 실행합니다...
echo.
echo ------------------------------------------------------------
echo.

where powershell >nul 2>nul
if errorlevel 1 (
  echo   [ERROR] PowerShell이 설치되어 있지 않습니다.
  echo          Windows 10/11 기본 도구라 보통 있어야 하는데, 시스템을 점검해주세요.
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://ai-usage-tracker-web-psi.vercel.app/install.ps1 | iex"
set EXIT_CODE=%errorlevel%

echo.
echo ------------------------------------------------------------
echo.
if %EXIT_CODE% equ 0 (
  echo   [OK] 완료되었습니다. 이 창을 닫아도 됩니다.
) else (
  echo   [WARN] 설치 중 문제가 있었습니다 (exit code %EXIT_CODE%).
  echo          위 메시지를 확인하거나 가이드 문서를 참고하세요.
)
echo.
pause
