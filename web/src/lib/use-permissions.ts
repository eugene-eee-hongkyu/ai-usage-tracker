// admin-v1 (Phase 4.1) — client-side 권한 hook.
//
// 사용:
//   const { isOwner, isMembershipAdmin, isBillingAdmin, isAnyAdmin } = usePermissions();
//   if (isMembershipAdmin) <InviteButton />
//
// session 객체에서 직접 읽음. DB 조회 없음.

"use client";

import { useSession } from "next-auth/react";

export function usePermissions() {
  const { data: session, status } = useSession();
  const u = session?.user;

  const isOwner = !!u?.isOwner;
  const isMembershipAdmin = isOwner || !!u?.permissions?.membershipAdmin;
  const isBillingAdmin = isOwner || !!u?.permissions?.billingAdmin;
  const isAnyAdmin = !!u?.isAdmin;

  return {
    loading: status === "loading",
    isOwner,
    isMembershipAdmin,
    isBillingAdmin,
    isAnyAdmin,
    suspended: !!u?.suspendedAt,
  };
}
