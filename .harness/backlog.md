# backlog.md — 나중에 할 것들

---

## 대기 중

NONE

---

잠깐, 다시 확인할게요.

세션 요약에 **"다음으로 넘긴 것"** 항목이 명시되어 있습니다.

---

## 2026-04-28: LaunchAgents 스케줄 등록 로직 수정

- **백로그 이유**: 원인 파악(plist 미존재, launchd 미등록)까지만 완료, 수정 작업은 시간 내 미착수
- **할 것**: `init.mjs`의 `registerDailySchedule` 함수 상세 분석 → plist 생성 및 launchctl 등록 로직 수정 → 9시 자동 수집이 실제로 동작하는지 검증
- **필요한 것**: 로컬 macOS 환경 (launchctl 테스트용) / `~/Library/LaunchAgents/` 쓰기 권한 확인 / 기존 `init.mjs` 전체 코드
- **이전 검토**: LaunchAgents 디렉토리에 plist 파일 없음 확인 / launchd 미등록 상태 확인 / init.ts·init.mjs 내 스케줄 등록 로직 존재는 확인했으나 실제 실행 경로 미검증

<!-- 새 항목은 여기 위에 추가 -->

---

## 완료 / 취소


