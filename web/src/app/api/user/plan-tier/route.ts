import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

const VALID_TIERS = ["pro", "max5", "max20", "team", "api"] as const;

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tier = body?.planTier;

  // null 또는 빈 문자열 → 클리어 (자동 추정만 사용)
  if (tier === null || tier === "") {
    await db.update(users).set({ planTier: null }).where(eq(users.email, session.user.email));
    return NextResponse.json({ ok: true, planTier: null });
  }

  if (typeof tier !== "string" || !VALID_TIERS.includes(tier as typeof VALID_TIERS[number])) {
    return NextResponse.json(
      { error: "invalid planTier", valid: [...VALID_TIERS, null] },
      { status: 400 },
    );
  }

  await db.update(users).set({ planTier: tier }).where(eq(users.email, session.user.email));
  return NextResponse.json({ ok: true, planTier: tier });
}
