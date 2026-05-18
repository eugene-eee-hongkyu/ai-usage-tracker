// GET /api/admin/audit — log 리스트 + filter + integrity verify
// 권한: Owner only (audit 는 가장 민감).

import { NextRequest, NextResponse } from "next/server";
import { db, auditLogs, users, IS_LOCAL_MODE } from "@/lib/db";
import { requireOwner } from "@/lib/auth-guards";
import { eq, and, desc, sql, ilike, or, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });
  const guard = await requireOwner();
  if (guard.error) return guard.error;

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const actorQ = url.searchParams.get("actorQ"); // 이름/이메일 substring 또는 숫자 ID
  const actorId = url.searchParams.get("actorId"); // 옛 호환
  const targetType = url.searchParams.get("targetType");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

  const whereParts = [];
  if (action) whereParts.push(ilike(auditLogs.action, `%${action}%`));
  if (actorId) whereParts.push(eq(auditLogs.actorUserId, parseInt(actorId, 10)));
  if (targetType) whereParts.push(targetType === "system" ? eq(auditLogs.actorType, "system") : eq(auditLogs.targetType, targetType));

  // actorQ — 숫자면 ID 정확 매칭, 문자열이면 users 테이블 join 으로 name/email substring 매칭.
  if (actorQ) {
    const numeric = /^\d+$/.test(actorQ.trim()) ? parseInt(actorQ.trim(), 10) : null;
    if (numeric !== null) {
      whereParts.push(eq(auditLogs.actorUserId, numeric));
    } else {
      const matchingUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(or(ilike(users.email, `%${actorQ}%`), ilike(users.name, `%${actorQ}%`)));
      if (matchingUsers.length === 0) {
        // 매칭 없으면 빈 결과로 응답 (가짜 id=-1 로 강제)
        whereParts.push(eq(auditLogs.actorUserId, -1));
      } else {
        whereParts.push(inArray(auditLogs.actorUserId, matchingUsers.map((u) => u.id)));
      }
    }
  }

  const where = whereParts.length > 0 ? and(...whereParts) : undefined;

  // join users for actor name/email (left join — system actor 는 NULL)
  const rows = await db
    .select({
      id: auditLogs.id,
      prevHash: auditLogs.prevHash,
      rowHash: auditLogs.rowHash,
      actorUserId: auditLogs.actorUserId,
      actorType: auditLogs.actorType,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      metadata: auditLogs.metadata,
      ip: auditLogs.ip,
      createdAt: auditLogs.createdAt,
      actorEmail: users.email,
      actorName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(where)
    .orderBy(desc(auditLogs.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const countResult = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(where);
  const total = countResult[0]?.c ?? 0;

  // Integrity verify — 자동 호출. 깨진 row 없으면 빈 array.
  const verifyResult = await db.execute(sql`SELECT * FROM verify_audit_chain(0)`);
  // pg result: rows in .rows
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const broken = ((verifyResult as any).rows ?? []) as Array<{
    broken_at_id: string;
    expected_hash: string;
    actual_hash: string;
  }>;

  return NextResponse.json({
    auditLogs: rows,
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.ceil(total / PAGE_SIZE),
    integrity: {
      verified: broken.length === 0,
      brokenAtId: broken[0]?.broken_at_id ?? null,
      expected: broken[0]?.expected_hash ?? null,
      actual: broken[0]?.actual_hash ?? null,
    },
  });
}
