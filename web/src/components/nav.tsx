"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { isAdmin } from "@/lib/admin";

export function Nav() {
  const path = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  const adminUser = isAdmin(session?.user?.email ?? "");

  const tabs = [
    { href: "/dashboard", label: "개인", admin: false },
    { href: "/team", label: "팀", admin: false },
    ...(adminUser ? [{ href: "/member", label: "팀원", admin: true }] : []),
    { href: "/setup-status", label: "셋업", admin: false },
  ];

  return (
    <header className="border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-bold text-slate-200 shrink-0 hidden sm:block">Primus Usage</span>
        <nav className="flex gap-1 sm:gap-3">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`text-sm px-2 sm:px-3 py-1 rounded transition-colors whitespace-nowrap inline-flex items-center gap-1 ${
                path.startsWith(t.href)
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
              {t.admin && (
                <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 leading-none">ADMIN</span>
              )}
            </Link>
          ))}
        </nav>
      </div>
      <div className="relative shrink-0">
        <button
          onClick={() => setOpen(!open)}
          className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1 whitespace-nowrap"
        >
          {session?.user?.name?.split(" ")[0]} ▾
        </button>
        {open && (
          <div className="absolute right-0 top-8 bg-slate-800 border border-slate-700 rounded shadow-lg z-50 whitespace-nowrap">
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 w-full text-left"
            >
              로그아웃
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
