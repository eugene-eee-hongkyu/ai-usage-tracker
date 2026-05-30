"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMessages } from "@/lib/use-i18n";

// admin context 의 app-level nav — [ADMIN] 배지 + 회사명 + 평탄한 5 탭
// (팀원·팀·랭킹·사용자·세팅). 이전엔 [팀·팀원·랭킹] 만 노출하고 users/settings 는
// 직접 URL 진입이라 admin 의 모든 페이지를 한눈에 못 봤음 (2026-05-30 사용자 피드백).
// Platform Admin view-as 모드면 view-as 팀명 우선 표시.
export function AdminNav() {
  const path = usePathname();
  const { m } = useMessages();
  const { data: session } = useSession();
  const u = session?.user as {
    currentTeamName?: string | null;
    viewAsTeamName?: string | null;
  } | undefined;
  const teamName = u?.viewAsTeamName ?? u?.currentTeamName ?? null;

  const tabs = [
    { href: "/admin/members", label: m.adminNav.members },
    { href: "/admin/team", label: m.adminNav.team },
    { href: "/admin/team/ranking", label: m.adminNav.ranking },
    { href: "/admin/users", label: m.adminNav.users },
    { href: "/admin/settings", label: m.adminNav.settings },
  ];

  // active 판정 — 가장 긴 prefix 매칭. /admin/team/ranking 진입 시 ranking 만
  // active 되고 team 은 dim 처리.
  const activeHref =
    tabs
      .filter((t) => path === t.href || path.startsWith(t.href + "/"))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;

  return (
    <header className="border-b border-amber-900/40 bg-amber-950/10 px-4 py-3 flex items-center gap-3 flex-wrap">
      <span className="shrink-0 inline-flex items-center gap-2 min-w-0">
        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 leading-none">
          ADMIN
        </span>
        <span className="font-bold text-slate-100 text-base truncate">
          {teamName ?? "—"}
        </span>
      </span>
      <nav className="flex gap-1 sm:gap-3 ml-auto sm:ml-4">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            data-testid={`admin-nav-tab-${t.href.replace(/^\//, "").replace(/\//g, "-")}`}
            className={`text-sm px-2 sm:px-3 py-1 rounded transition-colors whitespace-nowrap inline-flex items-center gap-1 ${
              activeHref === t.href
                ? "bg-amber-700/40 text-amber-100"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
