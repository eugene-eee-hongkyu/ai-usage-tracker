# Changelog

## 0.1.0 — 2026-05-15

### Initial release

- 상태바 표시 (Active / Not setup)
- 6 commands:
  - `AI Usage Tracker: 설치 / Setup`
  - `AI Usage Tracker: 복구 / Repair`
  - `AI Usage Tracker: 환경 진단 / Doctor`
  - `AI Usage Tracker: 대시보드 열기 / Open Dashboard`
  - `AI Usage Tracker: 셋업 상태 / Open Setup Status`
  - `AI Usage Tracker: 메뉴 / Show Menu`
- 상태바 클릭 시 Quick Pick 메뉴 (설치 상태에 따라 다른 항목)
- 첫 실행 시 자동 설치 안내 dialog (dismiss 가능)
- 5분마다 설치 상태 자동 갱신
- 사용자 설정: `serverUrl`, `githubRepo` (자체 호스팅 지원)
- 모든 cli 명령은 Integrated Terminal 에서 실행 — preflight 자동 복구 prompt 등 interactive 동작 보존
