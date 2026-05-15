import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, users, userSnapshots } from "@/lib/db";
import { eq } from "drizzle-orm";

interface EnvInfo {
  platform: string | null;
  nodeVersion: string | null;
  nodeMajor: number | null;
  nodeManager: string | null;
  npmRoot: string | null;
  npmRootWritable: boolean | null;
  codeburnVersion: string | null;
  ccusageVersion: string | null;
  collectedAt: string | null;
}

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
    .select({ sessionsCount: userSnapshots.sessionsCount, rawJson: userSnapshots.rawJson })
    .from(userSnapshots)
    .where(eq(userSnapshots.userId, user[0].id))
    .limit(1);

  const sessionsCount = snap[0]?.sessionsCount ?? 0;
  const hasSynced = !!user[0].lastSyncedAt;
  const hasData = sessionsCount > 0;

  // envInfo 는 CLI submit.mjs 가 ingest body 에 포함해 rawJson 에 저장된 것.
  // 옛 cli 사용자는 envInfo 가 없을 수 있음 — 그 경우 null 반환.
  let envInfo: EnvInfo | null = null;
  const raw = snap[0]?.rawJson as Record<string, unknown> | undefined;
  if (raw && typeof raw.envInfo === "object" && raw.envInfo !== null) {
    envInfo = raw.envInfo as EnvInfo;
  }

  return NextResponse.json({
    ready: hasData,
    lastSyncedAt: user[0].lastSyncedAt ?? null,
    sessionsCount,
    envInfo,
    steps: {
      cli_installed: hasSynced,
      hook_registered: hasSynced,
      first_session: hasData,
    },
  });
}
