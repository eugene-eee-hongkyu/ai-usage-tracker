// admin-v1 (Phase 4.1) — client-side 권한 hook.
//
// 사용:
//   const { isPlatformAdmin, isTeamOwner, isMembershipAdmin, isBillingAdmin, isAnyAdmin } = usePermissions();
//   if (isMembershipAdmin) <InviteButton />
//
// 권한 위계:
//   isPlatformAdmin   ADMIN_EMAIL env 화이트리스트 (= eugene). 모든 팀 + view-as + 새 팀 생성.
//   isTeamOwner       team_members.role='owner'. 자기 팀의 모든 관리 권한 (옵션 A, 2026-05-20).
//   isMembershipAdmin / isBillingAdmin  자기 팀 사용자 관리 / 비용 권한.
//                     PlatformAdmin·TeamOwner 면 별도 부여 없이 자동 통과.
//   isAnyAdmin        nav 의 어드민 메뉴 노출 조건.
//
// session 객체에서 직접 읽음. DB 조회 없음.

"use client";

import { useSession } from "next-auth/react";

export function usePermissions() {
  const { data: session, status } = useSession();
  const u = session?.user;

  const isPlatformAdmin = !!u?.isPlatformAdmin;
  const isTeamOwner = u?.currentTeamRole === "owner";
  const isMembershipAdmin =
    isPlatformAdmin || isTeamOwner || !!u?.permissions?.membershipAdmin;
  const isBillingAdmin =
    isPlatformAdmin || isTeamOwner || !!u?.permissions?.billingAdmin;
  const isAnyAdmin = !!u?.isAdmin;

  return {
    loading: status === "loading",
    isPlatformAdmin,
    isTeamOwner,
    isMembershipAdmin,
    isBillingAdmin,
    isAnyAdmin,
    suspended: !!u?.suspendedAt,
  };
}
