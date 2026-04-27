# worklog.md — 작업 기록

> 최신 세션이 위에 오도록 역순으로 작성한다.

---

## Session 2026-04-27 17:58 — By Member 차트 스택 제거 + 툴팁 개선

### 작업 요약
- **By Member 차트 `stackId` 제거**: 멤버별 영역이 스택 누적되던 것을 각자 0 기준선부터 독립적으로 그리도록 수정 (`stackId="1"` 삭제)
- **Team Total 차트 원인 분석**: "Team Total이 oreo 차트와 똑같아 보인다"는 현상이 oreo가 스택 맨 위에 올라가 그 top edge = 팀 전체 합계가 되는 Recharts stacking 동작 때문임을 확인. 데이터 자체는 정상
- **By Member 툴팁 커스텀 컴포넌트**: `formatter` → `MemberTooltip` 커스텀 컴포넌트로 교체. 호버 시점 값 기준 내림차순 정렬하여 많이 쓴 사람이 위에 표시
- **Efficiency 테이블 native title**: `GradeCell` `<td>`에 `title={grade}` 추가. 각 지표 셀 호버 시 "탁월"/"양호"/"보통"/"부족"/"경고" 네이티브 툴팁 표시

### 다음 액션
- Vercel ADMIN_EMAIL env var 설정
- 팀원 초대 및 팀 화면 검증

---

## Session 2026-04-27 17:32 — 팀 페이지 레이아웃 개편 + 버그 수정

### 작업 요약
- **Efficiency 테이블 개선**:
  - $/call 컬럼 제거 (5개 지표로 축소: cache / 1-shot / $/sess / out/in / 종합)
  - 셀 배경색 히트맵 추가 (`GRADE_CELL_BG`: emerald/green/slate/amber/red 각 grade별)
  - 멤버 좌측 컬러 점 추가 (MEMBER_COLORS와 동일 팔레트)
  - 카드 헤더 등급 요약 ("탁월 N명 · 양호 N명 ...") 추가
- **Top Sessions 카드 신규 추가** (반칸):
  - 팀 API에 `topSessions` 필드 추가 — 멤버별 rawJson에서 세션 추출, cost 내림차순 top 15
  - 컬럼: 멤버 컬러 점 · 멤버명 · 프로젝트 · 날짜 · calls · cost
  - 프로젝트 셀: `direction: rtl`로 앞에 `...` 표시 (경로 끝 보임), `title` 호버 전체 경로
- **팀 페이지 카드 순서 3회 재배치**:
  - 최종: Daily Trend 행 → Usage/Efficiency → Top Sessions/Team Activities
- **Daily Trend 분할**: 전체폭 1개 → 반칸 2개 (By Member stacked + Team Total)
- **중복 이름 버그 수정**: `dailyMemberMap` 키를 `u.name` → `name__userId`로 변경. 동명이인 있을 때 차트에 4개 중복 표시되던 문제 해결
- **Team Total 차트 데이터 버그 수정**: `data.daily`(API 합산) → 프론트엔드에서 `dailyByMember` 직접 합산. rawJson 포맷 차이로 API 합산이 일부 멤버 누락하던 문제 해결
- **배경색 대비 개선**: opacity 10/8/12 → 25/20/25/25/30으로 상향, 보통에 slate 배경 추가
- **셀 배경색 강화 2차**: bg opacity 재조정으로 5등급 시각적 구분 명확화
- **README.md 업데이트**: 실제 DB 스키마(users + user_snapshots), 현재 UI 카드 목록, ingest 방식 반영

### 다음 액션
- Vercel ADMIN_EMAIL env var 설정
- 팀원 초대 및 팀 화면 검증
- Windows SessionEnd hook 발화 검증

---

## Session 2026-04-27 16:44 — 팀 대시보드 시각 시스템 정비 + 버그 수정

### 작업 요약
- **팀 페이지 시각 개선 (API + 프론트)**:
  - API: `prevCostPerSession`, `teamActivities`, `dailyByMember`, `memberNames` 필드 추가
  - 프론트: 카드 시스템(border-l-2 accent), 멤버별 stacked area, 팀 활동 분포, 사용량 막대 세션 수 라벨
  - vs prev 컬럼 추가 후 데이터 부재로 즉시 제거
- **팀 API cache hit 100% 버그 수정**: non-"all" 기간에서 `ov.cacheHitPercent` 직접 사용 → 토큰 기반 계산으로 교체 (dashboard API, all 케이스와 동일하게)
- **dead code 정리**: `collectors/claude-code.ts` (ccusage spawn, import 없음) 삭제, `metric-modal.tsx` 텍스트에서 ccusage 제거
- **팀 페이지 시각 시스템 개인 대시보드와 정합**:
  - `GRADE_VALUE_COLOR` 상수 추가 (grade → tailwind text 색 매핑)
  - Efficiency table: 메트릭별 GradePill 제거 → grade 색 value 텍스트, 종합만 pill 유지, `tabular-nums`
  - Usage: bar 앞으로(BY PROJECT 패턴), 컬럼 헤더 추가, gap-1.5/space-y-1, 비용 소수점 2자리
  - Team Activities: violet → pink (개인 BY ACTIVITY violet 중복 방지)

