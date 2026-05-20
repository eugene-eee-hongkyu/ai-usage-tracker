"use client";

import { useState } from "react";
import { TeamView } from "@/components/team-view";
import { TeamRanking } from "@/components/team-ranking";

type Tab = "team" | "ranking";

export default function AdminTeamPage() {
  const [tab, setTab] = useState<Tab>("team");

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 border-b border-slate-800 -mt-2">
        <TabButton active={tab === "team"} onClick={() => setTab("team")}>
          내 팀
        </TabButton>
        <TabButton active={tab === "ranking"} onClick={() => setTab("ranking")}>
          랭킹
        </TabButton>
      </nav>
      {tab === "team" && <TeamView adminMode={true} />}
      {tab === "ranking" && <TeamRanking />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm border-b-2 transition-colors ${
        active
          ? "border-indigo-500 text-slate-100"
          : "border-transparent text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
