// GET    /api/me/devices            — 본인의 api_tokens 목록 (revoke 안 된 것)
// PATCH  /api/me/devices?id=<n>    — 본인 token rename. body: { name }
// DELETE /api/me/devices?id=<n>    — 본인 token revoke (soft)
//
// 권한: 로그인만 — 본인 token 만 접근. user_id 일치 확인으로 다른 사람 token 차단.

import { NextRequest, NextResponse } from "next/server";
import { db, apiTokens, IS_LOCAL_MODE } from "@/lib/db";
import { requireUser } from "@/lib/auth-guards";
import { writeAudit } from "@/lib/audit";
import { eq, and, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });
  const guard = await requireUser();
  if (guard.error) return guard.error;

  const rows = await db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      lastUsedAt: apiTokens.lastUsedAt,
      createdAt: apiTokens.createdAt,
      metadata: apiTokens.metadata,
    })
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, guard.user.id), isNull(apiTokens.revokedAt)))
    .orderBy(apiTokens.createdAt);

  return NextResponse.json({ devices: rows });
}

export async function PATCH(req: NextRequest) {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });
  const guard = await requireUser();
  if (guard.error) return guard.error;

  const id = parseInt(req.nextUrl.searchParams.get("id") ?? "", 10);
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { name } = body as { name?: string };
  const trimmed = name?.trim() ?? "";
  if (trimmed.length < 1 || trimmed.length > 64) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }

  const result = await db
    .update(apiTokens)
    .set({ name: trimmed })
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, guard.user.id), isNull(apiTokens.revokedAt)))
    .returning({ id: apiTokens.id });

  if (result.length === 0) {
    return NextResponse.json({ error: "not_found_or_revoked" }, { status: 404 });
  }

  await writeAudit({
    teamId: guard.user.currentTeamId,
    actorUserId: guard.user.id,
    action: "device.rename",
    targetType: "api_token",
    targetId: id,
    metadata: { newName: trimmed },
    ip: req.headers.get("x-forwarded-for") ?? null,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (IS_LOCAL_MODE) return NextResponse.json({ error: "local_mode" }, { status: 403 });
  const guard = await requireUser();
  if (guard.error) return guard.error;

  const id = parseInt(req.nextUrl.searchParams.get("id") ?? "", 10);
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const result = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, guard.user.id), isNull(apiTokens.revokedAt)))
    .returning({ id: apiTokens.id, name: apiTokens.name });

  if (result.length === 0) {
    return NextResponse.json({ error: "not_found_or_already_revoked" }, { status: 404 });
  }

  await writeAudit({
    teamId: guard.user.currentTeamId,
    actorUserId: guard.user.id,
    action: "device.revoke",
    targetType: "api_token",
    targetId: id,
    metadata: { name: result[0].name },
    ip: req.headers.get("x-forwarded-for") ?? null,
  });

  return NextResponse.json({ ok: true });
}
