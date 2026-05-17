"use client";

// 서버가 IS_LOCAL_MODE 인지 한 번 조회 후 cache.
// null = loading, true = 로컬 단독 (.app 인스톨러), false = 서버 (Vercel) 모드.
// auth redirect 분기 (`/login`) 에 사용.
//
// 최적화: build-time inline 되는 NEXT_PUBLIC_LOCAL_MODE 가 "1" 이 아니면 (= Vercel
// 빌드) 즉시 false 로 결정 — /api/mode fetch 호출 자체 안 함. 5명 사용자의 매
// 페이지 mount 마다 발생하던 Vercel function 호출 제거.

import { useEffect, useState } from "react";

const BUILD_LOCAL = process.env.NEXT_PUBLIC_LOCAL_MODE === "1";

export function useLocalMode(): boolean | null {
  const [isLocalMode, setIsLocalMode] = useState<boolean | null>(
    BUILD_LOCAL ? null : false
  );
  useEffect(() => {
    if (!BUILD_LOCAL) return;
    fetch("/api/mode")
      .then((r) => (r.ok ? r.json() : { isLocalMode: false }))
      .then((d: { isLocalMode?: boolean }) => setIsLocalMode(!!d.isLocalMode))
      .catch(() => setIsLocalMode(false));
  }, []);
  return isLocalMode;
}
