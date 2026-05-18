"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Suspense, useState } from "react";
import { useLocalModeInfo } from "@/lib/use-local-mode";
import { useMessages } from "@/lib/use-i18n";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { AboutPopover } from "@/components/about-popover";

function NavInner() {
  const path = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const { isLocalMode, companyUrl } = useLocalModeInfo();
  const { m, locale } = useMessages();

  // 메뉴 구성 — 모드별 분기:
  //   서버 (Vercel)        : 개인 / 팀 / 셋업
  //   로컬 + 회사 destination : 개인 / 팀 (외부 ↗). 셋업 숨김
  //   로컬 단독              : 개인 만
  type Tab = { href: string; label: string; external?: boolean };
  const tabs: Tab[] = [{ href: "/dashboard", label: m.nav.personal }];
  if (isLocalMode) {
    if (companyUrl) tabs.push({ href: `${companyUrl}/team`, label: m.nav.team, external: true });
  } else {
    tabs.push({ href: "/team", label: m.nav.team });
    tabs.push({ href: "/setup-status", label: m.nav.setup });
  }

  // dashboard / team 등 내부 링크에 현재 locale 유지.
  const withLocale = (href: string) => (href.includes("?") ? href : `${href}?locale=${locale}`);

  return (
    <header className="border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-bold text-slate-200 shrink-0 hidden sm:block">{m.brand}</span>
        <nav className="flex gap-1 sm:gap-3">
          {tabs.map((t) =>
            t.external ? (
              <a
                key={t.href}
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`nav-tab-team-external`}
                className="text-sm px-2 sm:px-3 py-1 rounded transition-colors whitespace-nowrap inline-flex items-center gap-1 text-slate-400 hover:text-slate-200"
              >
                {t.label} <span className="text-[10px] opacity-60">↗</span>
              </a>
            ) : (
              <Link
                key={t.href}
                href={withLocale(t.href)}
                data-testid={`nav-tab-${t.href.replace(/^\//, "")}`}
                className={`text-sm px-2 sm:px-3 py-1 rounded transition-colors whitespace-nowrap inline-flex items-center gap-1 ${
                  path.startsWith(t.href)
                    ? "bg-slate-700 text-slate-100"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.label}
              </Link>
            )
          )}
        </nav>
      </div>
      <div className="relative shrink-0 flex items-center gap-2">
        <LocaleSwitcher variant="nav" />
        <AboutPopover />
        <button
          data-testid="nav-user-toggle"
          onClick={() => setOpen(!open)}
          className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1 whitespace-nowrap"
        >
          {session?.user?.name?.split(" ")[0]}
          {!isLocalMode && " ▾"}
        </button>
        {open && !isLocalMode && (
          <div className="absolute right-0 top-8 bg-slate-800 border border-slate-700 rounded shadow-lg z-50 whitespace-nowrap">
            <button
              data-testid="nav-logout"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 w-full text-left"
            >
              {m.nav.logout}
            </button>
            {session?.user?.isAdmin && (
              <Link
                href={withLocale("/admin/users")}
                data-testid="nav-admin"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-amber-300 hover:bg-slate-700 border-t border-slate-700 w-full text-left"
              >
                {m.nav.admin}
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export function Nav() {
  return (
    <Suspense fallback={<header className="border-b border-slate-800 h-12" />}>
      <NavInner />
    </Suspense>
  );
}