### 다음 액션
- Vercel ADMIN_EMAIL env var 설정
- 팀원 초대 및 팀 화면 검증
- Windows SessionEnd hook 발화 검증

---

## Session 2026-04-27 16:08 — Windows CLI 호환성 수정 + Vercel 빌드 에러

### 작업 요약
- **Vercel 빌드 에러 수정**: dashboard-view.tsx에서 사용하지 않는 `Link` import 제거 (ESLint no-unused-vars 빌드 실패)
- **Windows CLI 호환성 수정** (backfill이 서버에 데이터 전송 못 하는 버그):
  - 원인: `sync.ts` `spawnCodeburn()`이 `shell: false` 사용 → Windows에서 npm global 패키지가 `codeburn.cmd`로 설치되므로 `.cmd` 파일을 직접 실행 불가 → ENOENT → `catch` 블록에서 조용히 실패 → ingest 미호출 → `lastSyncedAt` null → step 2 두 항목 모두 미완
  - `sync.ts`: `shell: false` → `shell: true`
  - `init.ts`: `checkCodeburn()`에서 Windows는 `where codeburn`, Mac/Linux는 `which codeburn` 분기
  - `bun run build:sync` + `bun run build:init` 재빌드 후 커밋·푸시
- Mac 영향 없음 확인 (`shell: true`는 macOS에서 `/bin/sh -c`로 동일 동작)

### 다음 액션
- Windows 사용자가 `npx github:eugene-eee-hongkyu/ai-usage-tracker init` 재실행 → step 2 해결 여부 확인
- Vercel `ADMIN_EMAIL` env var 설정
- 팀원 초대 및 팀 화면 검증

---

## Session 2026-04-27 15:59 — 팀 대시보드 페이지 전면 재설계

### 작업 요약
- 어드민 화면의 "← 프로필로" 링크를 팀원 전환 드롭다운 select로 교체
- 팀 페이지 이름 "팀랭킹" → "팀"으로 변경
- MVP 카드·3개 랭킹 카드 제거 후 4섹션 구조로 재편
  - 팀 요약 바 (총비용·세션·활성인원·평균 효율)
  - 효율 표 (멤버별 cache hit / 1-shot / $/session 등 + 등급)
  - 사용량 가로 막대 차트 (Recharts)
  - 일별 비용 추이 Area 차트 (Recharts)
- API에 `callsCount`, `outputInputRatio`, `teamSummary`, `daily` 필드 추가
- 기존에 깨져있던 `ADMIN_EMAIL` import → `isAdmin()` 함수로 교체 (기존 TS 오류 수정)


## Session 2026-04-27 15:38 — 팀랭킹 버그 수정 + 관리자 대시보드 기능

### 작업 요약
- **Cache hit 100% 버그 수정 (ingest/team/dashboard)**: `> 1` 정규화 휴리스틱 제거. `codeburn`이 0-100 퍼센트로 반환하는데 값이 1일 때 `1 > 1 = false`로 100배 뻥튀기되던 문제. 3곳(`ingest/route.ts`, `team/route.ts`, `dashboard/route.ts`) 일괄 수정
- **Cache hit 계산 방식 통일**: team/member API에서 `snap.cacheHitPct`(DB 저장값) 대신 `rawJson.tokens`에서 직접 계산 (`tRead / (tRead + tWrite + tInput) × 100`). 재싱크 없이 즉시 정확한 값 반영
- **효율 점수 재설계**: `oneShotRate × cacheHit / costPerSession` → `oneShotRate × (cacheHit/100) × outputInputRatio / costPerCall`. 6지표 중 4개 반영
- **members API rawJson 구조 버그 수정**: `rawJson.daily` 대신 `rawJson.all.daily` 읽도록 수정. 활동 히트맵 "0 activities" 문제 해결
- **관리자 전용 대시보드 뷰어**: `DashboardView` 컴포넌트로 분리, `/team/[userId]/dashboard` 페이지 신규. `lib/admin.ts` ADMIN_EMAIL 상수, members API에 `canViewFullDashboard` 플래그 추가 (서버사이드 체크)
- **ADMIN_EMAIL 콤마 구분 다중 지원**: `ADMIN_EMAIL=a@x.com,b@x.com` 형식 파싱

### 다음 액션
- Vercel 환경변수 `ADMIN_EMAIL` 설정 (프로덕션 적용)
- 재설치 (`rm -rf ~/.primus-usage-tracker` → `npx init`) 후 팀원 초대 및 랭킹 화면 검증

---

## Session 2026-04-27 14:25 — 타임존 설정, 경로 표시 개선, 카드 스크롤 UX, Efficiency 지표 2개 추가

