"use client";

import { useEffect, useState } from "react";
import { useMessages } from "@/lib/use-i18n";

// 첫 진입 시 한 번 dismiss 가능 banner. dismiss 후엔 footer 작은 form 으로 항상 노출.
// "수집 안 함" 명시 (negative claim 이 trust 강함).

const DISMISS_KEY = "privacy_banner_dismissed_v1";

export function PrivacyBanner() {
  const { m } = useMessages();
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed === null) return null;

  if (!dismissed) {
    return (
      <div
        data-testid="privacy-banner"
        className="bg-slate-900 border-b border-slate-700 px-4 py-2.5"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 text-xs font-mono">
          <span className="text-slate-300">
            {m.privacy.banner} <span className="text-emerald-400 font-bold">{m.privacy.bannerEm1}</span>.{" "}
            <span className="text-rose-400 font-bold">{m.privacy.bannerEm2}</span>
          </span>
          <button
            data-testid="privacy-banner-dismiss"
            onClick={() => {
              try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
              setDismissed(true);
            }}
            className="text-slate-500 hover:text-slate-200 text-sm shrink-0"
            aria-label={m.privacy.dismissAria}
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export function PrivacyFooterNote() {
  const { m } = useMessages();
  return (
    <p data-testid="privacy-footer-note" className="text-[10px] font-mono text-slate-600 text-center py-3">
      {m.privacy.footerNote}
    </p>
  );
}
