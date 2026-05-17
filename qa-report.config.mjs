// qa-report.config.mjs — ai-usage-tracker
// scripts/generate-qa-report.mjs 가 읽어 브랜드명·모듈 목록·링크를 적용한다.

export default {
  // ── 브랜드 ────────────────────────────────────────────────────
  brand: {
    name: 'z21labs Usage',
    subtitle: 'QA Report',
    initial: 'Z',
  },

  // ── 모듈 목록 ─────────────────────────────────────────────────
  // id: docs/qa·spec 의 TC-ID prefix (예: LO-0-01 → 'LO')
  // 순서가 그대로 리포트 표시 순서.
  modules: [
    { id: 'LO', label: '로그인' },
    { id: 'SU', label: '셋업' },
    { id: 'DB', label: '대시보드 (공유 — #3·#6·#7)' },
    { id: 'TM', label: '팀 랭킹' },
    { id: 'TP', label: '멤버 프로필' },
    { id: 'SS', label: '셋업 상태' },
  ],

  // ── 외부 링크 ─────────────────────────────────────────────────
  links: {
    e2e: './index.html',
    playwright: './detail/index.html',
  },
};
