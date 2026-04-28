"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { DashboardView } from "@/components/dashboard-view";

const LS_KEY = "teamMemberSelectedUserId";

export default function MemberPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated" && !isAdmin(session?.user?.email ?? "")) {
      router.push("/dashboard");
    }
  }, [status, session, router]);

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

  if (status === "loading" || selectedId === null) return null;
  if (!isAdmin(session?.user?.email ?? "")) return null;

  return <DashboardView targetUserId={selectedId} onMemberSelect={handleMemberSelect} />;
}
