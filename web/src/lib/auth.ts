import type { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

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
      if (!isEmailAllowed(email)) {
        return `/login?error=domain`;
      }

      try {
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
      } catch (err) {
        console.error("[auth] signIn DB error:", err);
        return "/login?error=db";
      }
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
