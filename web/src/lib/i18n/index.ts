// i18n loader — locale 별 message catalog. 새 locale 추가 = messages/<lang>.ts
// 작성 후 byLocale 에 한 줄. 누락 키는 Messages 타입이 컴파일러 단계에서 잡음.

import { en, type Messages } from "./messages/en";
import { ko } from "./messages/ko";
import { ja } from "./messages/ja";
import { zh } from "./messages/zh";

const byLocale: Record<string, Messages> = {
  en,
  ko,
  ja,
  zh,
};

export const SUPPORTED_LOCALES = Object.keys(byLocale);
export const DEFAULT_LOCALE = "en";

// 입력 locale 을 catalog 키로 정규화.
//   "ko"      → "ko"
//   "ko-KR"   → "ko"
//   "ja-JP"   → "ja"
//   "zh-CN"   → "zh"
//   "fr-FR"   → "en" (지원 안 함 → fallback)
export function normalizeLocale(input?: string | null): string {
  if (!input) return DEFAULT_LOCALE;
  const lang = input.toLowerCase().split(/[-_]/)[0];
  return byLocale[lang] ? lang : DEFAULT_LOCALE;
}

export function getMessages(locale?: string | null): Messages {
  return byLocale[normalizeLocale(locale)];
}

export type { Messages };
