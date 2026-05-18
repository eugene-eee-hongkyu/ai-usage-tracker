// GET   /api/admin/users         — 리스트 (search/pagination/filter)
// PATCH /api/admin/users?id=N    — suspend / unsuspend / soft delete / restore

import { NextRequest, NextResponse } from "next/server";
import { db, users, teamMembers, IS_LOCAL_MODE } from "@/lib/db";
import { requireMembershipAdmin, requireOwner } from "@/lib/auth-guards";
import { writeAudit } from "@/lib/audit";
import { isAdmin } from "@/lib/admin";
import { getEffectiveTeamId } from "@/lib/effective-team";
import { eq, ilike, isNull, isNotNull, and, or, asc, desc, sql, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });
  const guard = await requireMembershipAdmin();
  if (guard.error) return guard.error;

  const effectiveTeamId = await getEffectiveTeamId({ user: guard.user }, req);
  if (!effectiveTeamId) return NextResponse.json({ error: "no_team" }, { status: 403 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const status = url.searchParams.get("status") ?? "active";  // active|suspended|deleted|all
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const sort = url.searchParams.get("sort") ?? "lastSyncedAt";  // lastSyncedAt|createdAt|name
  const dir = url.searchParams.get("dir") ?? "desc";

  // team 격리 — team_members 의 user_id 만 조회. M6c: 같은 user 가 N팀 가능하지만
  // 이 list 는 effectiveTeam 의 멤버만.
  const memberIdRows = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, effectiveTeamId), isNull(teamMembers.deletedAt)));
  const memberUserIds = memberIdRows.map((r) => r.userId);
  if (memberUserIds.length === 0) {
    return NextResponse.json({ users: [], page, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
  }

  const whereParts = [inArray(users.id, memberUserIds)];
  if (q) {
    whereParts.push(or(ilike(users.email, `%${q}%`), ilike(users.name, `%${q}%`))!);
  }
  if (status === "active") {
    whereParts.push(and(isNull(users.suspendedAt), isNull(users.deletedAt))!);
  } else if (status === "suspended") {
    whereParts.push(isNotNull(users.suspendedAt));
  } else if (status === "deleted") {
    whereParts.push(isNotNull(users.deletedAt));
  }
  const where = and(...whereParts);

  const sortColMap = {
    lastSyncedAt: users.lastSyncedAt,
    createdAt: users.createdAt,
    name: users.name,
    email: users.email,
  };
  const sortCol = sortColMap[sort as keyof typeof sortColMap] ?? users.lastSyncedAt;
  const order = dir === "asc" ? asc(sortCol) : desc(sortCol);

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      role: users.role,
      permissions: users.permissions,
      suspendedAt: users.suspendedAt,
      deletedAt: users.deletedAt,
      createdAt: users.createdAt,
      lastSyncedAt: users.lastSyncedAt,
    })
    .from(users)
    .where(where)
    .orderBy(order)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  // Owner 표시 — ADMIN_EMAIL env 화이트리스트 매칭. DB 컬럼 아닌 derived.
  const rowsWithOwner = rows.map((r) => ({ ...r, isOwner: isAdmin(r.email) }));

  // total count
  const countResult = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(users)
    .where(where);
  const total = countResult[0]?.c ?? 0;

  return NextResponse.json({
    users: rowsWithOwner,
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
}

export async function PATCH(req: NextRequest) {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });
  const guard = await requireMembershipAdmin();
  if (guard.error) return guard.error;

  const effectiveTeamId = await getEffectiveTeamId({ user: guard.user }, req);
  if (!effectiveTeamId) return NextResponse.json({ error: "no_team" }, { status: 403 });

  const url = new URL(req.url);
  const id = parseInt(url.searchParams.get("id") ?? "", 10);
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { action, confirmEmail, role, permissions } = body as {
    action?: "suspend" | "unsuspend" | "delete" | "restore" | "role_update";
    confirmEmail?: string;  // delete 시 type-to-confirm
    role?: string;
    permissions?: { membershipAdmin?: boolean; billingAdmin?: boolean };
  };

  // target 가 effectiveTeam 의 멤버인지 검증 — 다른 회사 user id 추측해서 만지는 leak 방지.
  const targetMembership = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, effectiveTeamId),
        eq(teamMembers.userId, id),
        isNull(teamMembers.deletedAt)
      )
    )
    .limit(1);
  if (!targetMembership[0]) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const target = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      suspendedAt: users.suspendedAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!target[0]) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (target[0].id === guard.user.id) {
    return NextResponse.json({ error: "cannot_modify_self" }, { status: 400 });
  }

  if (action === "suspend") {
    if (target[0].suspendedAt) return NextResponse.json({ error: "already_suspended" }, { status: 409 });
    await db.update(users).set({ suspendedAt: new Date() }).where(eq(users.id, id));
  } else if (action === "unsuspend") {
    if (!target[0].suspendedAt) return NextResponse.json({ error: "not_suspended" }, { status: 409 });
    await db.update(users).set({ suspendedAt: null }).where(eq(users.id, id));
  } else if (action === "delete") {
    if (confirmEmail !== target[0].email) {
      return NextResponse.json({ error: "confirm_email_mismatch" }, { status: 400 });
    }
    if (target[0].deletedAt) return NextResponse.json({ error: "already_deleted" }, { status: 409 });
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, id));
  } else if (action === "restore") {
    if (!target[0].deletedAt) return NextResponse.json({ error: "not_deleted" }, { status: 409 });
    // 30일 grace 기간 검사
    const graceMs = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - target[0].deletedAt.getTime() > graceMs) {
      return NextResponse.json({ error: "grace_period_expired" }, { status: 410 });
    }
    await db.update(users).set({ deletedAt: null }).where(eq(users.id, id));
  } else if (action === "role_update") {
    // role/permissions 변경은 Owner only
    const ownerGuard = await requireOwner();
    if (ownerGuard.error) return ownerGuard.error;
    await db
      .update(users)
      .set({
        role: role ?? "member",
        permissions: permissions ?? {},
      })
      .where(eq(users.id, id));
  } else {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  await writeAudit({
    actorUserId: guard.user.id,
    action: `user.${action}`,
    targetType: "user",
    targetId: id,
    metadata: { targetEmail: target[0].email, role, permissions },
    ip: req.headers.get("x-forwarded-for") ?? null,
  });

  return NextResponse.json({ ok: true });
}