### 작업 요약
- **E2E 검증 완료**: 탭 닫기 13:38 → 대시보드 갱신 13:39 (self-detach PASS)
- **타임존 기능 구현**: users 테이블 timezone 컬럼 추가 (Supabase migration), `/api/user/timezone` PATCH 라우트, Setup 페이지 타임존 선택 카드 (브라우저 자동 감지), 대시보드 마지막 수신 시각 timezone-aware 표시 + SGT/KST 배지 클릭으로 변경
- **타임존 배지 버그 수정**: GMT+8 대신 SGT/KST 표시 (TZ_ABBR_MAP 추가, Intl이 GMT+N 반환 시 fallback), 드롭다운 방향 위→아래 수정
- **경로 표시 개선**: By Project / Top Sessions에서 마지막 3 세그먼트만 표시, RTL ellipsis로 앞쪽 잘림
- **카드 스크롤 UX**: 15개 이하 → 배지 없음/스크롤 없음, 15개 초과 → overflow-y-auto + 카드 색상 "↕ scroll · N" 배지. By Project/Activity/Core Tools/Shell Commands/MCP 전체 적용
- **Efficiency 지표 2개 추가**: Cost/call (`$0.053`) + Output/Input ratio (`32.7×`). rawJson.tokens.output 기존 수집 확인 후 추가 수집 없이 계산. 모달(설명+방법) + 등급 배지 포함. composite grade hover에도 6개 모두 표시

### 다음 액션
- 재설치 (`rm -rf ~/.primus-usage-tracker` → `npx init`)
- Vercel 배포 결과 확인 (팀 배지 렌더링, 타임존 배지 SGT/KST)
- 팀원 초대 및 팀랭킹 화면 검증

---

## Session 2026-04-27 13:34 — submit.mjs 탭 닫기 E2E 디버그 + self-detach 설치본 적용

### 작업 요약
- debug.log 추가로 SessionEnd hook 발화 재확인 (03:38:06Z 타임스탬프 기록 → 정상 발화 확인)
- VS Code 탭 닫기 후 락 파일 잔류 확인 → 프로세스가 SIGKILL로 종료, finally 미실행으로 락 파일 남음
- 설치된 `~/.primus-usage-tracker/submit.mjs`에도 self-detach 패턴 직접 적용 (재설치 없이 즉시 반영)
- debug.log 제거, 스테일 락 파일 수동 제거
- `node ~/.primus-usage-tracker/submit.mjs` 수동 실행 → 즉시 종료 확인 (detached 자식 프로세스 백그라운드 실행 정상)

### 다음 액션
1. VS Code 탭 닫기 → 2분 대기 → 대시보드 갱신 확인 (self-detach 설치 후 E2E 최종 검증)
2. `rm -rf ~/.primus-usage-tracker` → `npx github:eugene-eee-hongkyu/ai-usage-tracker init` 재설치
3. Vercel 배포 확인 (팀 배지 렌더링)

---

## Session 2026-04-27 12:48 — submit.mjs 파이프라인 버그 진단 및 수정

### 작업 요약
- `init` 실행 시 Mac(launchd) / Windows(Task Scheduler XML) 일간 자동 동기화 자동 등록 구현 → 빌드·커밋·푸시
- Windows Task Scheduler XML에 `StartWhenAvailable` 추가 — PC 꺼진 상태에서 켜지면 즉시 실행되도록 변경
- `submit.mjs` standalone 실행 시 keytar 로드 실패로 조용히 종료되던 API 키 미전달 버그 수정 → 폴백 파일(`~/.primus-usage-key`) 항상 저장하도록 변경, 현재 키 수동 기록 후 대시보드 갱신 확인
- `SessionEnd` hook 발화 여부 확인 — debug.log 추가로 정상 발화 확인
- VS Code 탭 닫기 시 SIGKILL로 hook 프로세스가 함께 종료되어 락 파일만 남는 문제 발견 → `submit.mjs` self-detach 패턴(백그라운드 자식 프로세스로 분리) 적용 → 커밋·푸시

### 다음 액션
- 수동 실행 후 2분 뒤 대시보드 갱신 확인
- VS Code 탭 닫기 후 submit 정상 완료 재테스트


## Session 2026-04-27 10:47 — 버그 수정 및 빌드 자동화·팀 동기화 배지

### 작업 요약
- **sync.mjs 버그 재발**: `--period all` 단일 호출로 hardcoded 되어 있던 구버전 `sync.mjs`가 init 백필 시 DB를 단일 스냅샷으로 덮어씀 → 모든 기간이 전체 데이터로 표시되는 버그 재현
- **sync.mjs 수정**: 4-period 병렬 호출로 수정 후 push
- **빌드 자동화**: `cli/package.json`에 `build:sync`, `build:init` 스크립트 추가. `bun run build`로 `index.mjs`, `sync.mjs`, `init.mjs` 3개 동시 빌드 가능
- **팀 동기화 배지**: 팀 랭킹 뷰에 `lastSyncedAt` 기반 경고 배지 구현
  - 2~4일: 노란색 `N일 전`
  - 5일 이상: 빨간색 `⚠ N일 전`
  - 미수신: 빨간색 `미수신`
  - 최근: 배지 없음
