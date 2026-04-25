import type { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

// ALLOWED_EMAIL_DOMAINS: 쉼표 구분 (예: "primuslabs.gg,primuslabs.io")
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
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      const email = user.email ?? "";
      if (!isEmailAllowed(email)) {
        return `/login?error=domain`;
      }

      // Upsert user
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(users).values({
          githubId: String((profile as Record<string, unknown>)?.id ?? account?.providerAccountId),
          email,
          name: user.name ?? email.split("@")[0],
          avatarUrl: user.image ?? null,
        });
      }
      return true;
    },
    async session({ session }) {
      if (session.user?.email) {
        const row = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, session.user.email))
          .limit(1);
        if (row[0]) {
          (session.user as typeof session.user & { id: number }).id = row[0].id;
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
