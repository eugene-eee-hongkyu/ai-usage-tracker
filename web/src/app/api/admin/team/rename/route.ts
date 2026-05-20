// PATCH /api/admin/team/rename — 팀 이름 변경.
//
// 권한: Team Owner (currentTeamRole='owner') 또는 Platform Admin.
//   /admin/settings 페이지 visible 조건과 동일.
//
// 동작:
//   - body: { teamName } (4~20자)
//   - currentTeamId 의 teams.name + slug UPDATE (slug 재생성, 충돌 시 409)
//   - namePending=true 인 팀은 거부 (이건 /api/team/onboard 흐름)
//   - audit_logs 기록

import { NextRequest, NextResponse } from "next/server";
import { db, teams, IS_LOCAL_MODE } from "@/lib/db";
import { requireUser } from "@/lib/auth-guards";
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

  const guard = await requireUser();
  if (guard.error) return guard.error;
  // Team Owner 또는 Platform Admin 만.
  const isTeamOwner = guard.user.currentTeamRole === "owner";
  if (!guard.user.isPlatformAdmin && !isTeamOwner) {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { teamName } = body as { teamName?: string };
  const trimmed = teamName?.trim() ?? "";
  if (trimmed.length < 4 || trimmed.length > 20) {
    return NextResponse.json({ error: "invalid_team_name" }, { status: 400 });
  }
  const slug = slugify(trimmed);
  if (!slug) return NextResponse.json({ error: "team_name_invalid_chars" }, { status: 400 });

  const teamId = guard.user.currentTeamId;

  // namePending=true 인 팀은 onboard 흐름. 여기서 거부 — 사용자가 /onboard-team 으로 가야.
  const teamRow = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug, namePending: teams.namePending })
    .from(teams)
    .where(and(eq(teams.id, teamId), isNull(teams.deletedAt)))
    .limit(1);
  if (!teamRow[0]) return NextResponse.json({ error: "team_not_found" }, { status: 404 });
  if (teamRow[0].namePending) {
    return NextResponse.json({ error: "use_onboard_endpoint" }, { status: 409 });
  }

  // slug 중복 — 다른 팀이 같은 slug 면 409.
  const slugClash = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.slug, slug), ne(teams.id, teamId)))
    .limit(1);
  if (slugClash[0]) {
    return NextResponse.json({ error: "slug_taken", slug }, { status: 409 });
  }

  // 같은 이름 + 같은 slug 면 no-op.
  if (teamRow[0].name === trimmed && teamRow[0].slug === slug) {
    return NextResponse.json({ ok: true, noop: true, name: trimmed, slug });
  }

  await db.update(teams).set({ name: trimmed, slug }).where(eq(teams.id, teamId));

  await writeAudit({
    teamId,
    actorUserId: guard.user.id,
    action: "team.rename",
    targetType: "team",
    targetId: teamId,
    metadata: {
      previousName: teamRow[0].name,
      previousSlug: teamRow[0].slug,
      newName: trimmed,
      newSlug: slug,
    },
    ip: req.headers.get("x-forwarded-for") ?? null,
  });

  return NextResponse.json({ ok: true, name: trimmed, slug });
}
