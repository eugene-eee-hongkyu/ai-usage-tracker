// GET   /api/admin/join-requests             — pending 가입 신청 리스트
// PATCH /api/admin/join-requests?id=N         — { decision: 'approved'|'rejected', note? }
//
// 권한: Membership-Admin OR Owner.

import { NextRequest, NextResponse } from "next/server";
import { db, joinRequests, users, IS_LOCAL_MODE } from "@/lib/db";
import { requireMembershipAdmin } from "@/lib/auth-guards";
import { writeAudit } from "@/lib/audit";
import { sendJoinApproved } from "@/lib/email";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });
  const guard = await requireMembershipAdmin();
  if (guard.error) return guard.error;

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") ?? "pending";

  const rows = await db
    .select({
      id: joinRequests.id,
      userId: joinRequests.userId,
      email: joinRequests.email,
      teamNameHint: joinRequests.teamNameHint,
      message: joinRequests.message,
      status: joinRequests.status,
      decidedBy: joinRequests.decidedBy,
      decidedAt: joinRequests.decidedAt,
      decisionNote: joinRequests.decisionNote,
      createdAt: joinRequests.createdAt,
    })
    .from(joinRequests)
    .where(statusFilter === "all" ? undefined : eq(joinRequests.status, statusFilter))
    .orderBy(joinRequests.createdAt);

  return NextResponse.json({ joinRequests: rows });
}

export async function PATCH(req: NextRequest) {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });
  const guard = await requireMembershipAdmin();
  if (guard.error) return guard.error;

  const url = new URL(req.url);
  const id = parseInt(url.searchParams.get("id") ?? "", 10);
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { decision, note, locale = "ko" } = body as {
    decision?: "approved" | "rejected";
    note?: string;
    locale?: "ko" | "en";
  };
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ error: "invalid_decision" }, { status: 400 });
  }

  const existing = await db
    .select({
      id: joinRequests.id,
      email: joinRequests.email,
      status: joinRequests.status,
    })
    .from(joinRequests)
    .where(eq(joinRequests.id, id))
    .limit(1);
  if (!existing[0]) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (existing[0].status !== "pending") {
    return NextResponse.json({ error: "already_decided", status: existing[0].status }, { status: 409 });
  }

  await db
    .update(joinRequests)
    .set({
      status: decision,
      decidedBy: guard.user.id,
      decidedAt: new Date(),
      decisionNote: note ?? null,
    })
    .where(eq(joinRequests.id, id));

  await writeAudit({
    actorUserId: guard.user.id,
    action: `join_request.${decision}`,
    targetType: "join_request",
    targetId: id,
    metadata: { email: existing[0].email, note: note ?? null },
    ip: req.headers.get("x-forwarded-for") ?? null,
  });

  // 승인 시 사용자에게 알림 이메일
  if (decision === "approved") {
    const mail = await sendJoinApproved({
      to: existing[0].email,
      approverName: guard.user.name ?? "Team admin",
      locale,
    });
    return NextResponse.json({ ok: true, emailSent: mail.ok, emailError: mail.error ?? null });
  }

  return NextResponse.json({ ok: true });
}

// 사용자가 본인 가입 신청을 만드는 POST 는 /api/join-request (admin prefix 없음) 으로 별도.
// 본 파일은 admin 가드 하에 list/decide 만.
