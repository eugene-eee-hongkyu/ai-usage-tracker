// POST /api/admin/platform/switch-team — platform owner 가 다른 팀으로 view-as 진입.
// 권한: Owner only (글로벌 admin). audit log 1개 남김.
// 효과: cookie `platform-view-as` 를 teamId 로 set. 모든 후속 admin API 가
// effectiveTeamId = teamId 로 동작. 자기 회사로 복귀는 /exit-view.

import { NextRequest, NextResponse } from "next/server";
import { db, teams, IS_LOCAL_MODE } from "@/lib/db";
import { requireOwner } from "@/lib/auth-guards";
import { writeAudit } from "@/lib/audit";
import { PLATFORM_VIEW_AS_COOKIE } from "@/lib/effective-team";
import { eq, and, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });
  const guard = await requireOwner();
  if (guard.error) return guard.error;

  const body = await req.json().catch(() => ({}));
  const { teamId } = body as { teamId?: number };
  if (!teamId || typeof teamId !== "number") {
    return NextResponse.json({ error: "team_id_required" }, { status: 400 });
  }

  const team = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug })
    .from(teams)
    .where(and(eq(teams.id, teamId), isNull(teams.deletedAt)))
    .limit(1);
  if (!team[0]) return NextResponse.json({ error: "team_not_found" }, { status: 404 });

  // 자기 currentTeamId 로 switch 시도는 거부 — exit-view 와 의미 같음.
  if (teamId === guard.user.currentTeamId) {
    return NextResponse.json({ error: "already_current_team" }, { status: 400 });
  }

  await writeAudit({
    teamId,
    actorUserId: guard.user.id,
    action: "platform.team_switch",
    targetType: "team",
    targetId: teamId,
    metadata: { teamName: team[0].name, slug: team[0].slug, fromTeamId: guard.user.currentTeamId },
    ip: req.headers.get("x-forwarded-for") ?? null,
    actorIsPlatformOwner: true,
  });

  const res = NextResponse.json({ ok: true, teamId, teamName: team[0].name });
  res.cookies.set(PLATFORM_VIEW_AS_COOKIE, String(teamId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // session cookie — 브라우저 닫으면 자동 만료. 명시적 exit 권장.
  });
  return res;
}
