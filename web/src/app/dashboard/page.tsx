"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { DashboardView } from "@/components/dashboard-view";

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardView />
    </Suspense>
  );
}
