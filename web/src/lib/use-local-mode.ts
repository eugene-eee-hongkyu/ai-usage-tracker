"use client";

// 클라이언트 hook — server 가 IS_LOCAL_MODE 인지 한 번 조회 후 cache.
// null = loading, true = 로컬 단독 (.pkg/.app 설치 환경), false = 서버 (Vercel) 모드.
// auth redirect 분기 (`/login`) 에 사용.

import { useEffect, useState } from "react";

export function useLocalMode(): boolean | null {
  const [isLocalMode, setIsLocalMode] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/mode")
      .then((r) => (r.ok ? r.json() : { isLocalMode: false }))
      .then((d: { isLocalMode?: boolean }) => setIsLocalMode(!!d.isLocalMode))
      .catch(() => setIsLocalMode(false));
  }, []);
  return isLocalMode;
}
