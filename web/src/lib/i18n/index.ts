// i18n loader — en 을 base 로, 다른 locale 은 DeepPartial override.
// 누락 키는 자동으로 en 값으로 fallback. 새 locale 추가 = messages/<lang>.ts 에 부분 작성.

import { en, type Messages } from "./messages/en";
import { ko } from "./messages/ko";
// ja, zh 는 유지보수 부담으로 dropdown 옵션에서 제거 (2026-05-20). 카탈로그 파일은
// 보존 — 추후 복구 시 overrides 에 다시 추가.

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const overrides: Record<string, DeepPartial<Messages>> = {
  en: {},
  ko,
};

export const SUPPORTED_LOCALES = Object.keys(overrides);
export const DEFAULT_LOCALE = "en";

// Deep merge: base 의 모든 키를 유지하고, override 가 있는 leaf 만 교체.
// override 의 leaf 가 undefined 면 base 유지. 빈 string "" 은 의도적 override 로 본다.
function deepMerge<T>(base: T, override: DeepPartial<T> | undefined): T {
  if (!override) return base;
  // base 가 plain object 가 아니면 leaf 로 본다.
  if (typeof base !== "object" || base === null || Array.isArray(base)) {
    return (override as unknown as T) ?? base;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const k of Object.keys(override as object)) {
    const ov = (override as Record<string, unknown>)[k];
    if (ov === undefined) continue;
    const bv = (base as Record<string, unknown>)[k];
    if (
      typeof bv === "object" && bv !== null && !Array.isArray(bv) &&
      typeof ov === "object" && ov !== null && !Array.isArray(ov)
    ) {
      out[k] = deepMerge(bv, ov as DeepPartial<typeof bv>);
    } else {
      out[k] = ov;
    }
  }
  return out as T;
}

// 입력 locale 을 catalog 키로 정규화.
//   "ko"      → "ko"
//   "ko-KR"   → "ko"
//   "ja-JP"   → "ja"
//   "zh-CN"   → "zh"
//   "fr-FR"   → "en" (지원 안 함 → fallback)
export function normalizeLocale(input?: string | null): string {
  if (!input) return DEFAULT_LOCALE;
  const lang = input.toLowerCase().split(/[-_]/)[0];
  return overrides[lang] ? lang : DEFAULT_LOCALE;
}

export function getMessages(locale?: string | null): Messages {
  const norm = normalizeLocale(locale);
  if (norm === DEFAULT_LOCALE) return en;
  return deepMerge(en, overrides[norm]);
}

export type { Messages };
