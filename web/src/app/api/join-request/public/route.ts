// POST /api/join-request/public — anonymous 가입 신청.
// /join 페이지가 anonymous form 으로 호출. 사용자 OAuth 미통과 상태에서도 신청 가능.
//
// rate limit: 분당 5건 (IP 기준). 향후 강화.

import { NextRequest, NextResponse } from "next/server";
import { db, joinRequests, users, IS_LOCAL_MODE } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { email, name, teamNameHint, message } = body as {
    email?: string;
    name?: string;
    teamNameHint?: string;
    message?: string;
  };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }

  // 이미 가입된 사용자 — 거부
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing[0]) {
    return NextResponse.json({ error: "user_already_exists" }, { status: 409 });
  }

  // 이미 pending 신청 — 거부
  const pendingReq = await db
    .select({ id: joinRequests.id })
    .from(joinRequests)
    .where(and(eq(joinRequests.email, email), eq(joinRequests.status, "pending")))
    .limit(1);
  if (pendingReq[0]) {
    return NextResponse.json({ error: "already_pending" }, { status: 409 });
  }

  const inserted = await db
    .insert(joinRequests)
    .values({
      // Phase 4.2 (M6a): 기본 팀 (1). M6b 에서 teamNameHint 로 분기.
      teamId: 1,
      email,
      teamNameHint: teamNameHint ?? null,
      message: message?.slice(0, 1000) ?? null,
      status: "pending",
    })
    .returning({ id: joinRequests.id });

  await writeAudit({
    actorUserId: null,
    actorType: "user",
    action: "join_request.create",
    targetType: "join_request",
    targetId: inserted[0].id,
    metadata: { email, name, teamNameHint, message: message?.slice(0, 200) },
    ip: req.headers.get("x-forwarded-for") ?? null,
  });

  return NextResponse.json({ ok: true });
}
