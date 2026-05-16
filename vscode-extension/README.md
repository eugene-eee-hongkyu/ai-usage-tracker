# AI Usage Tracker — VS Code Extension

Claude Code 사용량을 자동 수집해 **개인 효율 점수 + 팀 랭킹**으로 시각화하는 사내 도구의 VS Code 익스텐션.

터미널 명령어를 외울 필요 없이 **IDE 안에서 클릭만으로 설치·관리** 합니다.

---

## 무엇을 해 주나요?

- Claude Code 세션이 끝날 때마다 token / cost / cache hit / one-shot rate 등 메타데이터를 **자동 수집**
- 개인 대시보드에서 4 signal 효율 점수(cache 42 + one-shot 18 + cost 10 + 사용량 30) + 90일 잔디 + 팀 비교
- LLM 호출 0건 — 모든 점수·등급·자연어 멘트가 deterministic 룰 기반 (같은 데이터면 항상 같은 결과)
- 도입 조직의 자체 Supabase + Vercel 인스턴스에 저장 (외부 SaaS 의존 0)

자세한 내용: https://aiusage.z21labs.world

---

## 설치 & 사용

### 1. 익스텐션 설치

VS Code Marketplace 에서 "AI Usage Tracker" 검색 후 **Install**.

### 2. 초기 설치

설치 직후 알림이 뜹니다 — **"지금 설치"** 클릭.

또는 명령 팔레트(`⌘+Shift+P` / `Ctrl+Shift+P`) → `AI Usage Tracker: 설치 / Setup`.

자동으로 통합 터미널이 열리고 `npx ... init` 가 실행되어:
- GitHub / Google OAuth 로 API 키 발급
- `~/.claude/settings.json` 에 SessionEnd hook 자동 등록
- 백그라운드에서 과거 90일 데이터 백필 시작

### 3. 일상 사용

상태바 우측의 **AI Usage Tracker** 항목 클릭 → 메뉴:

| 메뉴 | 동작 |
|------|------|
| 대시보드 열기 | 본인 효율 점수·잔디·팀 비교 |
| 셋업 상태 | 마지막 sync 시각·환경 진단 카드 |
| 복구 (Repair) | hook + 패키지 재등록 |
| 환경 진단 (Doctor) | Node·npm·codeburn·ccusage 상태 |

명령 팔레트에서도 동일 메뉴 사용 가능: `AI Usage Tracker:` 검색.

---

## 권한 사고 자동 복구

이전 sudo 흔적이나 시스템 .pkg Node 사용으로 인한 `EACCES` 권한 사고 발생 시, repair 가 자동으로 prompt 띄움:

```
❌ npm 전역 디렉토리에 쓰기 권한이 없습니다
   …
   자동 복구 가능:
     1. nvm 설치 (~/.nvm/ 안에만, 시스템 Node 그대로 보존)
     2. Node 22 설치 + 기본값으로 설정
     3. ~/.zshrc 자동 백업 후 nvm 라인 추가
   …
   지금 자동 복구를 진행할까요? [Y/n]:
```

**Y** 한 번이면 완료.

---

## 설정

VS Code Settings (`⌘+,` / `Ctrl+,`) 에서:

| 설정 | 기본값 | 용도 |
|------|--------|------|
| `aiUsageTracker.serverUrl` | `https://aiusage.z21labs.world` | 자체 호스팅 시 변경 |
| `aiUsageTracker.githubRepo` | `github:eugene-eee-hongkyu/ai-usage-tracker` | CLI 패키지 spec |

---

## 개인정보·보안

- **저장 위치**: 도입 조직의 자체 Supabase Postgres (외부 SaaS 의존 0)
- **RLS 활성**: user_snapshots / period_snapshots / daily_visits / user_blocks
- **LLM 호출 0건** — 모든 분석 deterministic
- **수집 항목**: token count, cost, 도구 호출, 모델명, 프로젝트 path (파일명만), 활성 시각
- **수집 안 함**: 코드 내용 / 프롬프트 / Claude 응답 텍스트 / 파일 내용 / 명령어 인자

---

## 작동 환경

- macOS / Linux 권장 (Windows SessionEnd hook 발화 검증 중)
- VS Code 1.85+
- Node.js 22 권장 (20도 동작, 단 codeburn 다음 major 에서 break 가능)

---

## License

MIT
