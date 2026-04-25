import type { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? "primuslabs.gg";

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
      if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
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
