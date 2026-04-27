"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { DashboardView } from "@/components/dashboard-view";
import { isAdmin } from "@/lib/admin";

export default function AdminMemberDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated" && !isAdmin(session?.user?.email ?? "")) {
      router.push(`/team/${userId}`);
    }
  }, [status, session, router, userId]);

  if (status === "loading") return null;
  if (!isAdmin(session?.user?.email ?? "")) return null;

  return <DashboardView targetUserId={userId} />;
}
