"use client";

// client component 가 locale 자동 결정 + 수동 전환.
// 우선순위 (읽기):  URL ?locale  →  localStorage  →  navigator.language  →  "en"
// 우선순위 (쓰기):  setLocale(x)  →  localStorage 저장 + URL ?locale 동기화 + 페이지 reload
//
// reload 하는 이유: 메시지 카탈로그가 useMessages 훅을 통해 SSR/CSR 양쪽에서 호출되는데,
// 모든 컴포넌트에 ko/en 상태를 props 로 흘리는 대신 단순 reload 한 번이 가장 안전.

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getMessages, normalizeLocale, SUPPORTED_LOCALES, type Messages } from "@/lib/i18n";

const STORAGE_KEY = "ui_locale";

function readStorage(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function writeStorage(v: string) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, v); } catch {}
}

export function useMessages(): {
  locale: string;
  m: Messages;
  setLocale: (next: string) => void;
  supported: readonly string[];
} {
  const params = useSearchParams();
  const router = useRouter();
  const urlLocale = params?.get("locale") ?? null;
  const storedLocale = readStorage();
  const navLocale =
    typeof navigator !== "undefined" ? navigator.language : null;
  const locale = normalizeLocale(urlLocale ?? storedLocale ?? navLocale);

  const setLocale = useCallback(
    (next: string) => {
      const norm = normalizeLocale(next);
      writeStorage(norm);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("locale", norm);
        // router.replace + reload — App Router 의 SSR 컴포넌트가 새 locale 로 다시 렌더되도록.
        window.location.replace(url.toString());
      } else {
        router.refresh();
      }
    },
    [router]
  );

  return { locale, m: getMessages(locale), setLocale, supported: SUPPORTED_LOCALES };
}
