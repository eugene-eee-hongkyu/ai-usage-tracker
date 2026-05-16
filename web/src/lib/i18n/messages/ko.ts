import type { Messages } from "./en";

export const ko: Messages = {
  wizard: {
    title: "AI Usage Tracker — 셋업",
    step1: {
      heading: "환영합니다",
      lead: "Claude Code 사용량을 이 PC 에서 직접 수집하고 대시보드로 보여드립니다.",
      legacyFound: "이미 회사 서버에 연결된 흔적을 발견했습니다.",
      legacyNotFound: "기존 회사 서버 연결이 없습니다.",
    },
    destinations: {
      heading: "데이터를 어디에 저장할까요?",
      hint: "나중에 ~/.usage-tracker/config.json 을 직접 편집해서 바꿀 수 있습니다.",
      localOnly: "이 PC 에만 저장 — 100% 비공개, 외부로 전송 안 함",
      localAndCompany: "이 PC + 회사 서버 — 양쪽 동시 동기화 (회사 팀원용 권장)",
      companyOnly: "회사 서버만 — 기존과 동일, 로컬 DB 미사용",
    },
    actions: {
      continue: "계속",
      back: "뒤로",
      openDashboard: "대시보드 열기",
      retry: "다시 시도",
    },
    saving: "저장 중…",
    saved: "셋업 완료!",
    error: "문제가 발생했습니다",
  },
};
