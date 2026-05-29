"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { SessionGuard } from "@/components/session-guard";
import { OnboardTeamGuard } from "@/components/onboard-team-guard";
import { AnalyticsBridge } from "@/components/analytics-bridge";

// 로컬 단독 모드 (.pkg/.app 인스톨러) 에서는 NextAuth 의 OAuth flow 가 작동 안 함
// (외부 callback URL 불가). server 측 API route 는 IS_LOCAL_MODE 로 우회하지만,
// client 의 useSession 은 /api/auth/session 호출 결과 unauthenticated 받아 redirect.
//
// 해결: build-time NEXT_PUBLIC_LOCAL_MODE=1 면 SessionProvider 에 가짜 authenticated
// 세션 주입 → useSession 결과 status: "authenticated" → redirect 안 발동.
// (참고: NextAuth + Electron 의 표준 패턴)
//
// Vercel 빌드는 NEXT_PUBLIC_LOCAL_MODE unset → session=undefined → 기존 동작.

const IS_LOCAL_BUILD = process.env.NEXT_PUBLIC_LOCAL_MODE === "1";

const LOCAL_SESSION: Session = {
  user: {
    name: "Local User",
    email: "local@usage-tracker.local",
    image: null,
  },
  expires: new Date(Date.now() + 365 * 86_400_000).toISOString(),
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider session={IS_LOCAL_BUILD ? LOCAL_SESSION : undefined}>
      {!IS_LOCAL_BUILD && <SessionGuard />}
      {!IS_LOCAL_BUILD && <OnboardTeamGuard />}
      {/* Mixpanel init + 로그인 시 identifyUser. LOCAL_MODE 는 NEXT_PUBLIC_MIXPANEL_TOKEN
          미설정이면 no-op (다른 사용자의 토큰 새지 않음). */}
      {!IS_LOCAL_BUILD && <AnalyticsBridge />}
      {children}
    </SessionProvider>
  );
}
