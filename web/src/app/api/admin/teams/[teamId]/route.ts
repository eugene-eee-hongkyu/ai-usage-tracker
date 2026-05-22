// PATCH /api/admin/teams/[teamId] — Platform Admin 이 팀 속성 수정.
// 현재 지원: { maxMembers: number } — 회사별 활성 멤버 cap.
//
// 권한: Platform Admin (ADMIN_EMAIL env) 만. 일반 팀 owner/admin 은 통과 X.
// LOCAL_MODE 차단 (.dmg 는 single-tenant).

import { NextRequest, NextResponse } from "next/server";
import { db, teams, IS_LOCAL_MODE } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth-guards";
import { writeAudit } from "@/lib/audit";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const MIN_CAP = 1;
const MAX_CAP = 1000;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { teamId: string } }
) {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });
  const guard = await requirePlatformAdmin();
  if (guard.error) return guard.error;

  const teamId = parseInt(params.teamId, 10);
  if (!teamId || Number.isNaN(teamId)) {
    return NextResponse.json({ error: "invalid_team_id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { maxMembers } = body as { maxMembers?: number };

  if (typeof maxMembers !== "number" || !Number.isInteger(maxMembers)) {
    return NextResponse.json({ error: "maxMembers_required_integer" }, { status: 400 });
  }
  if (maxMembers < MIN_CAP || maxMembers > MAX_CAP) {
    return NextResponse.json(
      { error: "maxMembers_out_of_range", min: MIN_CAP, max: MAX_CAP },
      { status: 400 }
    );
  }

  const existing = await db
    .select({ id: teams.id, maxMembers: teams.maxMembers, name: teams.name })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  if (!existing[0]) {
    return NextResponse.json({ error: "team_not_found" }, { status: 404 });
  }
  const prev = existing[0].maxMembers;

  await db.update(teams).set({ maxMembers }).where(eq(teams.id, teamId));

  await writeAudit({
    teamId,
    actorUserId: guard.user.id,
    action: "team.cap.update",
    targetType: "team",
    targetId: teamId,
    metadata: { teamName: existing[0].name, prev, next: maxMembers },
    ip: req.headers.get("x-forwarded-for") ?? null,
  });

  return NextResponse.json({ ok: true, teamId, maxMembers });
}
