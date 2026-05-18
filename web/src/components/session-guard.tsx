"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

// admin-v1 (Phase 4.1) — suspended/deleted user 의 잔존 세션 즉시 강제 로그아웃.
//
// 배경: signIn 콜백은 OAuth 로그인 시점에만 호출되므로, admin 이 user 를 suspend
// 해도 이미 발급된 세션 쿠키는 만료 전까지 그대로 통과. session 콜백이 매 요청마다
// DB 조회로 suspendedAt 을 채워 넣지만, 페이지 측에선 차단 로직이 없어 setup/dashboard
// 진입이 허용됐다 (보안 버그).
//
// 대책: client root 에 마운트해 status="authenticated" + suspendedAt/deletedAt 있으면
// signOut({ callbackUrl: "/login?error=suspended|deleted" }) 강제 호출 → 쿠키 무효화 +
// 로그인 페이지 redirect. server-side 보강은 /api/ingest 에 별도 추가.
//
// LOCAL_MODE (.dmg) 빌드는 SessionProvider 가 가짜 세션 주입하므로 우회.

export function SessionGuard() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    const u = session.user as { suspendedAt?: unknown; deletedAt?: unknown };
    if (u.deletedAt) {
      signOut({ callbackUrl: "/login?error=deleted" });
      return;
    }
    if (u.suspendedAt) {
      signOut({ callbackUrl: "/login?error=suspended" });
    }
  }, [session, status]);

  return null;
}
