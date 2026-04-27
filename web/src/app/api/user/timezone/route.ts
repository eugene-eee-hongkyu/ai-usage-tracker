import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { timezone } = await req.json();
  if (typeof timezone !== "string" || !timezone)
    return NextResponse.json({ error: "invalid timezone" }, { status: 400 });

  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    return NextResponse.json({ error: "invalid timezone" }, { status: 400 });
  }

  await db
    .update(users)
    .set({ timezone })
    .where(eq(users.email, session.user.email));

  return NextResponse.json({ ok: true });
}
