"use client";

// Mixpanel init + 세션 변경 시 identifyUser 자동 호출.
// RootLayout 안에 1회 mount. 자체 UI render ✗.
//
// 세션 → user_id alias 흐름:
//   1) 앱 시작 시 initAnalytics() — anonymous distinct_id (쿠키) 생성
//   2) useSession 으로 session 변화 감지 → 로그인되면 identifyUser(user.id) 1회
//   3) signin_complete 이벤트도 같이 (funnel 의 "가입/로그인 완료" 노드)
//   4) 로그아웃 / 세션 만료 시 Mixpanel reset 은 안 함 — 같은 device 재로그인 시 동일 identify

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { initAnalytics, identifyUser, track, EVENTS } from "@/lib/analytics/mixpanel";

export function AnalyticsBridge() {
  const { data: session, status } = useSession();
  const identifiedRef = useRef<number | null>(null);

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    const u = session?.user as { id?: number; email?: string; personal?: boolean } | undefined;
    if (!u?.id || identifiedRef.current === u.id) return;
    identifyUser(u.id, {
      // PII 회피 — email 은 전송 X. personal flag 등 cohort 만.
      personal: u.personal ?? false,
    });
    track(EVENTS.SIGNIN_COMPLETE);
    identifiedRef.current = u.id;
  }, [status, session]);

  return null;
}
