import type { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { db, users, teamMembers, teams } from "@/lib/db";
import { eq, and, isNull, asc, sql } from "drizzle-orm";
import { isAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { PLATFORM_VIEW_AS_COOKIE } from "@/lib/effective-team";

// e2e Credentials provider — NODE_ENV='test' 일 때만 활성.
// 보안 감사 (2026-05-28): 옛 Z21_E2E_AUTH / PRIMUS_E2E_AUTH env 가드 제거.
// prod 에 실수로 둘 중 하나라도 설정되면 누구나 임의 email 로 로그인 가능한
// 단일 실패 모드라 NODE_ENV=test 단독으로 좁힘. e2e runner 는 NODE_ENV=test
// 로 spawn 하므로 영향 없음. (Vercel prod 는 NODE_ENV=production 강제.)
const e2eEnabled = process.env.NODE_ENV === "test";

const providers = [
  GithubProvider({
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  }),
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  }),
];

if (e2eEnabled) {
  providers.push(
    CredentialsProvider({
      id: "credentials",
      name: "E2E Credentials",
      credentials: { email: { label: "Email", type: "text" } },
      async authorize(credentials) {
        const email = credentials?.email;
        if (typeof email !== "string" || email.length === 0) return null;
        return { id: email, email, name: email.split("@")[0] };
      },
    }) as never,
  );
}

// ALLOWED_EMAIL_DOMAINS: 쉼표 구분 (예: "yourcompany.com,yourcompany.io")
// 비어 있으면 모든 도메인 허용
const rawDomains = process.env.ALLOWED_EMAIL_DOMAINS ?? process.env.ALLOWED_EMAIL_DOMAIN ?? "";
const ALLOWED_DOMAINS = rawDomains
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);

function isEmailAllowed(email: string) {
  if (ALLOWED_DOMAINS.length === 0) return true;
  return ALLOWED_DOMAINS.some((d) => email.endsWith(`@${d}`));
}

