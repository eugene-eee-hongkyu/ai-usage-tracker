// admin-v1: /admin/* 공통 layout.
// 4개 페이지 좌측 nav: Users / Audit / Team / Settings.
// 권한별 분기 — Membership-Admin / Billing-Admin / Owner.

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useLocalMode } from "@/lib/use-local-mode";
import { usePermissions } from "@/lib/use-permissions";
import { Nav } from "@/components/nav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const isLocalMode = useLocalMode();
  const { isAnyAdmin, isMembershipAdmin, isBillingAdmin, isOwner, loading } = usePermissions();

  useEffect(() => {
    if (isLocalMode === null) return;
    if (isLocalMode) return;  // LOCAL_MODE 는 단일 사용자라 admin 영역 의미 없으나 통과
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated" && !isAnyAdmin && !loading) {
      router.push("/dashboard");
    }
  }, [status, isAnyAdmin, isLocalMode, loading, router]);

  if (isLocalMode) return <>{children}</>;
  if (status === "loading" || isLocalMode === null || loading) return null;
  if (status === "authenticated" && !isAnyAdmin) return null;

  const tabs: Array<{ href: string; label: string; visible: boolean }> = [
    { href: "/admin/users", label: "Users", visible: isMembershipAdmin },
    { href: "/admin/audit", label: "Audit", visible: isOwner },
    { href: "/admin/team", label: "Team", visible: isBillingAdmin },
    { href: "/admin/settings", label: "Settings", visible: isOwner },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Nav />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-3">
          <span className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
            Admin
          </span>
          <span className="text-slate-700">/</span>
          {tabs
            .filter((t) => t.visible)
            .map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`text-sm px-3 py-1 rounded transition-colors ${
                  path.startsWith(t.href)
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.label}
              </Link>
            ))}
        </div>
        {children}
      </div>
    </div>
  );
}
