"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { DashboardView } from "@/components/dashboard-view";

const LS_KEY = "teamMemberSelectedUserId";

export default function AdminMembersPage() {
  const { data: session } = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const myId = String((session.user as { id?: number }).id ?? "");
    const saved = localStorage.getItem(LS_KEY);
    setSelectedId(saved && saved !== "" ? saved : myId);
  }, [session]);

  const handleMemberSelect = (userId: string) => {
    setSelectedId(userId);
    localStorage.setItem(LS_KEY, userId);
  };

  if (selectedId === null) return null;

  return (
    <DashboardView
      targetUserId={selectedId}
      onMemberSelect={handleMemberSelect}
      storageKey="member_period"
      adminMode={true}
    />
  );
}
