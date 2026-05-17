"use client";

// 서버 모드 / 로컬 모드 + companyUrl 조회. Nav 분기에 사용.
// null = loading, true = 로컬 단독 (.app), false = 서버 (Vercel).
// companyUrl = config.json 의 외부 (회사) URL, 있으면 팀 메뉴 표시.

import { useEffect, useState } from "react";

const BUILD_LOCAL = process.env.NEXT_PUBLIC_LOCAL_MODE === "1";

export interface LocalModeInfo {
  isLocalMode: boolean | null;
  companyUrl: string | null;
}

export function useLocalMode(): boolean | null {
  const info = useLocalModeInfo();
  return info.isLocalMode;
}

export function useLocalModeInfo(): LocalModeInfo {
  const [info, setInfo] = useState<LocalModeInfo>(
    BUILD_LOCAL
      ? { isLocalMode: null, companyUrl: null }
      : { isLocalMode: false, companyUrl: null }
  );
  useEffect(() => {
    if (!BUILD_LOCAL) return;
    fetch("/api/mode")
      .then((r) => (r.ok ? r.json() : { isLocalMode: false, companyUrl: null }))
      .then((d: { isLocalMode?: boolean; companyUrl?: string | null }) =>
        setInfo({
          isLocalMode: !!d.isLocalMode,
          companyUrl: d.companyUrl ?? null,
        })
      )
      .catch(() => setInfo({ isLocalMode: false, companyUrl: null }));
  }, []);
  return info;
}
