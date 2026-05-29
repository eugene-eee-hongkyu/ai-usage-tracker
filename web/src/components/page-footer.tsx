// 페이지 하단 우측 진입점: 릴리즈 노트 · 제안하기.
// 대시보드 / 팀 / 세팅 페이지 공통으로 main 끝 또는 page wrapper 끝에 둔다.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocalMode } from "@/lib/use-local-mode";
import { track, EVENTS } from "@/lib/analytics/mixpanel";

export function PageFooter({ screen }: { screen?: "dashboard" | "team" | "settings" }) {
  const isLocalMode = useLocalMode();
  const [hasNewChangelog, setHasNewChangelog] = useState(false);

  useEffect(() => {
    if (isLocalMode) return;
    fetch("/api/changelog/latest")
      .then((r) => r.json())
      .then((d: { latest: string | null }) => {
        if (!d.latest) return;
        try {
          const lastSeen = localStorage.getItem("changelog_last_seen");
          setHasNewChangelog(!lastSeen || lastSeen < d.latest);
        } catch { /* ignore */ }
      })
      .catch(() => { /* ignore */ });
  }, [isLocalMode]);

  if (isLocalMode) return null;

  const suggestHref = screen ? `/suggest?screen=${screen}` : "/suggest";

  return (
    <footer className="border-t border-neutral-900 px-4 py-3 bg-neutral-950">
      <div className="max-w-6xl mx-auto flex justify-end items-center gap-4 text-xs text-neutral-500">
        <Link
          href="/changelog"
          onClick={() => track(EVENTS.FOOTER_LINK_CLICK, { screen: screen ?? null, target: "changelog", has_new: hasNewChangelog })}
          className="hover:text-neutral-300 inline-flex items-center gap-1.5"
        >
          <span>릴리즈 노트</span>
          {hasNewChangelog && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
        </Link>
        <span className="text-neutral-700">·</span>
        <Link
          href={suggestHref}
          onClick={() => track(EVENTS.FOOTER_LINK_CLICK, { screen: screen ?? null, target: "suggest" })}
          className="hover:text-neutral-300"
        >
          제안하기 💡
        </Link>
      </div>
    </footer>
  );
}
