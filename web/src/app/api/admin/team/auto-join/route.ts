// GET   /api/admin/team/auto-join — 본인 currentTeam 의 자동 가입 상태.
// PATCH /api/admin/team/auto-join — auto_join_enabled toggle.
//
// 권한: Team Owner 또는 Platform Admin (Settings visible 조건과 동일).

import { NextRequest, NextResponse } from "next/server";
import { db, teams, IS_LOCAL_MODE } from "@/lib/db";
import { requireUser } from "@/lib/auth-guards";
import { writeAudit } from "@/lib/audit";
import { eq, and, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });
  const guard = await requireUser();
  if (guard.error) return guard.error;
  const isTeamOwner = guard.user.currentTeamRole === "owner";
  if (!guard.user.isPlatformAdmin && !isTeamOwner) {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }

  const teamRow = await db
    .select({
      id: teams.id,
      autoJoinEnabled: teams.autoJoinEnabled,
      autoJoinDomains: teams.autoJoinDomains,
    })
    .from(teams)
    .where(and(eq(teams.id, guard.user.currentTeamId), isNull(teams.deletedAt)))
    .limit(1);
  if (!teamRow[0]) return NextResponse.json({ error: "team_not_found" }, { status: 404 });
  return NextResponse.json({
    autoJoinEnabled: teamRow[0].autoJoinEnabled,
    autoJoinDomains: teamRow[0].autoJoinDomains,
  });
}

export async function PATCH(req: NextRequest) {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });
  const guard = await requireUser();
  if (guard.error) return guard.error;
  const isTeamOwner = guard.user.currentTeamRole === "owner";
  if (!guard.user.isPlatformAdmin && !isTeamOwner) {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { enabled } = body as { enabled?: boolean };
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "invalid_enabled" }, { status: 400 });
  }

  await db
    .update(teams)
    .set({ autoJoinEnabled: enabled })
    .where(eq(teams.id, guard.user.currentTeamId));

  await writeAudit({
    teamId: guard.user.currentTeamId,
    actorUserId: guard.user.id,
    action: "team.auto_join.toggle",
    targetType: "team",
    targetId: guard.user.currentTeamId,
    metadata: { enabled },
    ip: req.headers.get("x-forwarded-for") ?? null,
  });

  return NextResponse.json({ ok: true, enabled });
}
