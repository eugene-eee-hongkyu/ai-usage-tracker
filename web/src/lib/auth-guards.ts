// admin-v1 (Phase 4.1) — server-side 권한 가드.
//
// 모든 /api/admin/* route 는 이 helper 로 가드:
//   const { user, error } = await requireMembershipAdmin();
//   if (error) return error;
//   // user 사용
//
// Goodhart 회피 정합:
//   - Membership-Admin: 사용자 관리만 (invite/approve/suspend/delete)
//   - Billing-Admin: cost 자세히 보기
//   - Platform Admin: ADMIN_EMAIL env 화이트리스트 — 모든 팀 + 권한 부여 + 새 팀 생성
//
// 권한 분리는 session.user.permissions JSONB 에 박혀 있고 (auth.ts session callback),
// 이 helper 는 session 만 읽음 — DB 조회 없음.

import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";

interface GuardResult {
  user: NonNullable<Session["user"]> & { id: number; currentTeamId: number };
  error: null;
}

interface GuardError {
  user: null;
  error: NextResponse;
}

/**
 * 로그인 + suspended/deleted 아님 검증. 모든 admin guard 의 첫 단계.
 */
export async function requireUser(): Promise<GuardResult | GuardError> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { user: null, error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (session.user.suspendedAt) {
    return { user: null, error: NextResponse.json({ error: "suspended" }, { status: 403 }) };
  }
  if (session.user.deletedAt) {
    return { user: null, error: NextResponse.json({ error: "deleted" }, { status: 403 }) };
  }
  // Phase 4.2 (M6a): 팀 미가입 user 차단. session.user.currentTeamId 가 null 이면
  // team_members 행이 없는 상태 — 정상 흐름이면 발생 안 함 (가입 시 자동 행 INSERT).
  // signIn 콜백에서 team_members 추가 누락된 케이스 또는 데이터 불일치 방어.
  if (!session.user.currentTeamId) {
    return { user: null, error: NextResponse.json({ error: "no_team" }, { status: 403 }) };
  }
  return {
    user: session.user as GuardResult["user"],
    error: null,
  };
}

/**
 * Platform Admin (ADMIN_EMAIL env) 만 통과. 가장 강한 권한 — 모든 팀 + 새 팀 생성.
 * @deprecated 이름 혼동 방지 — 새 코드는 requirePlatformAdmin 사용.
 */
export async function requireOwner(): Promise<GuardResult | GuardError> {
  return requirePlatformAdmin();
}

/**
 * Platform Admin = ADMIN_EMAIL env 화이트리스트. eugene 만 통과.
 * Team owner (team_members.role='owner') 와 별개의 최상위 권한.
 */
export async function requirePlatformAdmin(): Promise<GuardResult | GuardError> {
  const result = await requireUser();
  if (result.error) return result;
  if (!result.user.isPlatformAdmin) {
    return {
      user: null,
      error: NextResponse.json({ error: "platform_admin_only" }, { status: 403 }),
    };
  }
  return result;
}

/**
 * Membership-Admin 권한 또는 Owner. 사용자 관리 (invite/approve/suspend/delete) API guard.
 */
export async function requireMembershipAdmin(): Promise<GuardResult | GuardError> {
  const result = await requireUser();
  if (result.error) return result;
  // Team owner 는 별도 permission 없어도 자기 팀 관리 (옵션 A, 2026-05-20).
  const isTeamOwner = result.user.currentTeamRole === "owner";
  if (
    !result.user.isPlatformAdmin &&
    !isTeamOwner &&
    !result.user.permissions?.membershipAdmin
  ) {
    return {
      user: null,
      error: NextResponse.json({ error: "membership_admin_required" }, { status: 403 }),
    };
  }
  return result;
}

/**
 * Billing-Admin 권한 또는 Owner. 사용자 cost 자세히 보기 API guard.
 * Goodhart 회피 — 이 권한 없는 admin 은 팀 합계 + 본인 cost 만 보임.
 */
export async function requireBillingAdmin(): Promise<GuardResult | GuardError> {
  const result = await requireUser();
  if (result.error) return result;
  const isTeamOwner = result.user.currentTeamRole === "owner";
  if (
    !result.user.isPlatformAdmin &&
    !isTeamOwner &&
    !result.user.permissions?.billingAdmin
  ) {
    return {
      user: null,
      error: NextResponse.json({ error: "billing_admin_required" }, { status: 403 }),
    };
  }
  return result;
}

/**
 * 두 권한 중 어떤 거든 OR Owner. nav 의 admin 메뉴 진입 시점 등 광역 guard.
 * 세부 액션은 별도 require* 로 한 번 더 가드.
 */
export async function requireAnyAdmin(): Promise<GuardResult | GuardError> {
  const result = await requireUser();
  if (result.error) return result;
  if (!result.user.isAdmin) {
    return { user: null, error: NextResponse.json({ error: "admin_required" }, { status: 403 }) };
  }
  return result;
}
