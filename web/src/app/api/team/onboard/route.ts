// PATCH /api/team/onboard — 어드민이 본인 팀의 회사명을 처음 설정.
//
// 트리거 조건: 본인 currentTeam.namePending === true 일 때만 동작.
//   - 그 외 상태에서 호출하면 409 (already_named).
//   - body: { teamName }
//   - 동작: teams.name UPDATE + slug 재생성 + namePending = false.
//   - audit_logs: team.onboard.set_name.
//
// 권한: 세션만 있으면 OK (본인 currentTeam 한정). admin 권한 별도 검증 안 함 — 어차피
//   namePending 인 팀은 초대받은 admin/owner 1명만 있는 갓 생성 상태.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, teams, IS_LOCAL_MODE } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { eq, and, isNull, ne } from "drizzle-orm";

export const dynamic = "force-dynamic";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64);
}

export async function PATCH(req: NextRequest) {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });

  const session = await getServerSession(authOptions);
  const sessUser = session?.user as
    | { id?: number; currentTeamId?: number | null }
    | undefined;
  if (!sessUser?.id || !sessUser.currentTeamId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { teamName } = body as { teamName?: string };
  const trimmed = teamName?.trim() ?? "";
  if (trimmed.length < 4 || trimmed.length > 20) {
    return NextResponse.json({ error: "invalid_team_name" }, { status: 400 });
  }

  const slug = slugify(trimmed);
  if (!slug) return NextResponse.json({ error: "team_name_invalid_chars" }, { status: 400 });

  // 본인 팀 상태 확인 — namePending true 일 때만.
  const teamRow = await db
    .select({ id: teams.id, namePending: teams.namePending, name: teams.name })
    .from(teams)
    .where(and(eq(teams.id, sessUser.currentTeamId), isNull(teams.deletedAt)))
    .limit(1);
  if (!teamRow[0]) return NextResponse.json({ error: "team_not_found" }, { status: 404 });
  if (!teamRow[0].namePending) {
    return NextResponse.json({ error: "already_named", currentName: teamRow[0].name }, { status: 409 });
  }

  // slug 중복 — 다른 팀이 같은 slug 면 409.
  const slugClash = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.slug, slug), ne(teams.id, sessUser.currentTeamId)))
    .limit(1);
  if (slugClash[0]) {
    return NextResponse.json({ error: "slug_taken", slug }, { status: 409 });
  }

  await db
    .update(teams)
    .set({ name: trimmed, slug, namePending: false })
    .where(eq(teams.id, sessUser.currentTeamId));

  await writeAudit({
    teamId: sessUser.currentTeamId,
    actorUserId: sessUser.id,
    action: "team.onboard.set_name",
    targetType: "team",
    targetId: sessUser.currentTeamId,
    metadata: { name: trimmed, slug },
    ip: req.headers.get("x-forwarded-for") ?? null,
  });

  return NextResponse.json({ ok: true, name: trimmed, slug });
}
