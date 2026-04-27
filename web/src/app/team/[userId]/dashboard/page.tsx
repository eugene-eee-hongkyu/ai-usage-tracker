"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { DashboardView } from "@/components/dashboard-view";
import { ADMIN_EMAIL } from "@/lib/admin";

export default function AdminMemberDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated" && session?.user?.email !== ADMIN_EMAIL) {
      router.push(`/team/${userId}`);
    }
  }, [status, session, router, userId]);

  if (status === "loading") return null;
  if (session?.user?.email !== ADMIN_EMAIL) return null;

  return <DashboardView targetUserId={userId} />;
}
