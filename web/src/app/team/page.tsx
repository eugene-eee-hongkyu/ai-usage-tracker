"use client";

export const dynamic = "force-dynamic";

import { TeamView } from "@/components/team-view";

export default function TeamPage() {
  return <TeamView adminMode={false} />;
}
