"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Suspense, useEffect, useState, useCallback } from "react";
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
  const [latestChangelogDate, setLatestChangelogDate] = useState<string>("");
  const [hasNewChangelog, setHasNewChangelog] = useState(false);

  useEffect(() => {
    if (isLocalMode) return;
    fetch("/api/changelog/latest")
      .then((r) => r.json())
      .then((d: { latest: string | null }) => {
        if (!d.latest) return;
        setLatestChangelogDate(d.latest);
        try {
          const lastSeen = localStorage.getItem("changelog_last_seen");
          setHasNewChangelog(!lastSeen || lastSeen < d.latest);
        } catch { /* ignore */ }
      })
      .catch(() => { /* ignore */ });
  }, [isLocalMode]);

  // 메뉴 구성 — 모드별 분기:
  //   서버 (Vercel)        : 개인 / 팀 / 셋업 / 랭킹 (personal=Y)
  //   로컬 + 회사 destination : 개인 / 팀 (외부 ↗). 셋업 숨김
  //   로컬 단독              : 개인 만
  const userFlags = session?.user as {
    personal?: boolean;
    hasNormalTeam?: boolean;
  } | undefined;
  type Tab = { href: string; label: string; external?: boolean };
  const tabs: Tab[] = [{ href: "/dashboard", label: m.nav.personal }];
  if (isLocalMode) {
    if (companyUrl) tabs.push({ href: `${companyUrl}/team`, label: m.nav.team, external: true });
  } else {
    if (userFlags?.hasNormalTeam !== false) {
      tabs.push({ href: "/team", label: m.nav.team });
    }
    if (userFlags?.personal) {
      tabs.push({ href: "/ranking", label: m.nav.ranking ?? "랭킹" });
    }
    tabs.push({ href: "/setup-status", label: m.nav.setup });
  }

  // dashboard / team 등 내부 링크에 현재 locale 유지.
  const withLocale = (href: string) => (href.includes("?") ? href : `${href}?locale=${locale}`);

  // view-as 모드면 view-as 팀명 우선. nexa view-as 중인데 'iskra.world' 로 표시되던 버그 fix.
  const teamName = !isLocalMode
    ? (() => {
      const u = session?.user as { currentTeamName?: string | null; viewAsTeamName?: string | null } | undefined;
      return u?.viewAsTeamName ?? u?.currentTeamName ?? null;
    })()
    : null;

  return (
    <header className="border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-bold text-slate-200 shrink-0 hidden sm:inline-flex items-center gap-2 min-w-0">
          <span>{m.brand}</span>
          {teamName && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-slate-300 truncate">{teamName}</span>
            </>
          )}
        </span>
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
            <Link
              href={withLocale("/changelog")}
              data-testid="nav-changelog"
              onClick={() => {
                setOpen(false);
                try { localStorage.setItem("changelog_last_seen", latestChangelogDate); } catch { /* ignore */ }
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 w-full text-left"
            >
              <span>릴리즈 노트</span>
              {hasNewChangelog && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
            </Link>
            <button
              data-testid="nav-logout"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 w-full text-left border-t border-slate-700"
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
            {session?.user?.isPlatformAdmin && (
              <Link
                href={withLocale("/platform-admin/all-users")}
                data-testid="nav-platform-admin"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-rose-300 hover:bg-slate-700 border-t border-slate-700 w-full text-left"
              >
                {m.nav.platformAdmin}
              </Link>
            )}
            {!isLocalMode && (
              <PersonalToggle
                isPersonal={userFlags?.personal ?? false}
                onClose={() => setOpen(false)}
              />
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function PersonalToggle({ isPersonal, onClose }: { isPersonal: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState(isPersonal);

  const toggle = useCallback(async () => {
    const next = !value;
    const msg = next
      ? "전체 익명 랭킹에 참여합니다. 본인 사용량 메타 데이터가 다른 참여자 화면에 익명으로 노출됩니다. 진행할까요?"
      : "랭킹 참여를 해제합니다. 다시 켜기 전까지 본인 데이터는 랭킹에서 빠집니다. 진행할까요?";
    if (!window.confirm(msg)) return;
    setLoading(true);
    try {
      const r = await fetch("/api/personal/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personal: next }),
      });
      if (r.ok) {
        setValue(next);
        window.location.reload();
      } else {
        const d = await r.json().catch(() => ({}));
        if (d.message) alert(d.message);
      }
    } catch {
      // ignore
    }
    setLoading(false);
    onClose();
  }, [value, onClose]);

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-slate-700 border-t border-slate-700 w-full text-left"
    >
      <span className={value ? "text-emerald-300" : "text-slate-400"}>
        랭킹 참여
      </span>
      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
        value
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
          : "bg-slate-700 text-slate-500"
      }`}>
        {value ? "ON" : "OFF"}
      </span>
    </button>
  );
}

export function Nav() {
  return (
    <Suspense fallback={<header className="border-b border-slate-800 h-12" />}>
      <NavInner />
    </Suspense>
  );
}
