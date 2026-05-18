// GET /api/admin/inactive-users — 30일 이상 sync 없는 활성 사용자 리스트.
// settings 페이지의 비활성 alert 카드용.

import { NextResponse } from "next/server";
import { db, users, teamMembers, IS_LOCAL_MODE } from "@/lib/db";
import { requireMembershipAdmin } from "@/lib/auth-guards";
import { getEffectiveTeamId } from "@/lib/effective-team";
import { and, eq, isNull, or, lt, asc, sql, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });
  const guard = await requireMembershipAdmin();
  if (guard.error) return guard.error;

  const effectiveTeamId = await getEffectiveTeamId({ user: guard.user });
  if (!effectiveTeamId) return NextResponse.json({ error: "no_team" }, { status: 403 });

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // team 격리 — effectiveTeam 멤버만.
  const memberIdRows = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, effectiveTeamId), isNull(teamMembers.deletedAt)));
  const memberUserIds = memberIdRows.map((r) => r.userId);
  if (memberUserIds.length === 0) {
    return NextResponse.json({ inactiveUsers: [], cutoff });
  }

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
        inArray(users.id, memberUserIds),
        isNull(users.suspendedAt),
        isNull(users.deletedAt),
        or(isNull(users.lastSyncedAt), lt(users.lastSyncedAt, cutoff))
      )
    )
    .orderBy(asc(sql`coalesce(${users.lastSyncedAt}, ${users.createdAt})`));

  return NextResponse.json({ inactiveUsers: rows, cutoff });
}
