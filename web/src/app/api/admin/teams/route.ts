// POST /api/admin/teams — Owner 가 새 팀 생성 + 첫 owner 에게 invitation 발송
// GET /api/admin/teams — 팀 리스트 (자기 팀 + Owner 면 모든 팀)
//
// 권한: Owner only (ADMIN_EMAIL env). 일반 admin 은 자기 팀 멤버 관리만.
//
// 흐름 (POST):
//   1) teamName + ownerEmail 검증
//   2) 새 teams INSERT (slug 자동 생성)
//   3) 새 invitation INSERT (teamId=new, role='admin', permissions={ membershipAdmin: true })
//      — role 'owner' 는 ADMIN_EMAIL env 기반이라 별개. 팀 owner 권한은
//        team_members.role='owner' 로 표현 (signIn callback 에서 invitation.role 그대로 박힘).
//   4) Resend 이메일 발송
//   5) audit_logs
//
// LOCAL_MODE 차단 (.dmg 는 single-tenant single-user).

import { NextRequest, NextResponse } from "next/server";
import { db, teams, teamMembers, invitations, users, IS_LOCAL_MODE } from "@/lib/db";
import { requireOwner } from "@/lib/auth-guards";
import { writeAudit } from "@/lib/audit";
import { sendInvitation } from "@/lib/email";
import { eq, and, isNull, inArray } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const EXPIRES_DAYS = 7;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64);
}

export async function POST(req: NextRequest) {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });
  const guard = await requireOwner();
  if (guard.error) return guard.error;

  const body = await req.json().catch(() => ({}));
  const { teamName, ownerEmail, locale = "ko" } = body as {
    teamName?: string;
    ownerEmail?: string;
    locale?: "ko" | "en";
  };

  // teamName 은 선택 — 비우면 어드민이 가입 후 /onboard-team 에서 직접 정함.
  // 입력했으면 4~20자 검증.
  const teamNameTrimmed = teamName?.trim() ?? "";
  const namePending = teamNameTrimmed.length === 0;
  if (!namePending && (teamNameTrimmed.length < 4 || teamNameTrimmed.length > 20)) {
    return NextResponse.json({ error: "invalid_team_name" }, { status: 400 });
  }

  if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    return NextResponse.json({ error: "invalid_owner_email" }, { status: 400 });
  }

  // slug 결정: 이름 있으면 slugify, 없으면 random suffix 한 임시 slug.
  // 임시 slug 는 어드민이 회사명을 정할 때 PATCH /api/team/onboard 에서 갱신.
  let slug: string;
  if (namePending) {
    slug = `team-pending-${crypto.randomBytes(4).toString("hex")}`;
  } else {
    slug = slugify(teamNameTrimmed);
    if (!slug) return NextResponse.json({ error: "team_name_invalid_chars" }, { status: 400 });
    const existingSlug = await db.select({ id: teams.id }).from(teams).where(eq(teams.slug, slug)).limit(1);
    if (existingSlug[0]) {
      return NextResponse.json({ error: "slug_taken", slug }, { status: 409 });
    }
  }

  // ownerEmail 이 이미 다른 팀의 user 인 경우 — 막지 않음. 한 user 가 N팀 가능 (M6b 후속).
  // 다만 같은 이메일로 pending invitation 있으면 중복 방지.
  const pendingInv = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(eq(invitations.email, ownerEmail), isNull(invitations.acceptedAt), isNull(invitations.cancelledAt))
    )
    .limit(1);
  if (pendingInv[0]) {
    return NextResponse.json({ error: "invitation_pending", invitationId: pendingInv[0].id }, { status: 409 });
  }

  // 보안 감사 (2026-05-28): ownerEmail 도메인 자동 등록 제거.
  // 옛 동작은 ownerEmail 의 도메인이 public 아니면 autoJoinDomains 에 즉시 등록
  // → Platform Admin 이 phishing 으로 잘못된 도메인을 입력 시 그 도메인의 *모든*
  // 신규 가입자가 자동으로 팀에 합류하는 사이드 채널. owner 가 실제로 가입 후
  // /onboard-team 단계에서 명시 동의할 때만 등록되도록 일원화.
  // (현재 onboard 흐름: PATCH /api/team/onboard 가 owner 본인 OAuth email 도메인을
  // autoJoinDomains 에 추가 — single source of truth.)
  const autoJoinDomains: string[] = [];

  // 1) 새 팀 INSERT — owner_id 는 임시로 admin (guard.user.id) 박음. ehongarykr 가 가입 후
  //    별도 액션으로 owner 권한 이양 (M6c). 또는 가입 시 자동 이양 — 후속.
  const teamInserted = await db
    .insert(teams)
    .values({
      name: namePending ? "(pending)" : teamNameTrimmed,
      slug,
      ownerId: guard.user.id, // 임시 — 가입 후 ehongarykr 의 id 로 교체 (M6c)
      namePending,
      autoJoinDomains,
    })
    .returning({ id: teams.id });
  const newTeamId = teamInserted[0].id;

  // 2) ownerEmail 이 이미 user 인지 확인. user 면 즉시 team_members 추가.
  const existingUser = await db.select({ id: users.id }).from(users).where(eq(users.email, ownerEmail)).limit(1);

  // 3) invitation 생성 (신규 user 면) OR 즉시 team_members 추가 (기존 user)
  let invitationId: number | null = null;
  let emailSent = false;
  let emailError: string | null = null;

  if (existingUser[0]) {
    // 기존 user — 즉시 team_members INSERT (owner role) + 알림 이메일 (optional)
    await db.insert(invitations).values({
      teamId: newTeamId,
      email: ownerEmail,
      invitedBy: guard.user.id,
      token: crypto.randomBytes(32).toString("hex"),
      role: "admin",
      permissions: { membershipAdmin: true, billingAdmin: true },
      expiresAt: new Date(Date.now() + EXPIRES_DAYS * 24 * 60 * 60 * 1000),
      acceptedAt: new Date(), // 즉시 accept 처리
    });
    // teamMembers 직접 INSERT 는 별도 import 필요 — 일단 invitation 가입 흐름 (signIn 콜백) 활용
    // 기존 user 가 다시 signIn 하면 invitation 매칭 → team_members 자동 INSERT.
    // 다만 invitation.acceptedAt 박혀있으면 signIn 콜백이 invitation 못 찾음. 별도 처리:
    const { teamMembers } = await import("@/lib/db");
    await db
      .insert(teamMembers)
      .values({
        teamId: newTeamId,
        userId: existingUser[0].id,
        role: "owner",
      })
      .onConflictDoNothing();
  } else {
    // 신규 user — invitation 발송
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    const invInserted = await db
      .insert(invitations)
      .values({
        teamId: newTeamId,
        email: ownerEmail,
        invitedBy: guard.user.id,
        token,
        role: "admin",
        permissions: { membershipAdmin: true, billingAdmin: true },
        expiresAt,
      })
      .returning({ id: invitations.id });
    invitationId = invInserted[0].id;

    const mail = await sendInvitation({
      to: ownerEmail,
      inviterName: guard.user.name ?? "Team admin",
      token,
      locale,
    });
    emailSent = mail.ok;
    emailError = mail.ok ? null : mail.error ?? null;
  }

  await writeAudit({
    teamId: newTeamId,
    actorUserId: guard.user.id,
    action: "team.create",
    targetType: "team",
    targetId: newTeamId,
    metadata: { teamName: teamNameTrimmed, namePending, slug, ownerEmail, invitationId, hadExistingUser: !!existingUser[0] },
    ip: req.headers.get("x-forwarded-for") ?? null,
  });

  return NextResponse.json({
    ok: true,
    teamId: newTeamId,
    slug,
    invitationId,
    emailSent,
    emailError,
    hadExistingUser: !!existingUser[0],
  });
}

