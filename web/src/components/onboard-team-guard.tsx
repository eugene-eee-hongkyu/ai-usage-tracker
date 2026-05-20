"use client";

// Phase 4.2 M6d — 회사명이 아직 안 정해진 팀의 어드민을 /onboard-team 으로 강제.
//
// 배경: Owner 가 teamName 없이 invitation 발송 → 어드민이 OAuth 가입 → currentTeam
//   .namePending = true 상태. 이 사람이 dashboard/admin 등 어디로 가도 회사명 입력
//   화면을 먼저 거치게 만든다.
//
// SessionGuard 패턴 (providers root 마운트) 그대로. /onboard-team 자체와 LOCAL_MODE
// 는 예외.

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

export function OnboardTeamGuard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    const u = session.user as { currentTeamNamePending?: boolean };
    if (u.currentTeamNamePending && pathname !== "/onboard-team") {
      router.replace("/onboard-team");
    }
  }, [session, status, pathname, router]);

  return null;
}
