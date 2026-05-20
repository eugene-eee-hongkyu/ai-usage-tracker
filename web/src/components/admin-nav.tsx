"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMessages } from "@/lib/use-i18n";

// admin context 의 app-level nav — 팀 / 팀원 만. 홈페이지 · locale · user
// dropdown 은 /admin/* layout 의 상위 nav (Users · Audit · Team · Settings)
// 또는 다른 화면에서 이미 처리됨 → 여기서 중복 제거.
export function AdminNav() {
  const path = usePathname();
  const { m } = useMessages();

  const tabs = [
    { href: "/admin/team", label: m.adminNav.team },
    { href: "/admin/members", label: m.adminNav.members },
  ];

  return (
    <header className="border-b border-amber-900/40 bg-amber-950/10 px-4 py-3 flex items-center gap-3">
      <span className="font-bold text-amber-200 shrink-0 hidden sm:inline-flex items-center gap-2">
        z21labs Usage
        <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 leading-none">ADMIN</span>
      </span>
      <nav className="flex gap-1 sm:gap-3">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            data-testid={`admin-nav-tab-${t.href.replace(/^\//, "").replace(/\//g, "-")}`}
            className={`text-sm px-2 sm:px-3 py-1 rounded transition-colors whitespace-nowrap inline-flex items-center gap-1 ${
              path === t.href || path.startsWith(t.href)
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