- **lock TTL 검토**: 90s 유지 (codeburn 병렬 최대 60s + fetch, 타이트하지만 허용 범위)

### 다음 액션
1. Vercel 배포 확인 (팀 배지 렌더링)
2. 팀원 초대 (이메일 목록 확정 → 서비스 초대)
3. Windows SessionEnd hook 발화 검증

---

## Session 2026-04-27 10:06 — CLI UX 버그 수정 (한글 깨짐·프로세스 미종료·동시 제출)

### 작업 요약
- **한글 깨짐 수정**: `getApiKeyViaLocalServer` 응답 HTML을 영어로 교체, Content-Type에 `charset=utf-8` 추가 (init.ts, init.mjs)
- **init 후 프로세스 미종료 수정**: 브라우저 keep-alive 커넥션이 이벤트 루프를 붙잡는 문제. `runInit()` 마지막에 `process.exit(0)` 추가 (init.ts, init.mjs)
- **번들 재빌드**: `bun build src/index.ts --outfile src/index.mjs --target node` — index.mjs가 구버전 번들이었음, 두 수정사항 모두 반영
- **동시 세션 종료 문제 분석**: 4~5개 세션 동시 종료 시 submit.mjs 16개 codeburn 프로세스 + 4개 ingest 중복 POST 발생
- **lock 파일 추가 (submit.mjs)**: `~/.primus-usage-tracker/submit.lock` — TTL 90초, `try/finally`로 에러 시에도 반드시 해제
- **Q1 아키텍처 분석**: ingest가 `onConflictDoUpdate`로 단일 스냅샷 저장 → Claude Code 미실행 시 stale 데이터 그대로 유지됨. `lastSyncedAt`을 UI에 노출하면 "훅 미동작" 판단 가능

### 다음 액션
1. `rm -rf ~/.primus-usage-tracker` 후 `npx github:eugene-eee-hongkyu/ai-usage-tracker init` 재실행 (lock fix 반영된 submit.mjs 재배포)
2. 팀원 초대 (이메일 목록 확정 → Vercel/서비스 초대)
3. Windows SessionEnd hook 발화 검증

---

## Session 2026-04-27 09:41 — SessionEnd hook 버그 수정

### 작업 요약
- **버그 원인 확인**: SessionEnd hook이 `~/.npm/_npx/HASH/.../submit.mjs` 경로로 등록되어 있었음. npx 캐시 갱신/버전 변경 시 경로가 달라져 hook 무응답 발생
- **submit.mjs PATH 문제 확인**: `spawn("codeburn", ..., { shell: false })` — Claude Code hook 실행 환경에서 PATH가 제한되면 codeburn 못 찾고 조용히 종료
- **submit.mjs 단일 period 버그 확인**: `--period all` 하나만 전송하고 있었음 (sync.ts는 4개 병렬 전송 — 불일치)
- **수정 1 (init.ts)**: init 시 `~/.primus-usage-tracker/submit.mjs`로 복사 후 해당 경로를 hook에 등록. 기존 submit.mjs hook 항목 자동 제거 후 새 경로로 교체
- **수정 2 (submit.mjs)**: `shell: true`로 PATH 문제 해결. 4개 period 병렬 호출로 sync.ts와 통일
- **적용 방법 안내**: `npm cache clean --force` 후 `npx github:... init` 재실행 (y로 재설치)

### 다음 액션
1. `npm cache clean --force` 후 `npx github:eugene-eee-hongkyu/ai-usage-tracker init` 재실행해서 hook 경로 갱신
2. 팀원 초대 (이메일 목록 확정 → Vercel/서비스 초대)
3. Windows SessionEnd hook 발화 검증 (Windows 테스터 필요)

---

## Session 2026-04-27 09:21 — 대시보드 UX 세부 개선 (배지 hover·카드 순서·cache hit 공식)

### 작업 요약
- **개별 메트릭 배지 hover 툴팁**: 캐시힛/원샷/코스트/콜 각 배지에 마우스 오버 시 해당 지표 등급표+설명 표시 (w-72)
- **Efficiency 종합 배지**: "양호"일 때 hover 툴팁 없음, 나머지 등급만 표시
- **Cache hit 표준 공식 적용**: codeburn의 변형 공식(`cacheRead÷(cacheRead+input)`) → Anthropic 표준(`cacheRead÷(cacheRead+cacheWrite+input)`). raw 토큰 없으면 폴백. per-model 동일 수정. 모달에 공식 차이 주석 추가
- **대시보드 카드 순서 재배치**:
  - Row 2: By Project + By Activity (유사 정보 묶음)
  - Row 3: Top Sessions + By Model
  - Row 4: Core Tools + Shell Commands (기본 도구 묶음)
  - Row 5: MCP Servers (미설치자 고려해 하단)
