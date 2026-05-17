"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { useLocalModeInfo } from "@/lib/use-local-mode";

export function Nav() {
  const path = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const { isLocalMode, companyUrl } = useLocalModeInfo();

  // 메뉴 구성 — 모드별 분기:
  //   서버 (Vercel) : 개인 / 팀 / 셋업
  //   로컬 + 회사   : 개인 / 팀 (외부 링크). 셋업 숨김 (인스톨러가 셋업)
  //   로컬 단독     : 개인 만. 팀/셋업 모두 숨김
  type Tab = { href: string; label: string; external?: boolean };
  const tabs: Tab[] = [{ href: "/dashboard", label: "개인" }];
  if (isLocalMode) {
    if (companyUrl) tabs.push({ href: `${companyUrl}/team`, label: "팀", external: true });
  } else {
    tabs.push({ href: "/team", label: "팀" });
    tabs.push({ href: "/setup-status", label: "셋업" });
  }

  return (
    <header className="border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-bold text-slate-200 shrink-0 hidden sm:block">Primus Usage</span>
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
                href={t.href}
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
      <div className="relative shrink-0">
        <button
          data-testid="nav-user-toggle"
          onClick={() => setOpen(!open)}
          className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1 whitespace-nowrap"
        >
          {session?.user?.name?.split(" ")[0]}
          {/* 로컬 모드는 dropdown 메뉴 없음 — 화살표 숨김 */}
          {!isLocalMode && " ▾"}
        </button>
        {/* dropdown — 로컬 모드 미표시 (NextAuth 안 쓰니 logout 의미 없음) */}
        {open && !isLocalMode && (
          <div className="absolute right-0 top-8 bg-slate-800 border border-slate-700 rounded shadow-lg z-50 whitespace-nowrap">
            <button
              data-testid="nav-logout"
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
