export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, users, IS_LOCAL_MODE } from "@/lib/db";
import { getAuthedEmail } from "@/lib/local-user";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest) {
  const session = IS_LOCAL_MODE ? null : await getServerSession(authOptions);
  const authedEmail = await getAuthedEmail(session?.user?.email);
  if (!authedEmail)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { timezone } = await req.json();
  if (typeof timezone !== "string" || !timezone)
    return NextResponse.json({ error: "invalid timezone" }, { status: 400 });

  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    return NextResponse.json({ error: "invalid timezone" }, { status: 400 });
  }

  await db.update(users).set({ timezone }).where(eq(users.email, authedEmail));

  return NextResponse.json({ ok: true });
}
