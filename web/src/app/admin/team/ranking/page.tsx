// /admin/team/ranking — admin layout sub-nav 의 [랭킹] 탭.
// TeamView 와 같은 위계 — 자기 팀 보기 / 다른 팀과 비교 보기.
// 2026-05-30: AdminNav (amber bar) 제거, admin layout 의 평탄한 5 탭으로 통합.

"use client";

export const dynamic = "force-dynamic";

import { TeamRanking } from "@/components/team-ranking";

export default function AdminTeamRankingPage() {
  return <TeamRanking />;
}
