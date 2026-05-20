// admin-v1 (Phase 4.1) — client-side 권한 hook.
//
// 사용:
//   const { isPlatformAdmin, isMembershipAdmin, isBillingAdmin, isAnyAdmin } = usePermissions();
//   if (isMembershipAdmin) <InviteButton />
//
// 권한 위계:
//   isPlatformAdmin  ADMIN_EMAIL env 화이트리스트 (= eugene). 모든 팀 + view-as + 새 팀 생성.
//   isMembershipAdmin / isBillingAdmin  자기 팀 사용자 관리 / 비용 권한. team_members.role
//     이 'owner' 인 팀 owner 도 별도 권한 부여 없이 자동 통과.
//   isAnyAdmin  nav 의 어드민 메뉴 노출 조건.
//
// session 객체에서 직접 읽음. DB 조회 없음.

"use client";

import { useSession } from "next-auth/react";

export function usePermissions() {
  const { data: session, status } = useSession();
  const u = session?.user;

  const isPlatformAdmin = !!u?.isPlatformAdmin;
  const isMembershipAdmin = isPlatformAdmin || !!u?.permissions?.membershipAdmin;
  const isBillingAdmin = isPlatformAdmin || !!u?.permissions?.billingAdmin;
  const isAnyAdmin = !!u?.isAdmin;

  return {
    loading: status === "loading",
    isPlatformAdmin,
    isMembershipAdmin,
    isBillingAdmin,
    isAnyAdmin,
    suspended: !!u?.suspendedAt,
  };
}
