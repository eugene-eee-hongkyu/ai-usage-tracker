// 영어 카탈로그 — base 타입. 다른 locale 은 Messages 를 import 해서 구조 유지.

export interface Messages {
  brand: string;
  nav: {
    personal: string;
    team: string;
    setup: string;
    logout: string;
  };
  dashboard: {
    loading: {
      title: string;
      body1: string;
      body2: string;
      polling: string;
    };
    cards: {
      myCost: string;
      unitCost: string;
      unitCostHint: string;
    };
    syncNeeded: {
      title: string;
      body: string;
      copy: string;
    };
  };
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
  brand: "AI Usage Tracker",
  nav: {
    personal: "Personal",
    team: "Team",
    setup: "Setup",
    logout: "Logout",
  },
  dashboard: {
    loading: {
      title: "Collecting data",
      body1: "codeburn and ccusage are running in the background.",
      body2: "It usually takes 30 seconds to 1 minute.",
      polling: "Auto-refreshing every 5 seconds…",
    },
    cards: {
      myCost: "My Cost",
      unitCost: "Daily Unit Cost ($ / 1M)",
      unitCostHint: "Lower = better plan utilization · No-activity days break the line · log scale",
    },
    syncNeeded: {
      title: "sync needed",
      body: "Run the command below in your terminal.",
      copy: "Copy",
    },
  },
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
