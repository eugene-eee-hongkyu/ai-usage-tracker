"use client";

export const dynamic = "force-dynamic";

import { TeamView } from "@/components/team-view";
import { ViewAsBanner } from "@/components/view-as-banner";

export default function TeamPage() {
  return (
    <>
      <ViewAsBanner />
      <TeamView adminMode={false} />
    </>
  );
}
