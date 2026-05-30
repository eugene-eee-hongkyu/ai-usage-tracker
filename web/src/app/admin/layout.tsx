// admin-v1: /admin/* 공통 layout.
// 어드민 (Team Owner / Membership Admin / Billing Admin) 의 팀 단위 운영 화면.
// 탭: Users / Team / Settings.
// Audit / Platform 단위 settings (모든 팀 / view-as) 는 /platform-admin/* 으로 분리 (2026-05-22).

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useLocalMode } from "@/lib/use-local-mode";
import { usePermissions } from "@/lib/use-permissions";
import { Nav } from "@/components/nav";
import { ViewAsBanner } from "@/components/view-as-banner";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const isLocalMode = useLocalMode();
  const { isAnyAdmin, isMembershipAdmin, isBillingAdmin, isPlatformAdmin, isTeamOwner, loading } =
    usePermissions();

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

  // 마지막으로 머문 탭을 기록. /admin (redirect 페이지) 진입 시 이 값으로 복귀.
  // ALLOWED 화이트리스트로만 저장 — dynamic sub-path 가 생겨도 5 탭 외엔 무시.
  useEffect(() => {
    const ALLOWED = [
      "/admin/members",
      "/admin/team",
      "/admin/team/ranking",
      "/admin/users",
      "/admin/settings",
    ];
    if (ALLOWED.includes(path)) {
      try { localStorage.setItem("admin_last_tab", path); } catch { /* ignore */ }
    }
  }, [path]);

  if (isLocalMode) return <>{children}</>;
  if (status === "loading" || isLocalMode === null || loading) return null;
  if (status === "authenticated" && !isAnyAdmin) return null;

  // 2026-05-30: 평탄화 — 옛 [Users / Team / Settings] 3 탭에서 5 탭으로 확장. AdminNav
  // (amber bar) 의 [팀·팀원·랭킹] 을 여기로 흡수해서 admin 의 모든 페이지가 한 줄에서
  // 접근 가능. 권한 — 팀원/사용자 = Membership Admin, 팀/랭킹 = Billing Admin,
  // 세팅 = Platform Admin 또는 Team Owner.
  const tabs: Array<{ href: string; label: string; visible: boolean }> = [
    { href: "/admin/members", label: "팀원", visible: isMembershipAdmin },
    { href: "/admin/team", label: "팀", visible: isBillingAdmin },
    { href: "/admin/team/ranking", label: "랭킹", visible: isBillingAdmin },
    { href: "/admin/users", label: "사용자", visible: isMembershipAdmin },
    { href: "/admin/settings", label: "세팅", visible: isPlatformAdmin || isTeamOwner },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <ViewAsBanner />
      <Nav />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-3">
          <span className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
            Admin
          </span>
          <span className="text-slate-700">/</span>
          {(() => {
            const visible = tabs.filter((t) => t.visible);
            // longest-prefix active — /admin/team/ranking 진입 시 ranking 만 active,
            // /admin/team 은 dim. 가드 없으면 둘 다 startsWith 매칭으로 동시 active.
            const activeHref =
              visible
                .filter((t) => path === t.href || path.startsWith(t.href + "/"))
                .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
            return visible.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`text-sm px-3 py-1 rounded transition-colors ${
                  activeHref === t.href
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.label}
              </Link>
            ));
          })()}
        </div>
        {children}
      </div>
    </div>
  );
}
