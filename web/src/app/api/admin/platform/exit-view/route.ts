// POST /api/admin/platform/exit-view — view-as 종료, 자기 currentTeam 으로 복귀.
// 권한: Owner only. audit log 1개.

import { NextRequest, NextResponse } from "next/server";
import { IS_LOCAL_MODE } from "@/lib/db";
import { requireOwner } from "@/lib/auth-guards";
import { writeAudit } from "@/lib/audit";
import { PLATFORM_VIEW_AS_COOKIE } from "@/lib/effective-team";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });
  const guard = await requireOwner();
  if (guard.error) return guard.error;

  const previousTeamId = req.cookies.get(PLATFORM_VIEW_AS_COOKIE)?.value;

  await writeAudit({
    teamId: guard.user.currentTeamId,
    actorUserId: guard.user.id,
    action: "platform.team_exit_view",
    targetType: previousTeamId ? "team" : null,
    targetId: previousTeamId ? parseInt(previousTeamId, 10) : null,
    metadata: { previousTeamId: previousTeamId ?? null },
    ip: req.headers.get("x-forwarded-for") ?? null,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(PLATFORM_VIEW_AS_COOKIE);
  return res;
}
