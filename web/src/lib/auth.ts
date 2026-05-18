import type { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { db, users, teamMembers, teams } from "@/lib/db";
import { eq, and, isNull, asc } from "drizzle-orm";
import { isAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { PLATFORM_VIEW_AS_COOKIE } from "@/lib/effective-team";

// e2e Credentials provider — NODE_ENV='test' 또는 Z21_E2E_AUTH=1 일 때만 활성
// (옛 PRIMUS_E2E_AUTH 도 fallback — 마이그레이션 안정 후 제거)
// 진짜 OAuth (captcha/2FA) 우회용 (C-1 §3 #1 우회 전략)
const e2eEnabled =
  process.env.NODE_ENV === "test" ||
  process.env.Z21_E2E_AUTH === "1" ||
  process.env.PRIMUS_E2E_AUTH === "1";

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

        // 기존 사용자 — 도메인 화이트리스트 무관 통과 (이미 가입한 사람)
        if (existing.length > 0) {
          const u = existing[0];
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
          const inserted = await db
            .insert(users)
            .values({
              githubId: String((profile as Record<string, unknown>)?.id ?? account?.providerAccountId),
              email,
              name: user.name ?? email.split("@")[0],
              avatarUrl: user.image ?? null,
              role: invite[0].role,
              permissions: invite[0].permissions,
            })
            .returning({ id: users.id });
          await db
            .update(invitations)
            .set({ acceptedAt: new Date() })
            .where(eq(invitations.id, invite[0].id));
          const newUserId = inserted[0]?.id ?? null;
          // Phase 4.2 (M6a): invitation 의 team_id 로 team_members 도 같이 INSERT.
          // 가입 직후 session callback 이 currentTeamId 채울 수 있게.
          if (newUserId && invite[0].teamId) {
            await db.insert(teamMembers).values({
              teamId: invite[0].teamId,
              userId: newUserId,
              role: invite[0].role === "admin" ? "admin" : "member",
            });
          }
          await writeAudit({
            actorUserId: newUserId,
            actorType: "user",
            action: "user.create.via_invite",
            targetType: "user",
            targetId: newUserId,
            metadata: { email, provider, role: invite[0].role, invitationId: invite[0].id, teamId: invite[0].teamId },
          });
          await writeAudit({
            actorUserId: newUserId,
            actorType: "user",
            action: "invitation.accept",
            targetType: "invitation",
            targetId: invite[0].id,
            metadata: { email, provider, newUserId, teamId: invite[0].teamId },
          });
          return true;
        }

        // invitation 없는 신규 사용자만 도메인 화이트리스트 적용
        if (!isEmailAllowed(email)) {
          await writeAudit({
            actorUserId: null,
            actorType: "system",
            action: "auth.rejected.domain",
            targetType: null,
            targetId: null,
            metadata: { email, provider },
          });
          return `/login?error=domain`;
        }

        // 도메인 통과한 self-signup 신규자 — /join 으로 redirect (가입 신청 form).
        await writeAudit({
          actorUserId: null,
          actorType: "system",
          action: "auth.signup.redirect_join",
          targetType: null,
          targetId: null,
          metadata: { email, provider, name: user.name ?? null },
        });
        return `/join?email=${encodeURIComponent(email)}&name=${encodeURIComponent(user.name ?? "")}`;
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
          })
          .from(users)
          .where(eq(users.email, session.user.email))
          .limit(1);
        if (row[0]) {
          // Phase 4.2 (M6a): currentTeamId 결정 — team_members 의 첫 행 (가입 순).
          // M6b 에서 N팀 가입 + cookie/URL 기반 전환 도입 예정. M6a 에선 first team.
          const memberRow = await db
            .select({ teamId: teamMembers.teamId })
            .from(teamMembers)
            .where(and(eq(teamMembers.userId, row[0].id), isNull(teamMembers.deletedAt)))
            .orderBy(asc(teamMembers.joinedAt))
            .limit(1);
          const currentTeamId = memberRow[0]?.teamId ?? null;

          const u = session.user as typeof session.user & {
            id: number;
            role: string;
            permissions: { membershipAdmin?: boolean; billingAdmin?: boolean };
            suspendedAt: Date | null;
            deletedAt: Date | null;
            isOwner: boolean;
            isAdmin: boolean;
            currentTeamId: number | null;
            viewAsTeamId: number | null;
            viewAsTeamName: string | null;
          };
          u.id = row[0].id;
          u.role = row[0].role;
          u.permissions = (row[0].permissions ?? {}) as typeof u.permissions;
          u.suspendedAt = row[0].suspendedAt;
          u.deletedAt = row[0].deletedAt;
          u.currentTeamId = currentTeamId;
          // Owner = ADMIN_EMAIL env 화이트리스트. permissions 분리와 별개의 최상위 권한.
          u.isOwner = isAdmin(session.user.email);
          // isAdmin = Owner OR (membership_admin OR billing_admin 권한 보유). nav 의 어드민
          // 메뉴 노출 조건. 세부 가드는 permissions 로.
          u.isAdmin =
            u.isOwner || !!u.permissions?.membershipAdmin || !!u.permissions?.billingAdmin;

          // Phase 4.2 (M6c): platform owner 의 view-as 상태를 session 에 노출.
          // client 헤더 띠가 useSession() 으로 viewAsTeamName 표시. cookie 는 httpOnly.
          u.viewAsTeamId = null;
          u.viewAsTeamName = null;
          if (u.isOwner) {
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
