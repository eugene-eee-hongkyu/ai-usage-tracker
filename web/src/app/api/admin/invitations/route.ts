// POST /api/admin/invitations  — 초대 발송
// GET  /api/admin/invitations  — pending 초대 리스트
//
// 권한: Membership-Admin OR Owner.
// LOCAL_MODE 차단 (.dmg 는 1인용, admin 기능 없음).

import { NextRequest, NextResponse } from "next/server";
import { db, invitations, users, teamMembers, IS_LOCAL_MODE } from "@/lib/db";
import { requireMembershipAdmin } from "@/lib/auth-guards";
import { writeAudit } from "@/lib/audit";
import { sendInvitation } from "@/lib/email";
import { getEffectiveTeamId } from "@/lib/effective-team";
import { eq, and, isNull } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const EXPIRES_DAYS = 7;

export async function POST(req: NextRequest) {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });
  const guard = await requireMembershipAdmin();
  if (guard.error) return guard.error;

  const effectiveTeamId = await getEffectiveTeamId({ user: guard.user }, req);
  if (!effectiveTeamId) return NextResponse.json({ error: "no_team" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { email, role = "member", permissions = {}, locale = "ko" } = body as {
    email?: string;
    role?: string;
    permissions?: { membershipAdmin?: boolean; billingAdmin?: boolean };
    locale?: "ko" | "en";
  };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  // 이미 effectiveTeam 의 멤버인지 확인 — 다른 팀 user 라도 같은 메일은 invitation 가능
  // (한 user N팀 정책 유지). 같은 팀 멤버면 거부.
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing[0]) {
    const sameTeamMembership = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, effectiveTeamId),
          eq(teamMembers.userId, existing[0].id),
          isNull(teamMembers.deletedAt)
        )
      )
      .limit(1);
    if (sameTeamMembership[0]) {
      return NextResponse.json({ error: "user_already_in_team", userId: existing[0].id }, { status: 409 });
    }
  }

  // pending 초대 있으면 중복 방지 (effectiveTeam 안에서만)
  const pending = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.teamId, effectiveTeamId),
        eq(invitations.email, email),
        isNull(invitations.acceptedAt),
        isNull(invitations.cancelledAt)
      )
    )
    .limit(1);
  if (pending[0]) {
    return NextResponse.json({ error: "invitation_pending", invitationId: pending[0].id }, { status: 409 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  const inserted = await db
    .insert(invitations)
    .values({
      teamId: effectiveTeamId,
      email,
      invitedBy: guard.user.id,
      token,
      role,
      permissions,
      expiresAt,
    })
    .returning({ id: invitations.id });

  await writeAudit({
    teamId: effectiveTeamId,
    actorUserId: guard.user.id,
    action: "invitation.create",
    targetType: "invitation",
    targetId: inserted[0].id,
    metadata: { email, role, permissions, expiresAt: expiresAt.toISOString() },
    ip: req.headers.get("x-forwarded-for") ?? null,
    actorIsPlatformOwner: effectiveTeamId !== guard.user.currentTeamId,
  });

  // Resend 발송 — DNS verify 안 됐으면 fail silently. UI 에 메일 발송 실패 표시 가능하도록 응답에 포함.
  const mail = await sendInvitation({
    to: email,
    inviterName: guard.user.name ?? "Team admin",
    token,
    locale,
  });

  return NextResponse.json({
    ok: true,
    invitationId: inserted[0].id,
    emailSent: mail.ok,
    emailError: mail.ok ? null : mail.error,
  });
}

export async function GET(req: NextRequest) {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });
  const guard = await requireMembershipAdmin();
  if (guard.error) return guard.error;

  const effectiveTeamId = await getEffectiveTeamId({ user: guard.user }, req);
  if (!effectiveTeamId) return NextResponse.json({ error: "no_team" }, { status: 403 });

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") ?? "pending";  // pending | accepted | cancelled | all

  const rows = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      invitedBy: invitations.invitedBy,
      role: invitations.role,
      permissions: invitations.permissions,
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
      cancelledAt: invitations.cancelledAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(eq(invitations.teamId, effectiveTeamId))
    .orderBy(invitations.createdAt);

  const filtered = rows.filter((r) => {
    const now = new Date();
    const expired = r.expiresAt < now;
    if (statusFilter === "pending") return !r.acceptedAt && !r.cancelledAt && !expired;
    if (statusFilter === "accepted") return !!r.acceptedAt;
    if (statusFilter === "cancelled") return !!r.cancelledAt;
    if (statusFilter === "expired") return !r.acceptedAt && !r.cancelledAt && expired;
    return true;
  });

  return NextResponse.json({ invitations: filtered });
}

export async function DELETE(req: NextRequest) {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });
  const guard = await requireMembershipAdmin();
  if (guard.error) return guard.error;

  const effectiveTeamId = await getEffectiveTeamId({ user: guard.user }, req);
  if (!effectiveTeamId) return NextResponse.json({ error: "no_team" }, { status: 403 });

  const url = new URL(req.url);
  const id = parseInt(url.searchParams.get("id") ?? "", 10);
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const result = await db
    .update(invitations)
    .set({ cancelledAt: new Date() })
    .where(
      and(
        eq(invitations.id, id),
        eq(invitations.teamId, effectiveTeamId),
        isNull(invitations.acceptedAt),
        isNull(invitations.cancelledAt)
      )
    )
    .returning({ id: invitations.id, email: invitations.email });

  if (result.length === 0) {
    return NextResponse.json({ error: "not_found_or_already_resolved" }, { status: 404 });
  }

  await writeAudit({
    teamId: effectiveTeamId,
    actorUserId: guard.user.id,
    action: "invitation.cancel",
    targetType: "invitation",
    targetId: id,
    metadata: { email: result[0].email },
    ip: req.headers.get("x-forwarded-for") ?? null,
    actorIsPlatformOwner: effectiveTeamId !== guard.user.currentTeamId,
  });

  return NextResponse.json({ ok: true });
}
