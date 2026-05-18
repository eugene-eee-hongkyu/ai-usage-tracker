// Thin HTTP wrapper. 인증 + userId 확정 → runIngest() 호출.
// 핵심 로직은 [lib/sync/run-ingest.ts] 로 추출되어 향후 CLI in-process binary 도 같은 함수 호출 가능.

import { NextRequest, NextResponse } from "next/server";
import { db, users, teamMembers, IS_LOCAL_MODE } from "@/lib/db";
import { ensureLocalUser } from "@/lib/local-user";
import { runIngest } from "@/lib/sync/run-ingest";
import { eq, and, isNull, asc } from "drizzle-orm";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  // 로컬 단독 모드 (.pkg/.msi 인스톨러) — API key 인증 우회, 단일 사용자 자동 보장.
  let userRow: Array<{
    id: number;
    timezone: string | null;
    suspendedAt: Date | null;
    deletedAt: Date | null;
  }>;
  if (IS_LOCAL_MODE) {
    const u = await ensureLocalUser();
    userRow = [{ id: u.id, timezone: u.timezone, suspendedAt: null, deletedAt: null }];
  } else {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    userRow = await db
      .select({
        id: users.id,
        timezone: users.timezone,
        suspendedAt: users.suspendedAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.apiKeyHash, crypto.createHash("sha256").update(apiKey).digest("hex")))
      .limit(1);
  }

  if (!userRow[0]) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // admin 이 suspend/delete 한 사용자의 launchd 가 계속 ingest 못 하게 차단.
  if (userRow[0].deletedAt) return NextResponse.json({ error: "deleted" }, { status: 403 });
  if (userRow[0].suspendedAt) return NextResponse.json({ error: "suspended" }, { status: 403 });

  // Phase 4.2 (M6a): teamId 확정. CLI ingest 는 session 없으니 team_members 의 첫 행.
  // LOCAL_MODE 면 team_id=1 (iskra.world, ensureLocalUser 가 자동 가입 처리는 별도).
  let teamId: number;
  if (IS_LOCAL_MODE) {
    teamId = 1; // local-user 흐름은 단일 팀
  } else {
    const memberRow = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, userRow[0].id), isNull(teamMembers.deletedAt)))
      .orderBy(asc(teamMembers.joinedAt))
      .limit(1);
    if (!memberRow[0]) return NextResponse.json({ error: "no_team" }, { status: 403 });
    teamId = memberRow[0].teamId;
  }

  const body = await req.json();
  await runIngest(userRow[0].id, teamId, userRow[0].timezone, body);

  return NextResponse.json({ ok: true });
}
