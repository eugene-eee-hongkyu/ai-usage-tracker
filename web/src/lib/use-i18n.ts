"use client";

// dashboard 등 client component 가 locale 자동 결정.
// 우선순위: URL ?locale → navigator.language → "en"

import { useSearchParams } from "next/navigation";
import { getMessages, normalizeLocale, type Messages } from "@/lib/i18n";

export function useMessages(): { locale: string; m: Messages } {
  const params = useSearchParams();
  const urlLocale = params?.get("locale");
  const navLocale =
    typeof navigator !== "undefined" ? navigator.language : null;
  const locale = normalizeLocale(urlLocale ?? navLocale);
  return { locale, m: getMessages(locale) };
}
