export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, users, IS_LOCAL_MODE } from "@/lib/db";
import { getAuthedEmail } from "@/lib/local-user";
import { eq } from "drizzle-orm";
import { VALID_CODEX_TIERS } from "@/lib/codex-plans";

const VALID_CLAUDE_TIERS = ["pro", "max5", "max20", "team_standard", "team_premium", "team", "api"] as const;

// PATCH /api/user/plan-tier — Claude (default) / Codex 분리 저장.
// body: { planTier: string | null, provider?: "claude" | "codex" }
//   - provider 생략 = claude (backwards compat)
//   - provider="codex" → users.codex_plan_tier 컬럼
export async function PATCH(req: NextRequest) {
  const session = IS_LOCAL_MODE ? null : await getServerSession(authOptions);
  const authedEmail = await getAuthedEmail(session?.user?.email);
  if (!authedEmail)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tier = body?.planTier;
  const provider = body?.provider === "codex" ? "codex" : "claude";
  const validTiers: readonly string[] =
    provider === "codex" ? VALID_CODEX_TIERS : VALID_CLAUDE_TIERS;

  // null 또는 빈 문자열 → 클리어. 정책상 사용자가 무조건 선택해야 하지만 API 는 허용.
  if (tier === null || tier === "") {
    const patch = provider === "codex" ? { codexPlanTier: null } : { planTier: null };
    await db.update(users).set(patch).where(eq(users.email, authedEmail));
    return NextResponse.json({ ok: true, planTier: null, provider });
  }

  if (typeof tier !== "string" || !validTiers.includes(tier)) {
    return NextResponse.json(
      { error: "invalid planTier", provider, valid: [...validTiers, null] },
      { status: 400 },
    );
  }

  const patch = provider === "codex" ? { codexPlanTier: tier } : { planTier: tier };
  await db.update(users).set(patch).where(eq(users.email, authedEmail));
  return NextResponse.json({ ok: true, planTier: tier, provider });
}
