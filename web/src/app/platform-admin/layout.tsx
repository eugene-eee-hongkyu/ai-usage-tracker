// /platform-admin/* 공통 layout — Platform Admin (ADMIN_EMAIL env 화이트리스트) 전용.
// 2026-05-22 어드민 / 플랫폼 어드민 화면 분리 결정으로 신설.
//   /admin/*           : 어드민 (Team Owner / Membership Admin / Billing Admin) — 자기 팀 운영
//   /platform-admin/*  : 플랫폼 어드민 (ADMIN_EMAIL) — 모든 팀 / 전체 시스템
// 탭: Audit / Settings.

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useLocalMode } from "@/lib/use-local-mode";
import { usePermissions } from "@/lib/use-permissions";
import { Nav } from "@/components/nav";
import { ViewAsBanner } from "@/components/view-as-banner";

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const isLocalMode = useLocalMode();
  const { isPlatformAdmin, loading } = usePermissions();

  useEffect(() => {
    if (isLocalMode === null) return;
    if (isLocalMode) return;
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated" && !isPlatformAdmin && !loading) {
      router.push("/dashboard");
    }
  }, [status, isPlatformAdmin, isLocalMode, loading, router]);

  if (isLocalMode) return <>{children}</>;
  if (status === "loading" || isLocalMode === null || loading) return null;
  if (status === "authenticated" && !isPlatformAdmin) return null;

  const tabs = [
    { href: "/platform-admin/all-users", label: "All Users" },
    { href: "/platform-admin/audit", label: "Audit" },
    { href: "/platform-admin/settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <ViewAsBanner />
      <Nav />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-3">
          <span className="text-xs uppercase tracking-wider text-rose-400 font-semibold">
            Platform Admin
          </span>
          <span className="text-slate-700">/</span>
          {tabs.map((t) => (
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
