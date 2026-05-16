"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { useLocalMode } from "@/lib/use-local-mode";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isLocalMode = useLocalMode();

  useEffect(() => {
    if (isLocalMode === null) return;
    // 로컬 모드는 단일 사용자라 admin 영역도 그대로 통과 (멤버 관리 의미 없음)
    if (isLocalMode) return;
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated" && !isAdmin(session?.user?.email ?? "")) {
      router.push("/dashboard");
    }
  }, [status, session, router, isLocalMode]);

  if (isLocalMode) return <>{children}</>;
  if (status === "loading" || isLocalMode === null) return null;
  if (status === "authenticated" && !isAdmin(session?.user?.email ?? "")) return null;

  return <>{children}</>;
}
