# backlog.md — 나중에 할 것들

---

## 대기 중

NONE

## 2026-04-29: 스크롤바 숨김 처리 (스크롤 동작 유지)

- **백로그 이유**: grep 결과 확인이 완료되지 않은 상태에서 세션 종료
- **할 것**: `overflow-y-auto`, `overflow-auto` 클래스가 있는 위치에 스크롤바 숨김 스타일 일괄 적용
- **필요한 것**: grep 결과로 파악된 대상 파일/위치 목록 (재확인 필요할 수 있음)
- **이전 검토**: 스크롤바 숨김은 CSS로 처리 가능함을 확인. 코드베이스에서 `overflow-y-auto`, `overflow-auto` 클래스를 기준으로 위치 탐색 중이었음

---

**참고 — 적용 예정 CSS 패턴:**
```css
/* Webkit */
::-webkit-scrollbar { display: none; }

/* 표준 */
scrollbar-width: none;        /* Firefox */
-ms-overflow-style: none;     /* IE/Edge */
```
Tailwind 사용 중이라면 커스텀 유틸리티 클래스로 묶어두면 일괄 적용에 유리함.

<!-- 새 항목은 여기 위에 추가 -->

---

## 완료 / 취소

