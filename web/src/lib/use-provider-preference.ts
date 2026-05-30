"use client";

// dashboard / team / ranking 공용 — 마지막 선택한 provider (Claude / Codex) 를
// localStorage 에 저장하고, 페이지 진입 시 그 값으로 init. 화면 간 공유 (단일 key) —
// 사용자가 dashboard 에서 codex 보면 team / ranking 도 자동 codex 로. 일관성 의도.
// 화면별 분리가 필요해지면 key 인자 추가로 분리 가능.
//
// lazy init 으로 첫 mount 부터 saved 값 사용 — race 없음 (default 'claude' 로 첫
// fetch 발사 후 swap 하는 패턴 회피). period 가 race 처리 (periodReady) 가 필요했던
// 이유는 useState 초기값 이후 localStorage 읽었기 때문 — lazy init 으로 그 단계 제거.

import { useEffect, useState } from "react";

export type ProviderKey = "claude" | "codex";

const STORAGE_KEY = "provider_pref";

export function useProviderPreference(): [ProviderKey, (v: ProviderKey) => void] {
  const [provider, setProvider] = useState<ProviderKey>(() => {
    if (typeof window === "undefined") return "claude";
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === "codex" ? "codex" : "claude";
    } catch {
      return "claude";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, provider);
    } catch {
      /* sandbox / private mode — 저장 실패해도 세션 안에선 동작 */
    }
  }, [provider]);

  return [provider, setProvider];
}
