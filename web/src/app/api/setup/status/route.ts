import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, users, sessions } from "@/lib/db";
import { eq, count } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await db
    .select({ id: users.id, lastSyncedAt: users.lastSyncedAt })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!user[0]) return NextResponse.json({ ready: false, steps: [] });

  const [sessionCount] = await db
    .select({ value: count() })
    .from(sessions)
    .where(eq(sessions.userId, user[0].id));

  const hasSessions = (sessionCount?.value ?? 0) > 0;
  const hasSynced = !!user[0].lastSyncedAt;

  return NextResponse.json({
    ready: hasSessions,
    steps: [
      { label: "Node 18+ 확인", done: true },
      { label: "keytar 설치", done: hasSynced },
      { label: "hook 등록", done: hasSessions },
    ],
  });
}