- **By Project / Core Tools / Shell Commands 전체 표시**: slice 제한 및 "+N more" 버튼 제거
- **카드 헤더 아이템 수 표시**: By Project, By Activity, Core Tools, Shell Commands, MCP Servers에 `(N)` 추가
- **하단 페이드 그라디언트**: 7개 이상 아이템 시 카드 하단에 `from-neutral-900` 페이드로 "더 있음" 암시
- **Calls 최적화 팁 조건부 렌더링**: value≥100일 때만 "너무 높다면" 표시, value<10일 때만 "너무 낮다면" 표시. 자동 번호 부여
- **배포 에러 수정**: "+N more" Link 제거 후 `import Link` 미삭제로 ESLint 빌드 실패 → import 제거

### 다음 액션
1. 팀원 초대 (이메일 목록 확정 → Vercel/서비스 초대)
2. Windows SessionEnd hook 발화 검증 (Windows 테스터 필요)

---

## Session 2026-04-27 08:42 — Efficiency UX 개선 및 대시보드 카드 순서 재배치

### 작업 요약
- **"개선 필요" → "부족" 전면 교체**: GradeLevel 타입, GRADE_STYLES, 모든 grade 함수, modal 등급표 전부
- **Efficiency 종합 배지 hover 툴팁**: 4개 지표(Cache hit / One-shot / Cost / Calls) 등급 기준표를 2×2 그리드로 표시, 현재 등급 하이라이트
- **메트릭 버튼 재구성**: 기존 버튼 → 회색 "설명" 버튼(전체 모달), 보통/부족/경고 등급일 때만 인디고 액션 버튼(늘리는법/줄이는법/최적화) 추가 → 방법 섹션만 팝업
- **modal `methodsOnly` prop 추가**: 4개 modal 컴포넌트에 `methodsOnly?: boolean` 추가, true면 방법 섹션만 렌더링
- **대시보드 카드 순서 재배치**:
  - Row 1: Daily Activity + Efficiency (핵심 요약)
  - Row 2: By Project + Top Sessions (비용 상세)
  - Row 3: By Activity + By Model (사용 패턴)
  - Row 4: MCP Servers + Core Tools (도구 통계)
  - Row 5: Shell Commands (반폭)

### 다음 액션
1. 팀원 초대 (이메일 목록 확정 → Vercel/서비스 초대)
2. Windows SessionEnd hook 발화 검증 (Windows 테스터 필요)

---

## Session 2026-04-27 06:47 — 대시보드 UX 개선 (마지막 수신·Efficiency 배지·등급 한글화)

### 작업 요약
- **마지막 수신 시각 표시**: Overview Bar 우측에 `lastSyncedAt` → `MM-DD HH:mm` 포맷 표시
- **Efficiency 버튼 컬럼 정렬**: metric `w-28`, 버튼 `w-20` 고정 컬럼 분리
- **Efficiency 종합 등급 배지**: 섹션 헤더 우측에 탁월/양호/보통/개선 필요/경고 배지 (composite score)
- **지표별 개별 등급 배지 추가**: 각 행 오른쪽에 소형 배지 (cache hit / one-shot / cost / calls 각각)
- **모달 등급표 전면 한글화**: S/A/B/C/D → 탁월/양호/보통/개선 필요/경고, 현재 등급 행 색상 강조

### 다음 액션
1. 팀원 초대 (이메일 목록 확정 → Vercel/서비스 초대)
2. Windows SessionEnd hook 발화 검증


## Session 2026-04-26 21:50 — Daily Activity 스크롤 제거 및 커밋

### 작업 요약
- 대시보드 daily activity 목록의 `max-h-52 overflow-y-auto` 제거 → 스크롤 없이 전체 표시
- worklog.md / state.md 업데이트 후 커밋·푸시

### 다음 액션
- 팀원 초대
- Windows SessionEnd hook 검증


## Session 2026-04-26 19:50 — 대시보드 UX 변경 커밋·푸시

### 작업 요약
- `f985fa6` 커밋·푸시 — Period 버튼 고정 너비·Daily Activity 세로 목록·Tabs/Overview 너비 정렬 (dashboard + team)

---

## Session 2026-04-26 19:43 — codeburn migration 완료 검증 + 대시보드 UX 개선

### 작업 요약
- **codeburn migration run 완료 기준 3개 사용자 직접 검증 완료**:
  1. `npx github:eugene-eee-hongkyu/ai-usage-tracker init` → codeburn 설치 확인 + hook 등록 정상 완료
  2. CLI submit.mjs → codeburn JSON POST → 대시보드 활동별 one-shot rate, 프로젝트별 비용, Top sessions 정상 표시
  3. 팀랭킹 MVP 점수 = one-shot × cache hit / 세션당 비용 합성 점수 계산 확인
