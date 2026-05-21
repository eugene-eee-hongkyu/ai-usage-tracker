// POST /api/suggest — 사용자 제안 저장 + Resend 발송.
// GET  /api/suggest — 본인이 보낸 최근 제안 N건.
//
// 메일 발송 실패해도 DB 에는 저장 (emailed_at=null, email_error 채움) — 재발송/디버그용.

import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, users, suggestions, IS_LOCAL_MODE } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { sendSuggestion } from "@/lib/email";

const CATEGORIES = new Set(["feature", "ui", "bug", "other"]);
const SCREENS = new Set(["dashboard", "team", "settings", "cli", "changelog", "other"]);
const MAX_BODY = 4000;

export async function POST(req: NextRequest) {
  if (IS_LOCAL_MODE) {
    return NextResponse.json({ error: "not_available_local" }, { status: 501 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as {
    category?: unknown;
    contextScreen?: unknown;
    contextEntry?: unknown;
    body?: unknown;
  } | null;
  if (!payload) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const category = typeof payload.category === "string" ? payload.category : "";
  if (!CATEGORIES.has(category)) {
    return NextResponse.json({ error: "invalid_category" }, { status: 400 });
  }
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (body.length < 5) {
    return NextResponse.json({ error: "body_too_short" }, { status: 400 });
  }
  if (body.length > MAX_BODY) {
    return NextResponse.json({ error: "body_too_long" }, { status: 400 });
  }
  const contextScreen =
    typeof payload.contextScreen === "string" && SCREENS.has(payload.contextScreen)
      ? payload.contextScreen
      : null;
  const contextEntry =
    typeof payload.contextEntry === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.contextEntry)
      ? payload.contextEntry
      : null;

  const u = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);
  if (!u[0]) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  const inserted = await db
    .insert(suggestions)
    .values({
      userId: u[0].id,
      category,
      contextScreen,
      contextEntry,
      body,
    })
    .returning({ id: suggestions.id });
  const id = inserted[0]?.id;

  const sent = await sendSuggestion({
    fromName: u[0].name,
    fromEmail: u[0].email,
    category,
    contextScreen,
    contextEntry,
    body,
  });

  if (sent.ok) {
    await db
      .update(suggestions)
      .set({ emailedAt: new Date() })
      .where(eq(suggestions.id, id!));
  } else {
    await db
      .update(suggestions)
      .set({ emailError: sent.error ?? "unknown" })
      .where(eq(suggestions.id, id!));
  }

  return NextResponse.json({ ok: true, id, emailed: sent.ok });
}

export async function GET() {
  if (IS_LOCAL_MODE) {
    return NextResponse.json({ items: [] });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const u = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);
  if (!u[0]) return NextResponse.json({ items: [] });

  const rows = await db
    .select({
      id: suggestions.id,
      category: suggestions.category,
      contextScreen: suggestions.contextScreen,
      contextEntry: suggestions.contextEntry,
      body: suggestions.body,
      emailedAt: suggestions.emailedAt,
      createdAt: suggestions.createdAt,
    })
    .from(suggestions)
    .where(eq(suggestions.userId, u[0].id))
    .orderBy(desc(suggestions.createdAt))
    .limit(10);

  return NextResponse.json({ items: rows });
}
