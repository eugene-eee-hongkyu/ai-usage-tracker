import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, users, userSnapshots } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await db
    .select({ id: users.id, lastSyncedAt: users.lastSyncedAt })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!user[0]) return NextResponse.json({ ready: false, steps: {} });

  const snap = await db
    .select({ sessionsCount: userSnapshots.sessionsCount })
    .from(userSnapshots)
    .where(eq(userSnapshots.userId, user[0].id))
    .limit(1);

  const sessionsCount = snap[0]?.sessionsCount ?? 0;
  const hasSynced = !!user[0].lastSyncedAt;
  const hasData = sessionsCount > 0;

  return NextResponse.json({
    ready: hasData,
    lastSyncedAt: user[0].lastSyncedAt ?? null,
    sessionsCount,
    steps: {
      cli_installed: hasSynced,
      hook_registered: hasSynced,
      first_session: hasData,
    },
  });
}
