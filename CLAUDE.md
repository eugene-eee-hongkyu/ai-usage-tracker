# CLAUDE.md — AI 에이전트 운영 규칙

## 명령어

| 명령 | 동작 |
|---|---|
| `/worklog` | 세션 작업 요약 → worklog.md + decision.md(해당 시) + state.md 갱신 |

---

## 세션 시작

기본 로드:
1. `CONTEXT.md` — 프로젝트 전체 개요
2. `.harness/state.md` — 현재 진행 상황

조건부 추가 로드 (AI가 판단):
- `.harness/decision.md` — 관련 의사결정 맥락이 필요할 때

---

## 권한 규칙

권한은 `.claude/settings.local.json`을 따른다. 권한 부족 시 작업 멈추지 말고 우회하거나 사람에게 명시 요청한다.

### 금지 (Forbidden)
deny 목록. 접근이 필요하면 "사람이 직접 수행해야 합니다"라고 안내한다.

### 사전 승인 (Approval)
allow/deny 어디에도 없는 영역. 반드시 멈추고 아래 템플릿으로 승인 요청한다.

### 자동 허용 (Auto)
allow 목록. 묻지 않고 실행한다.

**시크릿(`.env`, AWS 자격증명, API 키)은 코드·커밋·worklog 어디에도 기록하지 않는다.**

---

## 승인 요청 템플릿

사전 승인이 필요한 작업 시, 반드시 이 형식으로 요청한다.

- **작업**: [구체적 행동]
- **이유**: [왜 필요한지]
- **영향 범위**: [어떤 파일/서비스/시스템에 영향]
- **예상 리스크**: 낮음 / 중간 / 높음
- **되돌리는 방법**: [롤백 절차]
- **지금 안 하면**: [보류 시 영향]

---

## 문서 갱신 원칙

**기록 생략 가능**: 단순 조회, 탐색, 1회성 설명, 경미한 문서 수정
**반드시 기록**: 상태 변경, 의사결정, 실패한 시도, 외부 영향

### "사람 판단 필요" 기준 (state.md에 올릴 항목)
- 제품 방향 변경
- 데이터 삭제 또는 외부 시스템 반영
- 비용 발생 (AWS, LLM API, 결제 등)
- 보안/권한 영향
- 되돌리기 어려운 구조 변경

### 파일별 규칙

**state.md**: 1페이지 이내. "다음 액션" 최대 3개. 사실만, 추측 표현 금지.

**worklog.md**: 작업 내역 + 실패한 시도 + 다음 액션. 500라인 초과 시 `.harness/archive/`로 이동.

**decision.md**: 대안 비교 후 결정한 것만. 500라인 초과 시 `.harness/archive/`로 이동.

---

## Bash 실행 규칙

- 명령어를 `&&`, `;`, `||` 로 연결하지 않는다
- 각 명령어를 별도의 Bash 호출로 나누어 순차 실행한다
- Python 실행 시 `source .venv/bin/activate` 대신 venv Python 경로를 직접 사용한다
  - ❌ `source .venv/bin/activate && python3 main.py`
  - ✅ `.venv/bin/python3 main.py`
- 예시 (전체 흐름):
  - ❌ `cd /project && source .venv/bin/activate && python3 main.py`
  - ✅ 첫 번째 호출: `cd /project`
  - ✅ 두 번째 호출: `.venv/bin/python3 main.py`

---

## 자기 수정 금지

이 파일(CLAUDE.md), `.claude/settings.json`, `.claude/settings.local.json`은 AI가 직접 수정하지 않는다.

---

## 커뮤니케이션 언어

- 코드: 영어 (변수명, 주석, 커밋 메시지)
- 문서 (.harness/*.md): 한글
- 사람과의 대화: 한글

---

## 웹 디버깅 (MCP)

Playwright MCP와 Chrome DevTools MCP가 글로벌로 설치되어 있다. 아래 기준으로 선택한다.

| 상황 | 도구 |
|---|---|
| UI 탐색, 클릭, 폼 입력, 스크린샷 | Playwright MCP |
| 콘솔 에러, 네트워크 요청 확인 | 둘 다 가능 |
| JS 성능 분석, 메모리 스냅샷 | Chrome DevTools MCP |

작업 순서:
1. `browser_snapshot` 먼저 — DOM 구조 파악 (토큰 효율적)
2. `browser_take_screenshot` — 시각 확인이 필요할 때만
3. 개발 서버 URL은 `CONTEXT.md > 개발 서버` 섹션에서 읽는다
