import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, users, userSnapshots, IS_LOCAL_MODE } from "@/lib/db";
import { getAuthedEmail } from "@/lib/local-user";
import { eq, desc } from "drizzle-orm";

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
  // LOCAL_MODE 패턴 통일 — dashboard / team / user 라우트와 일관. 옛 동작은
  // session 만 보고 401 → LOCAL_MODE 사용자 setup-status 페이지 깨짐.
  const session = IS_LOCAL_MODE ? null : await getServerSession(authOptions);
  const authedEmail = await getAuthedEmail(session?.user?.email);
  if (!authedEmail)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await db
    .select({ id: users.id, lastSyncedAt: users.lastSyncedAt })
    .from(users)
    .where(eq(users.email, authedEmail))
    .limit(1);

  if (!user[0]) return NextResponse.json({ ready: false, steps: {} });

  // multi-device user 의 경우 row 가 N개 — 가장 최근 ingest snapshot 사용.
  // 옛 동작은 임의 첫 row (DB 정렬 무관) 라 sessionsCount/envInfo 부정확.
  const snap = await db
    .select({ sessionsCount: userSnapshots.sessionsCount, rawJson: userSnapshots.rawJson })
    .from(userSnapshots)
    .where(eq(userSnapshots.userId, user[0].id))
    .orderBy(desc(userSnapshots.updatedAt))
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
