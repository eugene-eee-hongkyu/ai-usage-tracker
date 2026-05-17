"use client";

// nav / wizard 우측 상단에 붙는 언어 토글.
// click 시 locale 전환 → localStorage 저장 + URL ?locale 동기화 + reload (use-i18n.setLocale).
//
// 표시 라벨: KO / EN / 日 / 中 — 항상 4개 다 노출 (compact toggle).
// 활성 locale 은 강조 색.

import { useMessages } from "@/lib/use-i18n";

const LOCALE_LABELS: Record<string, string> = {
  ko: "KO",
  en: "EN",
  ja: "日",
  zh: "中",
};

const ORDER = ["ko", "en", "ja", "zh"] as const;

interface Props {
  variant?: "nav" | "wizard";
}

export function LocaleSwitcher({ variant = "nav" }: Props) {
  const { locale, setLocale, supported } = useMessages();

  const bg = variant === "wizard" ? "bg-neutral-900 border-neutral-800" : "bg-slate-800/60 border-slate-700";
  const activeClass = variant === "wizard"
    ? "bg-indigo-600 text-white"
    : "bg-slate-700 text-slate-100";
  const inactiveClass = variant === "wizard"
    ? "text-neutral-400 hover:text-neutral-100"
    : "text-slate-400 hover:text-slate-200";

  return (
    <div
      data-testid="locale-switcher"
      role="group"
      aria-label="Language"
      className={`inline-flex items-center rounded border ${bg} overflow-hidden text-xs font-mono`}
    >
      {ORDER.filter((l) => supported.includes(l)).map((l) => {
        const isActive = l === locale;
        return (
          <button
            key={l}
            type="button"
            data-testid={`locale-switcher-${l}`}
            aria-pressed={isActive}
            onClick={() => {
              if (!isActive) setLocale(l);
            }}
            className={`px-2 py-1 transition-colors ${isActive ? activeClass : inactiveClass}`}
          >
            {LOCALE_LABELS[l] ?? l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
