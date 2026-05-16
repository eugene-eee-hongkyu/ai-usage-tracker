// 영어 메시지 catalog. 새 locale 추가 시 ko.ts 처럼 Messages 를 import 해서 구조 유지.
// 누락 키는 컴파일러가 잡아줌 (타입 강제).

export interface Messages {
  wizard: {
    title: string;
    step1: {
      heading: string;
      lead: string;
      legacyFound: string;
      legacyNotFound: string;
    };
    destinations: {
      heading: string;
      hint: string;
      localOnly: string;
      localAndCompany: string;
      companyOnly: string;
    };
    actions: {
      continue: string;
      back: string;
      openDashboard: string;
      retry: string;
    };
    saving: string;
    saved: string;
    error: string;
  };
}

export const en: Messages = {
  wizard: {
    title: "AI Usage Tracker — Setup",
    step1: {
      heading: "Welcome",
      lead: "This tool collects your Claude Code usage locally and shows it on a dashboard.",
      legacyFound: "We detected an existing company server connection on this machine.",
      legacyNotFound: "No existing company server connection was found.",
    },
    destinations: {
      heading: "Where should the data go?",
      hint: "You can change this later by editing ~/.usage-tracker/config.json.",
      localOnly: "Local only — 100% private, never leaves this computer",
      localAndCompany: "Local + Company server — both kept in sync (recommended for team members)",
      companyOnly: "Company server only — same as before, no local DB",
    },
    actions: {
      continue: "Continue",
      back: "Back",
      openDashboard: "Open Dashboard",
      retry: "Retry",
    },
    saving: "Saving…",
    saved: "Setup complete!",
    error: "Something went wrong",
  },
};