export const authOptions: NextAuthOptions = {
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      const email = user.email ?? "";
      const provider = account?.provider ?? "unknown";

      try {
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        // 보안 감사 (2026-05-28, H1 temp A): OAuth provider lock-in.
        //   - users.provider IS NULL  → legacy 사용자, 현재 provider 로 backfill 후 통과
        //   - users.provider == 현재 provider → 통과
        //   - users.provider != 현재 provider → reject (account takeover 차단)
        // 옛 동작은 email 단독 매칭 — GitHub primary email 미인증 + 옛 Google
        // 가입자 시나리오에서 다른 provider 의 unverified email 로 행 탈취 가능했음.
        // 정식 fix (옵션 B: 표준 oauth_accounts 테이블) 도입 전까지 임시 가드.
        if (existing.length > 0) {
          const u = existing[0];
          if (u.provider && u.provider !== provider) {
            await writeAudit({
              actorUserId: u.id,
              actorType: "user",
              action: "auth.rejected.provider_mismatch",
              targetType: "user",
              targetId: u.id,
              metadata: { email, attemptedProvider: provider, storedProvider: u.provider },
            });
            return `/login?error=provider_mismatch`;
          }
          if (u.provider === null) {
            // legacy backfill — 첫 OAuth 로그인 시점에 영구 lock.
            await db.update(users).set({ provider }).where(eq(users.id, u.id));
          }
          if (u.deletedAt) {
            await writeAudit({
              actorUserId: u.id,
              actorType: "user",
              action: "auth.rejected.deleted",
              targetType: "user",
              targetId: u.id,
              metadata: { email, provider },
            });
            return `/login?error=deleted`;
          }
          if (u.suspendedAt) {
            await writeAudit({
              actorUserId: u.id,
              actorType: "user",
              action: "auth.rejected.suspended",
              targetType: "user",
              targetId: u.id,
              metadata: { email, provider },
            });
            return `/login?error=suspended`;
          }

          // 기존 사용자에 대해 invitation 매칭 → team_members INSERT (users INSERT skip)
          const { invitations: invTable } = await import("@/lib/db");
          const { and: andOp, isNull: isNullOp } = await import("drizzle-orm");
          const existingInvite = await db
            .select({
              id: invTable.id,
              role: invTable.role,
              expiresAt: invTable.expiresAt,
              teamId: invTable.teamId,
            })
            .from(invTable)
            .where(
              andOp(
                eq(invTable.email, email),
                isNullOp(invTable.acceptedAt),
                isNullOp(invTable.cancelledAt)
              )
            )
            .limit(1);
          if (existingInvite[0] && existingInvite[0].expiresAt < new Date()) {
            // 만료 invitation: cancelledAt 박고 신규 사용자 분기와 동일하게
            // invitation_expired 에러로 거부. 옛 비대칭 (기존 사용자는 silent
            // 통과) 은 사용자 혼동 — "초대 받았는데 가입 안 되네" 가 명시적
            // 메시지로 표시되어야 함 (2026-05-28 결정).
            await db
              .update(invTable)
              .set({ cancelledAt: new Date() })
              .where(eq(invTable.id, existingInvite[0].id));
            await writeAudit({
              teamId: existingInvite[0].teamId,
              actorUserId: u.id,
              actorType: "user",
              action: "invitation.expired",
              targetType: "invitation",
              targetId: existingInvite[0].id,
              metadata: { email, provider, userType: "existing" },
            });
            return `/login?error=invitation_expired`;
          } else if (existingInvite[0]) {
            const inv = existingInvite[0];
            const alreadyMember = await db
              .select({ id: teamMembers.id })
              .from(teamMembers)
              .where(andOp(eq(teamMembers.userId, u.id), eq(teamMembers.teamId, inv.teamId), isNullOp(teamMembers.deletedAt)))
              .limit(1);
            if (!alreadyMember[0]) {
              const teamRole = inv.role === "owner" || inv.role === "admin" ? inv.role : "member";
              await db.insert(teamMembers).values({ teamId: inv.teamId, userId: u.id, role: teamRole }).onConflictDoNothing();
              // 결정 3 (2026-05-28): personal 사용자가 normal 팀에 가입하면
              // personal flag 자동 해제. 부정합 상태 (personal=true + normal
              // 팀 멤버) 방지 — ranking 라우트가 users.personal 만 보기 때문.
              if (u.personal) {
                const inviteTeamType = await db
                  .select({ type: teams.type })
                  .from(teams)
                  .where(eq(teams.id, inv.teamId))
                  .limit(1);
                if (inviteTeamType[0]?.type === "normal") {
                  await db.update(users).set({ personal: false }).where(eq(users.id, u.id));
                }
              }
              await writeAudit({
                teamId: inv.teamId,
                actorUserId: u.id,
                action: "user.team_join.via_invite",
                targetType: "team",
                targetId: inv.teamId,
                metadata: { email, provider, invitationId: inv.id },
              });
            }
            await db.update(invTable).set({ acceptedAt: new Date() }).where(eq(invTable.id, inv.id));
          }

          // 기존 사용자에 대해 auto-join 도메인 매칭 → team_members INSERT
          const { and: andOp2, isNull: isNullOp2 } = await import("drizzle-orm");
          const existingDomain = email.split("@")[1]?.toLowerCase();
          if (existingDomain && isEmailAllowed(email)) {
            const autoTeam = await db
              .select({ id: teams.id, maxMembers: teams.maxMembers })
              .from(teams)
              .where(
                andOp2(
                  isNullOp2(teams.deletedAt),
                  eq(teams.namePending, false),
                  eq(teams.autoJoinEnabled, true),
                  eq(teams.type, "normal"),
                  sql`${teams.autoJoinDomains} @> ${JSON.stringify([existingDomain])}::jsonb`
                )
              )
              .limit(1);
            if (autoTeam[0]) {
              const alreadyMember = await db
                .select({ id: teamMembers.id })
                .from(teamMembers)
                .where(andOp2(eq(teamMembers.userId, u.id), eq(teamMembers.teamId, autoTeam[0].id), isNullOp2(teamMembers.deletedAt)))
                .limit(1);
              if (!alreadyMember[0]) {
                // 보안 감사 (2026-05-28, M1): cap check + INSERT race fix.
                // 옛 동작은 SELECT count → INSERT 비원자성 → 같은 도메인 동시 OAuth N명이
                // cap 검사 통과 후 모두 INSERT → cap 초과. /api/admin/invitations 와
                // 동일 패턴 (transaction + pg_advisory_xact_lock(teamId)).
                let didJoin = false;
                await db.transaction(async (tx) => {
                  await tx.execute(sql`SELECT pg_advisory_xact_lock(${autoTeam[0].id})`);
                  const activeCount = await tx
                    .select({ c: sql<number>`count(*)::int` })
                    .from(teamMembers)
                    .where(andOp2(eq(teamMembers.teamId, autoTeam[0].id), isNullOp2(teamMembers.deletedAt)));
                  if ((activeCount[0]?.c ?? 0) < autoTeam[0].maxMembers) {
                    await tx.insert(teamMembers).values({ teamId: autoTeam[0].id, userId: u.id, role: "member" }).onConflictDoNothing();
                    // 결정 3 (2026-05-28): auto-join 은 query 자체가 normal 팀
                    // 으로 제한 (eq(teams.type, "normal")) — personal flag 자동
                    // 해제. type check 불필요.
                    if (u.personal) {
                      await tx.update(users).set({ personal: false }).where(eq(users.id, u.id));
                    }
                    didJoin = true;
                  }
                });
                if (didJoin) {
                  await writeAudit({
                    teamId: autoTeam[0].id,
                    actorUserId: u.id,
                    action: "user.team_join.auto_domain",
                    targetType: "team",
                    targetId: autoTeam[0].id,
                    metadata: { email, provider, domain: existingDomain },
                  });
                }
              }
            }
          }

          return true;
        }

        // 신규 사용자: invitation 우선 조회. 명시 초대받은 사람은 도메인 화이트리스트 우회.
        const { invitations } = await import("@/lib/db");
        const { and, isNull } = await import("drizzle-orm");
        const invite = await db
          .select({
            id: invitations.id,
            role: invitations.role,
            permissions: invitations.permissions,
            expiresAt: invitations.expiresAt,
            teamId: invitations.teamId,
          })
          .from(invitations)
          .where(
            and(
              eq(invitations.email, email),
              isNull(invitations.acceptedAt),
              isNull(invitations.cancelledAt)
            )
          )
          .limit(1);

        if (invite[0]) {
          // 만료된 invitation — cancel 마킹 후 가입 거부
          if (invite[0].expiresAt < new Date()) {
            await db
              .update(invitations)
              .set({ cancelledAt: new Date() })
              .where(eq(invitations.id, invite[0].id));
            await writeAudit({
              teamId: invite[0].teamId,
              actorUserId: null,
              actorType: "system",
              action: "invitation.expired",
              targetType: "invitation",
              targetId: invite[0].id,
              metadata: { email, provider },
            });
            return `/login?error=invitation_expired`;
          }
          // 자동 가입 + invitation accept (도메인 우회)
          // B7 (2026-05-28): 동시 OAuth 가입 race — users.email unique violation 시
          // existing 재조회로 fallback. silent 통과 (이미 다른 동시 요청이 가입 처리).
          let inserted: { id: number }[];
          try {
            inserted = await db
              .insert(users)
              .values({
                githubId: String((profile as Record<string, unknown>)?.id ?? account?.providerAccountId),
                email,
                name: user.name ?? email.split("@")[0],
                avatarUrl: user.image ?? null,
                role: invite[0].role,
                permissions: invite[0].permissions,
                provider,
              })
              .returning({ id: users.id });
          } catch (insertErr) {
            const refetch = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
            if (!refetch[0]) throw insertErr;
            inserted = [{ id: refetch[0].id }];
          }
          await db
            .update(invitations)
            .set({ acceptedAt: new Date() })
            .where(eq(invitations.id, invite[0].id));
          const newUserId = inserted[0]?.id ?? null;
          // Phase 4.2 (M6a): invitation 의 team_id 로 team_members 도 같이 INSERT.
          // 가입 직후 session callback 이 currentTeamId 채울 수 있게.
          if (newUserId && invite[0].teamId) {
            // invitation.role 은 'owner' | 'admin' | 'member' 셋만 허용 (POST 가드에서 검증).
            // 화이트리스트 외 값은 안전하게 'member' 로 fallback.
            const teamRole =
              invite[0].role === "owner" || invite[0].role === "admin" ? invite[0].role : "member";
            await db.insert(teamMembers).values({
              teamId: invite[0].teamId,
              userId: newUserId,
              role: teamRole,
            }).onConflictDoNothing();
          }
          await writeAudit({
            teamId: invite[0].teamId,
            actorUserId: newUserId,
            actorType: "user",
            action: "user.create.via_invite",
            targetType: "user",
            targetId: newUserId,
            metadata: { email, provider, role: invite[0].role, invitationId: invite[0].id, teamId: invite[0].teamId },
          });
          await writeAudit({
            teamId: invite[0].teamId,
            actorUserId: newUserId,
            actorType: "user",
            action: "invitation.accept",
            targetType: "invitation",
            targetId: invite[0].id,
            metadata: { email, provider, newUserId, teamId: invite[0].teamId },
          });
          return true;
        }

        // M6f (2026-05-21): email 도메인이 어떤 팀의 auto_join_domains 에 포함되면
        // 그 팀 member 로 즉시 자동 가입. invitation 없어도 OAuth ownership 으로 충분.
        // 도메인 화이트리스트 (isEmailAllowed) 는 auto-join 팀 매칭에만 영향 —
        // Personal 기능 도입으로 "매칭 안 되면 personal 팀 가입" 으로 fallback.
        const emailDomain = email.split("@")[1]?.toLowerCase();
        if (emailDomain && isEmailAllowed(email)) {
          const autoTeamRows = await db
            .select({ id: teams.id, maxMembers: teams.maxMembers })
            .from(teams)
            .where(
              and(
                isNull(teams.deletedAt),
                eq(teams.namePending, false),
                eq(teams.autoJoinEnabled, true),
                eq(teams.type, "normal"),
                sql`${teams.autoJoinDomains} @> ${JSON.stringify([emailDomain])}::jsonb`
              )
            )
            .limit(1);
          if (autoTeamRows[0]) {
            const autoTeamId = autoTeamRows[0].id;
            const cap = autoTeamRows[0].maxMembers;

            // 보안 감사 (2026-05-28, M1): cap check + INSERT race fix.
            // 신규 사용자 + auto-join 분기 — 같은 도메인 동시 OAuth 가입 시 cap 초과 차단.
            // users INSERT 는 unique email 제약으로 자체 race-safe, team_members INSERT
            // 는 cap 검사와 함께 advisory lock 으로 직렬화.
            // B7: users INSERT race → existing 재조회 fallback (lock 밖에서 수행 OK,
            // users.email unique 가 보호).
            let inserted: { id: number }[];
            try {
              inserted = await db
                .insert(users)
                .values({
                  githubId: String((profile as Record<string, unknown>)?.id ?? account?.providerAccountId),
                  email,
                  name: user.name ?? email.split("@")[0],
                  avatarUrl: user.image ?? null,
                  role: "member",
                  permissions: {},
                  provider,
                })
                .returning({ id: users.id });
            } catch (insertErr) {
              const refetch = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
              if (!refetch[0]) throw insertErr;
              inserted = [{ id: refetch[0].id }];
            }
            const newUserId = inserted[0]?.id ?? null;
            if (newUserId) {
              let didJoin = false;
              await db.transaction(async (tx) => {
                await tx.execute(sql`SELECT pg_advisory_xact_lock(${autoTeamId})`);
                const activeCount = await tx
                  .select({ c: sql<number>`count(*)::int` })
                  .from(teamMembers)
                  .where(and(eq(teamMembers.teamId, autoTeamId), isNull(teamMembers.deletedAt)));
                if ((activeCount[0]?.c ?? 0) < cap) {
                  await tx.insert(teamMembers).values({
                    teamId: autoTeamId,
                    userId: newUserId,
                    role: "member",
                  }).onConflictDoNothing();
                  didJoin = true;
                }
              });
              if (didJoin) {
                await writeAudit({
                  teamId: autoTeamId,
                  actorUserId: newUserId,
                  actorType: "system",
                  action: "user.create.auto_join_domain",
                  targetType: "user",
                  targetId: newUserId,
                  metadata: { email, provider, domain: emailDomain, teamId: autoTeamId },
                });
                return true;
              }
              // cap 초과 — users row 는 이미 INSERT 됐으니 아래 personal fallback 에서
              // team_members 만 personal 팀에 등록. (옛 동작은 cap 초과 시 personal 로
              // fallback 했지만 users 가 두 번 INSERT 되었던 잠재 결함은 try/catch + email
              // unique 가 막아줌.)
            }
          }
        }

        // Personal 팀 자동 가입 — invitation / auto-join 모두 매칭 안 된 신규 사용자.
        // 아무 도메인이나 가입 가능. personal=true → 전체 랭킹 참여.
        const personalTeamRow = await db
          .select({ id: teams.id })
          .from(teams)
          .where(eq(teams.type, "personal"))
          .limit(1);
        const personalTeamId = personalTeamRow[0]?.id;
        if (!personalTeamId) {
          console.error("[auth] personal team not found — migration 0013 not applied?");
          return `/login?error=db`;
        }
        // B7: 동시 가입 race → existing 재조회 fallback
        let inserted: { id: number }[];
        try {
          inserted = await db
            .insert(users)
            .values({
              githubId: String((profile as Record<string, unknown>)?.id ?? account?.providerAccountId),
              email,
              name: user.name ?? email.split("@")[0],
              avatarUrl: user.image ?? null,
              role: "member",
              permissions: {},
              personal: true,
              provider,
            })
            .returning({ id: users.id });
        } catch (insertErr) {
          const refetch = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
          if (!refetch[0]) throw insertErr;
          inserted = [{ id: refetch[0].id }];
        }
        const newUserId = inserted[0]?.id ?? null;
        if (newUserId) {
          await db.insert(teamMembers).values({
            teamId: personalTeamId,
            userId: newUserId,
            role: "member",
          }).onConflictDoNothing();
          await writeAudit({
            teamId: personalTeamId,
            actorUserId: newUserId,
            actorType: "system",
            action: "user.create.personal",
            targetType: "user",
            targetId: newUserId,
            metadata: { email, provider },
          });
        }
        return true;
      } catch (err) {
        console.error("[auth] signIn DB error:", err);
        return "/login?error=db";
      }
    },
    async session({ session }) {
      if (session.user?.email) {
        // admin-v1: role/permissions/suspended_at/deleted_at 함께 fetch. 모든 권한 가드
        // (server `requireRole` / client `usePermissions`) 가 session 객체만 읽으면 되도록.
        const row = await db
          .select({
            id: users.id,
            role: users.role,
            permissions: users.permissions,
            suspendedAt: users.suspendedAt,
            deletedAt: users.deletedAt,
            personal: users.personal,
          })
          .from(users)
          .where(eq(users.email, session.user.email))
          .limit(1);
        if (row[0]) {
          // Phase 4.2 (M6a): currentTeamId 결정 — team_members 의 첫 행 (가입 순).
          // M6b 에서 N팀 가입 + cookie/URL 기반 전환 도입 예정. M6a 에선 first team.
          // M6d: teams.name_pending 도 함께 가져와 /onboard-team 가드용으로 노출.
          // Personal 기능: normal 팀 우선, 없으면 personal 팀 fallback.
          // teams.type 을 같이 가져와서 normal 팀이 있는지 판별.
          const memberRows = await db
            .select({
              teamId: teamMembers.teamId,
              teamRole: teamMembers.role,
              teamName: teams.name,
              namePending: teams.namePending,
              teamType: teams.type,
            })
            .from(teamMembers)
            .leftJoin(teams, eq(teams.id, teamMembers.teamId))
            .where(
              and(
                eq(teamMembers.userId, row[0].id),
                isNull(teamMembers.deletedAt),
                isNull(teams.deletedAt)
              )
            )
            .orderBy(asc(teamMembers.joinedAt));
          const normalTeam = memberRows.find((r) => r.teamType === "normal");
          const primaryTeam = normalTeam ?? memberRows[0] ?? null;
          const hasNormalTeam = !!normalTeam;
          const currentTeamId = primaryTeam?.teamId ?? null;
          const currentTeamRole = primaryTeam?.teamRole ?? null;
          const currentTeamName = primaryTeam?.teamName ?? null;
          const currentTeamNamePending = primaryTeam?.namePending ?? false;

          const u = session.user as typeof session.user & {
            id: number;
            role: string;
            permissions: { membershipAdmin?: boolean; billingAdmin?: boolean };
            suspendedAt: Date | null;
            deletedAt: Date | null;
            isPlatformAdmin: boolean;
            isAdmin: boolean;
            currentTeamId: number | null;
            currentTeamRole: string | null;
            currentTeamName: string | null;
            currentTeamNamePending: boolean;
            viewAsTeamId: number | null;
            viewAsTeamName: string | null;
            personal: boolean;
            hasNormalTeam: boolean;
          };
          u.id = row[0].id;
          u.role = row[0].role;
          u.permissions = (row[0].permissions ?? {}) as typeof u.permissions;
          u.suspendedAt = row[0].suspendedAt;
          u.deletedAt = row[0].deletedAt;
          u.currentTeamId = currentTeamId;
          u.currentTeamRole = currentTeamRole;
          u.currentTeamName = currentTeamName;
          u.currentTeamNamePending = currentTeamNamePending;
          // Platform Admin = ADMIN_EMAIL env 화이트리스트 (= eugene). 모든 팀 조회·view-as·
          // 새 팀 생성 권한. Team owner (team_members.role='owner') 와 별개.
          u.personal = row[0].personal;
          u.hasNormalTeam = hasNormalTeam;
          u.isPlatformAdmin = isAdmin(session.user.email);
          // isAdmin = Platform Admin OR team owner OR (membership_admin OR billing_admin 권한 보유).
          // nav 의 어드민 메뉴 노출 조건. team owner 는 별도 permissions 없어도 자기 팀
          // 관리 권한 자동 부여 (옵션 A, 2026-05-20). 세부 가드는 permissions 로.
          u.isAdmin =
            u.isPlatformAdmin ||
            currentTeamRole === "owner" ||
            !!u.permissions?.membershipAdmin ||
            !!u.permissions?.billingAdmin;

          // Phase 4.2 (M6c): platform owner 의 view-as 상태를 session 에 노출.
          // client 헤더 띠가 useSession() 으로 viewAsTeamName 표시. cookie 는 httpOnly.
          u.viewAsTeamId = null;
          u.viewAsTeamName = null;
          if (u.isPlatformAdmin) {
            try {
              const viewAsRaw = cookies().get(PLATFORM_VIEW_AS_COOKIE)?.value;
              if (viewAsRaw) {
                const viewAsId = parseInt(viewAsRaw, 10);
                if (viewAsId && !Number.isNaN(viewAsId) && viewAsId !== currentTeamId) {
                  const viewTeam = await db
                    .select({ id: teams.id, name: teams.name })
                    .from(teams)
                    .where(and(eq(teams.id, viewAsId), isNull(teams.deletedAt)))
                    .limit(1);
                  if (viewTeam[0]) {
                    u.viewAsTeamId = viewTeam[0].id;
                    u.viewAsTeamName = viewTeam[0].name;
                  }
                }
              }
            } catch {
              // cookies() 가 동기 context 외에서 실패하는 경우 — 무시. viewAs null.
            }
          }
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
