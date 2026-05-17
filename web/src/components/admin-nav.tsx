"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { useMessages } from "@/lib/use-i18n";
import { LocaleSwitcher } from "@/components/locale-switcher";

export function AdminNav() {
  const path = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const { m } = useMessages();

  const tabs = [
    { href: "/admin/team", label: m.adminNav.team },
    { href: "/admin/members", label: m.adminNav.members },
    { href: "/dashboard", label: m.adminNav.home },
  ];

  return (
    <header className="border-b border-amber-900/40 bg-amber-950/10 px-4 py-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-bold text-amber-200 shrink-0 hidden sm:inline-flex items-center gap-2">
          Primus Usage
          <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 leading-none">ADMIN</span>
        </span>
        <nav className="flex gap-1 sm:gap-3">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              data-testid={`admin-nav-tab-${t.href.replace(/^\//, "").replace(/\//g, "-")}`}
              className={`text-sm px-2 sm:px-3 py-1 rounded transition-colors whitespace-nowrap inline-flex items-center gap-1 ${
                path === t.href || (t.href !== "/dashboard" && path.startsWith(t.href))
                  ? "bg-amber-700/40 text-amber-100"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="relative shrink-0 flex items-center gap-2">
        <LocaleSwitcher variant="nav" />
        <button
          data-testid="admin-nav-user-toggle"
          onClick={() => setOpen(!open)}
          className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1 whitespace-nowrap"
        >
          {session?.user?.name?.split(" ")[0]} ▾
        </button>
        {open && (
          <div className="absolute right-0 top-8 bg-slate-800 border border-slate-700 rounded shadow-lg z-50 whitespace-nowrap">
            <button
              data-testid="admin-nav-logout"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 w-full text-left"
            >
              {m.nav.logout}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