export async function GET(req: NextRequest) {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });
  const guard = await requireOwner();
  if (guard.error) return guard.error;

  const url = new URL(req.url);
  const includeMembers = url.searchParams.get("include") === "members";

  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      ownerId: teams.ownerId,
      namePending: teams.namePending,
      maxMembers: teams.maxMembers,
      type: teams.type,
      createdAt: teams.createdAt,
      deletedAt: teams.deletedAt,
    })
    .from(teams)
    .orderBy(teams.id);

  if (!includeMembers) {
    return NextResponse.json({ teams: rows });
  }

  // 멤버 + 멤버 수 포함. team_members JOIN users.
  if (rows.length === 0) return NextResponse.json({ teams: [] });
  const teamIds = rows.map((r) => r.id);
  const memberRows = await db
    .select({
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
      email: users.email,
      name: users.name,
    })
    .from(teamMembers)
    .leftJoin(users, eq(teamMembers.userId, users.id))
    .where(and(inArray(teamMembers.teamId, teamIds), isNull(teamMembers.deletedAt)));

  const byTeam = new Map<number, typeof memberRows>();
  for (const m of memberRows) {
    if (!byTeam.has(m.teamId)) byTeam.set(m.teamId, []);
    byTeam.get(m.teamId)!.push(m);
  }

  const teamsWithMembers = rows.map((t) => {
    const members = byTeam.get(t.id) ?? [];
    return {
      ...t,
      memberCount: members.length,
      members: members.map((m) => ({
        userId: m.userId,
        email: m.email ?? "(deleted)",
        name: m.name ?? "(deleted)",
        role: m.role,
      })),
    };
  });

  return NextResponse.json({ teams: teamsWithMembers });
}
