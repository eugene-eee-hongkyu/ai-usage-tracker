"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { DashboardView } from "@/components/dashboard-view";
import { PolicyBanner } from "@/components/policy-banner";
import { TransparencyCard } from "@/components/transparency-card";
import { PageFooter } from "@/components/page-footer";

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      {/* admin-v1 M5: 사내 trust 카드 — IC 가 보는 dashboard. admin 권한 무관. */}
      <PolicyBanner />
      <DashboardView />
      <div className="bg-neutral-950 px-4 pb-12">
        <div className="max-w-6xl mx-auto">
          <TransparencyCard />
        </div>
      </div>
      <PageFooter screen="dashboard" />
    </Suspense>
  );
}