- **대시보드 UX 개선**:
  - Period 버튼 크기 통일: `px-3` 가변 → `w-16 text-center` 고정 (dashboard + team 양쪽)
  - Daily Activity 세로 목록 전환: Recharts BarChart 제거 → `날짜 | 비례 bar | cost | sessions` 행 목록 (max-h-52 스크롤, 마우스오버 없음)
  - Period Tabs / Overview Bar 너비 정렬: `max-w-6xl mx-auto` 래퍼 적용 (아래 그리드와 동일 너비)

### 다음 액션
1. 팀원 초대 (이메일 목록 확정 → Vercel/서비스 초대)
2. Windows SessionEnd hook 발화 검증 (Windows 테스터 필요)

---

## Session 2026-04-26 19:35 — 대시보드 UX 개선 (바 그래프·tip 모달·팀랭킹 period·By Activity 전체)

### 작업 요약
- **비율 기반 가로 바로 전환**: By Project, Top Sessions, By Model, MCP Servers, Core Tools, Shell Commands 6개 섹션 — opacity dot(`w-1.5 h-3.5`) → `w-16 h-1.5` 비율 fill bar
- **Efficiency tip 모달 전체 추가**:
  - Cache hit `[늘리는 법]` → `CacheHitModal` (기존 연결)
  - One-shot rate `[늘리는 법]` → `OneShotRateModal` 신규 작성
  - Cost/session `[줄이는 법]` → `CostPerSessionModal` 개선
  - Calls/session `[설명]` → `CallsPerSessionModal` 신규 작성 (양면성 솔직 명시)
  - 버튼 스타일: 회색 언더라인 → `TipBtn` indigo pill (`bg-indigo-600 text-white`)
- **팀랭킹 period 필터 추가**: 오늘/이번주/이번달/전체 탭 — team page + team API
  - API: `?period=` 파라미터, `all`은 mirror 컬럼 사용, 나머지는 rawJson에서 기간별 추출
  - 해당 기간 세션 0인 멤버 랭킹 제외
- **By Activity 전체 항목 표시**: `oneShotRate != null` 필터 제거 → 10개 모두 표시
  - 컬럼 재설계: `[cost bar] | activity | cost | turns | 1-shot%`
  - `sessions` → `turns` 필드명 정정

