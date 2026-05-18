// admin-v1 (Phase 4.1 M5) — "평가 도구 아님" 정책 banner.
// dashboard 상단. dismissable. localStorage 에 7일 기록.

"use client";

import { useEffect, useState } from "react";
import { useMessages } from "@/lib/use-i18n";

const DISMISS_KEY = "policy_banner_dismissed_until";

export function PolicyBanner() {
  const { locale } = useMessages();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) {
      setShow(true);
      return;
    }
    const until = parseInt(v, 10);
    if (Date.now() > until) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  function dismiss() {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(Date.now() + sevenDays));
    setShow(false);
  }

  const text =
    locale === "en"
      ? "Not an evaluation tool. Your efficiency score is for self-coaching, not performance reviews."
      : "평가 도구가 아닙니다. 본인 효율 점수는 self-coaching 목적이며, 인사 평가나 1:1 metric 으로 사용되지 않습니다.";

  return (
    <div className="bg-indigo-950/40 border-b border-indigo-700/30 px-4 py-2 flex items-center justify-between gap-3">
      <p className="text-xs text-indigo-200 flex-1">
        <span className="mr-1.5">ⓘ</span>
        {text}
      </p>
      <button
        onClick={dismiss}
        className="text-xs text-indigo-300/70 hover:text-indigo-200 shrink-0"
        aria-label="dismiss"
      >
        ✕
      </button>
    </div>
  );
}
