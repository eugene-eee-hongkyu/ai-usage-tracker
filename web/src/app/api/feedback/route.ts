import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, users, suggestionFeedback } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);
  if (!user[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { suggestionType, action } = await req.json();
  const validActions = ["done", "dismiss", "thumbs_up", "thumbs_down"];
  if (!validActions.includes(action))
    return NextResponse.json({ error: "invalid action" }, { status: 400 });

  await db.insert(suggestionFeedback).values({
    userId: user[0].id,
    suggestionType,
    action,
  });

  return NextResponse.json({ ok: true });
}
