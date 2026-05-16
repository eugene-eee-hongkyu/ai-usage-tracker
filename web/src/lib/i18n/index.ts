// i18n loader — locale 별 message catalog 를 로드. 누락된 locale 은 en 으로 fallback.
// 새 locale 추가 시 messages/<locale>.ts 만들고 SUPPORTED 와 byLocale 에 추가.

import { en, type Messages } from "./messages/en";
import { ko } from "./messages/ko";

// 향후 ja, zh, es 등을 여기에 추가하면 즉시 활성화.
const byLocale: Record<string, Messages> = {
  en,
  ko,
};

export const SUPPORTED_LOCALES = Object.keys(byLocale);
export const DEFAULT_LOCALE = "en";

// 입력 locale 을 우리 catalog 의 키로 정규화.
//   "ko"     → "ko"
//   "ko-KR"  → "ko"
//   "fr-FR"  → "en" (지원 안 함 → fallback)
export function normalizeLocale(input?: string | null): string {
  if (!input) return DEFAULT_LOCALE;
  const lower = input.toLowerCase();
  const lang = lower.split(/[-_]/)[0];
  return byLocale[lang] ? lang : DEFAULT_LOCALE;
}

export function getMessages(locale?: string | null): Messages {
  return byLocale[normalizeLocale(locale)];
}

export type { Messages };
