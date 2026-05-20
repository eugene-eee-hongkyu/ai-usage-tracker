// /admin/team/ranking — admin 의 AdminNav (amber bar) 의 [랭킹] 탭.
// TeamView 와 같은 위계 — 자기 팀 보기 / 다른 팀과 비교 보기.

"use client";

export const dynamic = "force-dynamic";

import { AdminNav } from "@/components/admin-nav";
import { TeamRanking } from "@/components/team-ranking";

export default function AdminTeamRankingPage() {
  return (
    <div className="min-h-screen bg-neutral-950">
      <AdminNav />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <TeamRanking />
      </main>
    </div>
  );
}
