"use client";

// nav / wizard 우측 상단에 붙는 언어 토글.
// click 시 locale 전환 → localStorage 저장 + URL ?locale 동기화 + reload (use-i18n.setLocale).
//
// 표시 라벨: KO / EN — 2개. ja/zh 는 유지보수 부담으로 제거 (2026-05-20).
//
// hydration mismatch 회피: SSR 시점엔 navigator/localStorage 가 없어서 locale 이 'en' 으로 계산되지만
// client 시점엔 navigator.language (예: 'ko-KR') 가 잡혀 'ko' 가 됨 → aria-pressed mismatch 로
// hydration error 발생 → click handler 등 인터랙션이 죽는다.
// 해결: mount 전까진 어떤 button 도 pressed 로 두지 않음 (전부 inactive 렌더). mount 후 실제 locale 반영.

import { useEffect, useState } from "react";
import { useMessages } from "@/lib/use-i18n";

const LOCALE_LABELS: Record<string, string> = {
  ko: "KO",
  en: "EN",
};

const ORDER = ["ko", "en"] as const;

interface Props {
  variant?: "nav" | "wizard";
}

export function LocaleSwitcher({ variant = "nav" }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
        const isActive = mounted && l === locale;
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