### 다음 액션
1. multi-period re-sync 실행 → period별 데이터 표시 검증 (run 완료 기준 #2)
2. `npx github:eugene-eee-hongkyu/ai-usage-tracker init` 실행 → codeburn 설치 + hook 등록 확인 (run 완료 기준 #1)
3. 팀원 초대 및 팀랭킹 화면 검증

---

## Session 2026-04-26 19:06 — 대시보드 codeburn 스키마 완전 정합 + 기간별 데이터 + UI 전면 재설계

### 작업 요약
- **npx sync 충돌 수정**: `program.parse()` → `program.parse(process.argv)`, CLI 번들 재빌드
- **toFixed crash 수정**: `dashboard/route.ts`, `members/[userId]/route.ts`에서 `projects`/`topSessions` 필드 `?? 0` 정규화
- **codeburn 실제 스키마 정합** (Supabase 직접 조회로 확인):
  - `summary` → `overview`, `totalCost` → `cost`, `cacheHitPct` → `cacheHitPercent` (0-100 스케일)
  - `activities[].name` → `category`, `sessions` → `turns`, `oneShotRate` 0-100 → 0-1 정규화
  - `projects[]` `avgCost` 없음 → `cost/sessions` 직접 계산
  - `topSessions[]` `id` → `sessionId`, `turns` → `calls`
  - Supabase SQL로 기존 스냅샷 컬럼 (`total_cost`, `sessions_count`, `cache_hit_pct`, `overall_one_shot`) 재계산 업데이트
- **multi-period sync 구현**: `sync.ts`에서 codeburn 4번 병렬 호출 (`today/week/month/all`)
  - rawJson 구조: `{ today: {...}, week: {...}, month: {...}, all: {...} }`
  - 기존 flat 포맷 하위호환 유지 (`getPeriodData` fallback)
  - codeburn `--period week` vs `--period all` 실제로 다른 데이터 리턴 확인 (week $769 vs all $1395)
- **dashboard API 전면 재작성**: `overview` 기반, `projectPath` 조회맵, `oneShotRate` period별 계산
- **대시보드 UI codeburn 스타일 전면 재설계**:
  - `bg-neutral-950` 다크 테마, `font-mono`, 섹션별 색상 좌측 border
  - 레이아웃: Overview bar → Daily+Project 2열 → Top Sessions 전체폭 → Efficiency+Activity 2열
  - 경로 포매팅: `/Users/xxx/` prefix 제거 표시
- **4개 섹션 추가**: By Model (cache% 토큰 계산), MCP Servers, Core Tools, Shell Commands
- **Efficiency 섹션 상단 정렬** 수정 (테이블 레이아웃)

### 실패한 시도
- multi-period sync 후 "아직 같다" → DB 확인 결과 이전 single-period 데이터 잔류, re-sync 필요 상태

### 다음 액션
1. `npm cache clean --force` + `npx sync` 재실행 → period별 데이터 DB 저장 확인 (오늘/이번주/이번달/전체 각기 다른 값)
2. Vercel 재배포 후 대시보드 전체 UI 확인
3. 팀랭킹 efficiencyScore 검증 (run 완료 기준 #3)

---

## Session 2026-04-26 18:08 — 파비콘 적용, 대시보드 버그 수정, npx 구버전 캐시 문제 해결

### 작업 요약
- **파비콘 적용**: `docs/favicon/` 커밋, `web/public/` 복사, `layout.tsx` metadata icons 설정
- **대시보드 클라이언트 에러 수정**: API 500 → `data.user` undefined crash
  - `fetchError` state 추가, 에러 시 "다시 시도" 버튼 표시
  - `neverSynced` 조건: `!lastSyncedAt || !summary` — summary null일 때 crash 방지
  - 신규 사용자(`!lastSyncedAt`) → `/setup` 자동 리다이렉트
  - 기존 사용자 snapshot 없음(`!summary`) → sync 명령어 + 복사 버튼 화면
- **Setup 페이지 체크 단계 2개로 정리**: Node 18+/keytar 제거, hook 등록 + 첫 데이터 수신 유지. API steps 객체→배열 변환 버그 수정
- **Nav 버그 수정**: 로그아웃 드롭다운 두 줄 → `whitespace-nowrap` 추가
- **모바일 반응형**: 효율지표 `grid-cols-2 sm:grid-cols-4`, 팀랭킹 `grid-cols-1 sm:grid-cols-3`, 멤버 프로필 `grid-cols-2 sm:grid-cols-4`, Nav 브랜드명 모바일 숨김
- **"동기화 필요" 화면 개선**: Nav → 미니멀 헤더(로그아웃만), 복사 버튼 추가
- **npx 구버전 캐시 원인 분석 및 수정**:
  - 루트 `package.json` bin이 `./cli/bin/cli.mjs` (ccusage 기반 구버전) 가리키던 것 발견
  - `./cli/src/index.mjs` (codeburn 기반 신버전)로 수정
  - 루트 버전 0.1.0 → 0.2.0 bump (캐시 무효화)
  - Supabase 0값 스냅샷 삭제 (구버전 sync가 summary 없는 포맷으로 저장했던 것)

### 실패한 시도
- `npx --force github:... sync` 재실행 → 여전히 구버전 실행 (루트 package.json bin이 원인이었으나 그 이전에 시도)
- `npm cache clean --force` 안내했으나 실제 원인은 루트 bin 항목이었음

### 다음 액션
1. `npm cache clean --force` 후 `npx github:eugene-eee-hongkyu/ai-usage-tracker sync` 재실행 → "codeburn 데이터 수집 중..." 메시지 확인 후 대시보드 데이터 표시 검증 (run 완료 기준 #2)
2. `npx github:eugene-eee-hongkyu/ai-usage-tracker init` 실행 → codeburn 설치 확인 + hook 등록 정상 완료 확인 (run 완료 기준 #1)
3. 팀랭킹 `/api/team` efficiencyScore 필드 확인 (run 완료 기준 #3)

---

## Session 2026-04-26 17:17 — codeburn migration 16단계 전체 구현 완료

### 작업 요약
- **DB 스키마 교체**: `sessions/dailyAgg/suggestionFeedback` 제거, `userSnapshots` (JSONB + mirror 5cols) 추가
- **Supabase 마이그레이션 SQL 실행** (`docs/migration.sql`) — 사용자가 직접 실행 완료
- **ingest API**: codeburn JSON 통째로 저장, `overallOneShot` 활동 가중 평균 계산
- **dashboard API**: `rawJson.daily[]` 날짜 필터, activities/projects/topSessions 반환
- **team API**: mirror 컬럼으로 3개 순위 (정확도/효율/활동), `efficiencyScore = overallOneShot × cacheHitPct / costPerSession`
- **setup/status API**: `user_snapshots` 존재 여부로 교체
- **members API**: cost 기반 heatmap 레벨, 프로젝트 cost 정렬
- **rules 정리**: `generateSuggestions` 제거, `computeEfficiencyScore` 시그니처 교체
- **대시보드 UI**: 비용 차트, 효율 4지표, 활동별 one-shot, 프로젝트, top sessions
- **대시보드 detail**: 프로젝트 목록 + `codeburn optimize` 터미널 안내 카드
- **팀랭킹 UI**: 3카드 (최고 정확도/최고 효율/최다 활동), MVP 새 공식
- **멤버 프로필**: cost 기반 heatmap (0/$0.5/$2/$5 경계), 프로젝트 cost 정렬
- **CLI init**: `codeburn` 설치 확인 + npm install -g 자동 설치 옵션 추가
- **CLI submit/sync**: `ccusage daily --json` → `codeburn report --format json --provider claude --period all` 교체
- **CLI 번들 재빌드**: `bun build` index/init/sync 3개 번들
- **Vercel push**: `git push` 자동 배포 완료
- **Vercel `ALLOWED_EMAIL_DOMAINS` 업데이트**: 사용자 완료
- **feedback/route.ts**: `suggestionFeedback` 참조 제거 (no-op 응답으로 교체)
- `tsc --noEmit` 타입 체크 통과

### 다음 액션
1. `npx github:eugene-eee-hongkyu/ai-usage-tracker sync` 실행 → 대시보드 데이터 확인 (run 완료 기준 검증)
2. 팀원 초대 및 팀랭킹 화면 검증
3. Windows SessionEnd hook 발화 검증 (Hold)

---

## Session 2026-04-26 16:58 — codeburn migration kickoff + 차트 툴팁 개선

### 작업 요약
- codeburn 실제 JSON 출력 분석 (`overview`, `daily`, `activities`, `projects`, `topSessions`, `models`, `tools`, `mcpServers`)
- 제안 검토: ccusage → codeburn 교체 타당성 확인, 3가지 제약 발견 (optimize JSON 미지원 / daily 토큰 없음 / planning rate 변별력 없음)
- DB 재설계 확정: 2-table JSONB (users + user_snapshots), mirror columns 5개
- 합성 MVP 점수 업데이트 결정: `one-shot × cache hit / 세션당 비용`
- 대시보드 차트 툴팁에 cache hit%, 세션당 비용 추가 (`dashboard/page.tsx`) — Vercel 배포됨
- codeburn migration run kickoff (`docs/runs/2026-04-26-codeburn-migration_run.md`)
- bypassPermissions 모드 전환

### 다음 액션
1. codeburn migration 구현 시작 (16단계, run 파일 참조)

---

## Session 2026-04-26 15:59 — worklog 정리 및 상태 파일 커밋

### 작업 요약
- worklog.md 상단 잘못된 자동 생성 항목을 올바른 세션 내용으로 교체
- state.md 업데이트 후 관련 harness 파일들 git add → commit → push

### 다음 액션
- Vercel 환경변수 `ALLOWED_EMAIL_DOMAINS` 프로덕션 업데이트 (수동)
- 팀원에게 프로덕션 URL 공유 및 초대
- Windows SessionEnd hook 발화 검증

---

## Session 2026-04-26 15:49 — 오늘 데이터 0 버그 수정 (ingest + CLI sync)

### 작업 요약
- **버그 원인 분석**: `ccusage daily`로 오늘(04-26) 데이터가 있음에도 대시보드 "오늘" 탭이 0을 표시
  - 원인: SessionEnd hook 첫 발화 시 JSONL race condition → 0토큰으로 삽입 → `onConflictDoNothing`이 이후 정확한 데이터 업데이트 차단
- **`api/ingest/route.ts` 수정**: `.onConflictDoNothing()` → `.onConflictDoUpdate(...)` — hook 발화마다 최신값으로 갱신
- **CLI `sync` 오류 수정**: `program.parse()` → `program.parse(process.argv)` — 번들 환경에서 commander가 process.argv를 자동 감지 실패
- CLI 번들 재빌드 후 커밋·푸시, 사용자 확인: 수정 후 오늘 데이터 정상 표시

### 다음 액션
1. Vercel 환경변수 `ALLOWED_EMAIL_DOMAINS` 프로덕션 업데이트 (수동)
2. 팀원에게 프로덕션 URL 공유 및 초대

---

## Session 2026-04-26 02:07 — 팀랭킹 탭 전환 dimming + 5h utilization 보류

### 작업 요약
- 팀랭킹 탭 전환 dimming 구현 (대시보드와 동일 패턴)
- **5h utilization 구현 안 함** (사용자 명시 결정): ccusage JSONL에 플랜 정보 없음, `activeHours` 하드코딩 0

---

## Session 2026-04-25 21:10 — 대시보드 UI 버그 수정 6배치 + B-2 Vercel+Supabase 배포

### 작업 요약
- 차트 정렬/타임존/토큰 집계/출력밀도/활성일수/지표 교체 버그 수정
- `mcp_unused` 룰 삭제, `low_utilization` 가드 추가
- Vercel + Supabase 배포 완료 (ai-usage-tracker-web-psi.vercel.app)
- GitHub OAuth App + NEXTAUTH_URL + CLI SERVER_URL 프로덕션 도메인 업데이트

---

## Session 2026-04-25 19:15 — CLI npx 실행 오류 수정 및 UX 개선

### 작업 요약
- `dashboard/page.tsx` CTA, `setup/page.tsx` 2단 카드, `auth.ts` 다중 도메인 지원
- CLI: root package.json bin 엔트리, `.mjs` 전환, bun 번들 (keytar 외부)

---

## Session 2026-04-25 18:17 — B-1 MVP 전체 빌드 완료 및 깃허브 푸시

### 작업 요약
- B-1 §5 빌드 순서 20단계 완료 (53개 파일 커밋·푸시)
