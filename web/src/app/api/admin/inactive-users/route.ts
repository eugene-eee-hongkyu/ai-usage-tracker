// GET /api/admin/inactive-users — 30일 이상 sync 없는 활성 사용자 리스트.
// settings 페이지의 비활성 alert 카드용.

import { NextResponse } from "next/server";
import { db, users, IS_LOCAL_MODE } from "@/lib/db";
import { requireMembershipAdmin } from "@/lib/auth-guards";
import { and, isNull, or, lt, asc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });
  const guard = await requireMembershipAdmin();
  if (guard.error) return guard.error;

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      lastSyncedAt: users.lastSyncedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      and(
        isNull(users.suspendedAt),
        isNull(users.deletedAt),
        or(isNull(users.lastSyncedAt), lt(users.lastSyncedAt, cutoff))
      )
    )
    .orderBy(asc(sql`coalesce(${users.lastSyncedAt}, ${users.createdAt})`));

  return NextResponse.json({ inactiveUsers: rows, cutoff });
}
