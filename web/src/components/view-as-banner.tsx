"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

// Platform Admin view-as 모드 alert banner — viewAsTeamId 있으면 표시,
// 없으면 null. admin/platform-admin layout 의 banner 와 동일 스타일.
// 다른 페이지 (/team, /team/[userId]) 에서도 view-as 모드는 cookie 유지
// 되므로 같은 banner 노출해야 사용자가 "지금 다른 팀 보고 있다" 인지.
export function ViewAsBanner() {
  const { data: session } = useSession();
  const [exiting, setExiting] = useState(false);
  const u = session?.user as {
    viewAsTeamId?: number | null;
    viewAsTeamName?: string | null;
  } | undefined;
  const viewAsTeamId = u?.viewAsTeamId ?? null;
  const viewAsTeamName = u?.viewAsTeamName ?? null;
  if (!viewAsTeamId || !viewAsTeamName) return null;

  async function handleExitView() {
    if (exiting) return;
    setExiting(true);
    try {
      await fetch("/api/admin/platform/exit-view", { method: "POST" });
      window.location.reload();
    } finally {
      setExiting(false);
    }
  }

  return (
    <div
      role="alert"
      data-testid="view-as-banner"
      className="bg-orange-600/90 border-b border-orange-800 px-4 py-2 flex items-center justify-between text-sm"
    >
      <span className="text-orange-50 font-medium">
        Platform view-as: <span className="font-bold">{viewAsTeamName}</span>
        <span className="ml-2 text-orange-200/80 text-xs">
          이 화면의 모든 admin 액션은 <b>{viewAsTeamName}</b> 팀에 적용됩니다.
        </span>
      </span>
      <button
        onClick={handleExitView}
        disabled={exiting}
        className="px-3 py-1 rounded bg-orange-800 hover:bg-orange-900 text-orange-50 text-xs font-medium disabled:opacity-50"
      >
        {exiting ? "Exiting…" : "Exit view"}
      </button>
    </div>
  );
}
