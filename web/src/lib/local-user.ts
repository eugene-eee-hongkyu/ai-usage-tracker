// 로컬 단독 모드 (DATABASE_KIND=sqlite) 의 단일 사용자 추상화.
//
// 첫 ingest 또는 첫 dashboard 접근 시 user_id=1 행을 자동 생성.
// 환경변수로 email/name/timezone 커스터마이즈 가능. 외부 회사 데모 시
// env 만 바꾸면 그 회사 사용자로 보임.
//
// 서버 모드 (Vercel + Supabase) 에서는 NextAuth session 그대로 — 이 모듈은
// 호출되지만 ensureLocalUser 는 IS_LOCAL_MODE 가 아닐 때 호출되지 않음.

import { eq } from "drizzle-orm";
import { db, users, IS_LOCAL_MODE } from "./db";

export const LOCAL_USER_ID = 1;

export async function ensureLocalUser() {
  const existing = await db.select().from(users).where(eq(users.id, LOCAL_USER_ID)).limit(1);
  if (existing.length) return existing[0];

  await db.insert(users).values({
    id: LOCAL_USER_ID,
    email: process.env.LOCAL_USER_EMAIL ?? "local@usage-tracker.local",
    name: process.env.LOCAL_USER_NAME ?? "Local User",
    timezone: process.env.LOCAL_USER_TIMEZONE ?? null,
  });

  const fresh = await db.select().from(users).where(eq(users.id, LOCAL_USER_ID)).limit(1);
  return fresh[0];
}

// route 들이 session.user.email 로 사용자 식별 — 같은 인터페이스 유지.
// 로컬 모드면 LOCAL_USER_ID 보장 후 그 행의 email 반환. 서버 모드면 session 사용.
export async function getAuthedEmail(
  sessionEmail: string | null | undefined
): Promise<string | null> {
  if (IS_LOCAL_MODE) {
    const u = await ensureLocalUser();
    return u.email;
  }
  return sessionEmail ?? null;
}
