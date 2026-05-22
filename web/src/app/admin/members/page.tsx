"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { DashboardView } from "@/components/dashboard-view";

const LS_KEY = "teamMemberSelectedUserId";

// admin/members — 어드민이 멤버별 dashboard 를 view-only 로 본다.
// 기본 선택 로직 (view-as 안전): /api/team 으로 effective team 의 멤버 리스트를 받아
//   1) localStorage 저장 값이 멤버 리스트 안에 있으면 그것
//   2) 본인 (session.user.id) 이 멤버 리스트 안에 있으면 본인
//   3) 첫 번째 멤버
//   4) 멤버 리스트 비어 있으면 본인 (빈 dashboard)
// view-as 모드에서 본인이 그 팀 멤버가 아니라 본인 id 로 fallback 하면 dashboard
// API 가 cross-tenant 차단으로 404 반환 → "데이터 로드 실패". 그걸 방지하는 게 핵심.

export default function AdminMembersPage() {
  const { data: session, status } = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated" || !session) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/team");
        const d = (await r.json()) as { byEfficiency?: Array<{ userId: string | number }> };
        const memberIds = new Set((d.byEfficiency ?? []).map((m) => String(m.userId)));
        const myId = String((session.user as { id?: number }).id ?? "");
        const saved = (() => {
          try { return localStorage.getItem(LS_KEY); } catch { return null; }
        })();
        const pick =
          saved && memberIds.has(saved) ? saved :
          memberIds.has(myId) ? myId :
          memberIds.size > 0 ? memberIds.values().next().value! :
          myId;
        if (!cancelled) {
          setSelectedId(pick);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setSelectedId(String((session.user as { id?: number }).id ?? ""));
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [status, session]);

  const handleMemberSelect = (userId: string) => {
    setSelectedId(userId);
    try { localStorage.setItem(LS_KEY, userId); } catch {}
  };

  if (loading || selectedId === null) return null;

  return (
    <DashboardView
      targetUserId={selectedId}
      onMemberSelect={handleMemberSelect}
      storageKey="member_period"
      adminMode={true}
    />
  );
}
