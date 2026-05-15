"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { isAdmin } from "@/lib/admin";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated" && !isAdmin(session?.user?.email ?? "")) {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  if (status === "loading") return null;
  if (status === "authenticated" && !isAdmin(session?.user?.email ?? "")) return null;

  return <>{children}</>;
}
