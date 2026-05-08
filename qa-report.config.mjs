// qa-report.config.mjs
// QA 리포트 생성 시 프로젝트별 설정.
// scripts/generate-qa-report.mjs가 이 파일을 읽어 브랜드명·모듈 목록·링크를 적용한다.
//
// 이 파일을 새 프로젝트에 복사한 뒤 brand/modules만 수정하면 동일한 디자인의 리포트가 생성된다.

export default {
  // ── 브랜드 ────────────────────────────────────────────────────
  brand: {
    name: 'Anchor',            // Topbar + Footer에 표시
    subtitle: 'QA Report',     // 브랜드 우측 작은 텍스트
    initial: 'A',              // 좌상단 사각 마크 글자 (단일 영문)
  },

  // ── 모듈 목록 ─────────────────────────────────────────────────
  // id: docs/qa·spec의 TC-ID prefix (예: AUTH-1-01 → 'AUTH')
  // label: 리포트에 표시되는 한글 설명
  // 순서가 그대로 리포트 표시 순서가 된다.
  modules: [
    { id: 'AUTH',    label: '로그인 / 회원가입' },
    { id: 'MY',      label: '내 정보' },
    { id: 'HOME-TP', label: '홈·GNB·알림 (납세자)' },
    { id: 'HOME-TA', label: '홈·GNB·알림 (세무사)' },
    { id: 'TA',      label: '세무대리인 찾기' },
    { id: 'GO',      label: '현직 공무원 탐색' },
    { id: 'EO',      label: '전직 공무원 찾기' },
    { id: 'EI',      label: '전문 이력 관리' },
    { id: 'ER',      label: '전문 이력 리포트' },
    { id: 'SP',      label: '구독 관리' },
    { id: 'TF',      label: '법인&팀연동관리' },
  ],

  // ── 외부 링크 ─────────────────────────────────────────────────
  // Topbar 버튼 + Footer 링크에 사용. 상대 경로 권장.
  links: {
    e2e: './index.html',
    playwright: './detail/index.html',
  },
};
