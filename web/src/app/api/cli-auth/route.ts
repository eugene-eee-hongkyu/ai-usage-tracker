import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// GET /api/cli-auth?port=9988
// Generates/reissues API key for the authenticated user and redirects to CLI's local server
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    // Redirect to login, then back here
    const callbackUrl = req.nextUrl.toString();
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`, req.url)
    );
  }

  const port = req.nextUrl.searchParams.get("port") ?? "9988";

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!user[0]) return NextResponse.json({ error: "user not found" }, { status: 404 });

  // Generate new API key
  const apiKey = crypto.randomBytes(32).toString("hex");
  const apiKeyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

  await db.update(users).set({ apiKeyHash }).where(eq(users.id, user[0].id));

  // Redirect to CLI's local server with the key
  const redirectUrl = `http://127.0.0.1:${port}/?apiKey=${apiKey}`;
  return NextResponse.redirect(redirectUrl);
}
