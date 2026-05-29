"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { DashboardView } from "@/components/dashboard-view";
import { PolicyBanner } from "@/components/policy-banner";
import { TransparencyCard } from "@/components/transparency-card";
import { PageFooter } from "@/components/page-footer";
import { track, EVENTS } from "@/lib/analytics/mixpanel";

// /dashboard = "본인" 화면. Platform Admin 이 다른 팀 view-as 상태로 여기
// 들어오면 본인 데이터가 view-as 팀 scope 라 빈 화면 + 옛 admin 배너가
// misleading. 옛 동작은 자동 exit-view + reload 였지만 사용자 의도와 어긋남
// (의도적으로 view-as 중인데 개인 들어왔다고 자동 풀림 = 다시 진입해야).
// 새 동작: 안내 화면 + 수동 Exit view 버튼.
function ViewAsBlockedNotice({ teamName }: { teamName: string | null }) {
  const [exiting, setExiting] = useState(false);
  async function exitView() {
    setExiting(true);
    try {
      await fetch("/api/admin/platform/exit-view", { method: "POST" });
      window.location.reload();
    } catch {
      setExiting(false);
    }
  }
  return (
    <main data-testid="dashboard-view-as-blocked" className="max-w-2xl mx-auto px-4 py-16 text-center space-y-5">
      <p className="text-5xl">🔒</p>
      <h1 className="text-lg font-semibold text-slate-100">
        개인 화면은 본인 팀에서만 볼 수 있습니다
      </h1>
      <p className="text-sm text-slate-400 font-mono leading-relaxed">
        현재 Platform Admin view-as 모드로{" "}
        {teamName ? <span className="text-amber-300 font-bold">{teamName}</span> : "다른 팀"}{" "}
        팀을 보고 있는 중입니다.<br />
        본인 개인 화면을 보려면 먼저 Exit view 로 원래 팀으로 돌아가세요.
      </p>
      <div className="pt-2">
        <button
          type="button"
          onClick={exitView}
          disabled={exiting}
          className="text-sm font-mono font-bold bg-orange-700 hover:bg-orange-600 text-orange-50 px-5 py-2 rounded disabled:opacity-50"
        >
          {exiting ? "Exiting…" : "Exit view (원래 팀으로 복귀)"}
        </button>
      </div>
      <p className="text-xs text-slate-500 font-mono pt-2">
        view-as 모드는 의도적으로 유지됩니다 — admin/팀/플랫폼 어드민 화면은 그대로 보입니다.
      </p>
    </main>
  );
}

function DashboardRouter() {
  const { data: session, status } = useSession();
  if (status !== "authenticated") {
    return <DashboardView />;
  }
  const u = session?.user as {
    viewAsTeamId?: number | null;
    viewAsTeamName?: string | null;
  } | undefined;
  if (u?.viewAsTeamId) {
    return <ViewAsBlockedNotice teamName={u.viewAsTeamName ?? null} />;
  }
  return (
    <>
      {/* admin-v1 M5: 사내 trust 카드 — IC 가 보는 dashboard. admin 권한 무관. */}
      <PolicyBanner />
      <DashboardView />
      <div className="bg-neutral-950 px-4 pb-12">
        <div className="max-w-6xl mx-auto">
          <TransparencyCard />
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  // dashboard_view — mount 시 1회. DashboardRouter 안에서 session 전환에 따라
  // DashboardView 가 unmount/remount 되어도 outer page 는 그대로 → 중복 회피.
  useEffect(() => {
    track(EVENTS.DASHBOARD_VIEW);
  }, []);

  return (
    <Suspense fallback={null}>
      <DashboardRouter />
      <PageFooter screen="dashboard" />
    </Suspense>
  );
}
