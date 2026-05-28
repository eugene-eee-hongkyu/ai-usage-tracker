// POST /api/personal/toggle — 랭킹 참여 (personal) 토글.
// personal=true 면 personal 팀에 team_members 등록 + users.personal=true.
// personal=false 면 personal 팀에서 team_members 제거 + users.personal=false.

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, users, teams, teamMembers } from "@/lib/db";
import { and, eq, isNull } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { personal } = body as { personal?: boolean };
  if (typeof personal !== "boolean")
    return NextResponse.json({ error: "invalid" }, { status: 400 });

  const userRow = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);
  const userId = userRow[0]?.id;
  if (!userId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const personalTeamRow = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.type, "personal"))
    .limit(1);
  const personalTeamId = personalTeamRow[0]?.id;
  if (!personalTeamId)
    return NextResponse.json({ error: "personal_team_not_found" }, { status: 500 });

  if (personal) {
    await db.update(users).set({ personal: true }).where(eq(users.id, userId));
    await db
      .insert(teamMembers)
      .values({ teamId: personalTeamId, userId, role: "member" })
      .onConflictDoNothing();
  } else {
    // personal OFF 시 normal 팀에 속해있는지 확인. 없으면 거부
    // (personal 만 있는 사용자가 OFF 하면 어디에도 속하지 않아 403 상태)
    const normalTeamMembership = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(
        and(
          eq(teamMembers.userId, userId),
          isNull(teamMembers.deletedAt),
          isNull(teams.deletedAt),
          eq(teams.type, "normal")
        )
      )
      .limit(1);
    if (!normalTeamMembership[0])
      return NextResponse.json({ error: "no_team", message: "팀에 소속되어야 랭킹 참여를 해제할 수 있습니다." }, { status: 400 });

    await db.update(users).set({ personal: false }).where(eq(users.id, userId));
    await db
      .update(teamMembers)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(teamMembers.teamId, personalTeamId),
          eq(teamMembers.userId, userId),
          isNull(teamMembers.deletedAt)
        )
      );
  }

  return NextResponse.json({ ok: true, personal });
}
