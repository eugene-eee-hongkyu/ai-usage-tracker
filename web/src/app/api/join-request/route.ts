// POST /api/join-request — 로그인한 사용자가 본인 가입 신청 생성.
// /join 페이지가 호출. admin 승인 대기.

import { NextRequest, NextResponse } from "next/server";
import { db, joinRequests, IS_LOCAL_MODE } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { teamNameHint, message } = body as { teamNameHint?: string; message?: string };

  // 중복 pending 방지
  const existing = await db
    .select({ id: joinRequests.id })
    .from(joinRequests)
    .where(
      and(eq(joinRequests.email, session.user.email), eq(joinRequests.status, "pending"))
    )
    .limit(1);
  if (existing[0]) {
    return NextResponse.json({ error: "already_pending", id: existing[0].id }, { status: 409 });
  }

  const inserted = await db
    .insert(joinRequests)
    .values({
      userId: session.user.id ?? null,
      email: session.user.email,
      teamNameHint: teamNameHint ?? null,
      message: message ?? null,
      status: "pending",
    })
    .returning({ id: joinRequests.id });

  await writeAudit({
    actorUserId: session.user.id ?? null,
    action: "join_request.create",
    targetType: "join_request",
    targetId: inserted[0].id,
    metadata: { email: session.user.email, teamNameHint, message: message?.slice(0, 200) },
    ip: req.headers.get("x-forwarded-for") ?? null,
  });

  return NextResponse.json({ ok: true, id: inserted[0].id });
}
