"use client";

// client component 가 locale 자동 결정 + 수동 전환.
// 우선순위 (읽기):  URL ?locale  →  localStorage  →  navigator.language  →  "en"
// 우선순위 (쓰기):  setLocale(x)  →  localStorage 저장 + URL ?locale 동기화 + 페이지 reload
//
// SSR 시 useSearchParams() 사용을 피해 CSR bailout 방지 (Next 14 App Router prerender 호환).
// 초기 render 는 DEFAULT_LOCALE 로 시작, mount 후 useEffect 에서 URL/localStorage 갱신.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getMessages,
  normalizeLocale,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  type Messages,
} from "@/lib/i18n";

const STORAGE_KEY = "ui_locale";

function readStorage(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function writeStorage(v: string) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, v); } catch {}
}

function detectLocale(): string {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const urlParams = new URLSearchParams(window.location.search);
  const urlLocale = urlParams.get("locale");
  const storedLocale = readStorage();
  const navLocale = typeof navigator !== "undefined" ? navigator.language : null;
  return normalizeLocale(urlLocale ?? storedLocale ?? navLocale);
}

export function useMessages(): {
  locale: string;
  m: Messages;
  setLocale: (next: string) => void;
  supported: readonly string[];
} {
  const router = useRouter();
  const [locale, setLocaleState] = useState<string>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  const setLocale = useCallback(
    (next: string) => {
      const norm = normalizeLocale(next);
      writeStorage(norm);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("locale", norm);
        window.location.replace(url.toString());
      } else {
        router.refresh();
      }
    },
    [router]
  );

  return { locale, m: getMessages(locale), setLocale, supported: SUPPORTED_LOCALES };
}
