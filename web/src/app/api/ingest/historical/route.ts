import { NextRequest, NextResponse } from "next/server";
import { db, periodSnapshots, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// 신규 사용자 onboarding / 노트북 장기 off 후 복귀 시 historical 데이터 backfill.
// CLI 가 codeburn `--from`/`--to` 로 과거 주/달 단위 raw JSON 을 추출해서 보냄.
// onConflictDoNothing → 이미 boundary-triggered promotion 으로 들어온 행은 보존,
// 비어있던 슬롯만 채움 (idempotent).

interface HistoricalPayload {
  type: "weekly" | "monthly";
  periodStart: string;     // "YYYY-MM-DD" (월요일 또는 1일)
  rawJson: unknown;
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userRow = await db
    .select()
    .from(users)
    .where(eq(users.apiKeyHash, crypto.createHash("sha256").update(apiKey).digest("hex")))
    .limit(1);

  if (!userRow[0]) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const items = Array.isArray(body?.snapshots)
    ? (body.snapshots as HistoricalPayload[])
    : [];

  if (items.length === 0) {
    return NextResponse.json({ error: "no snapshots provided" }, { status: 400 });
  }

  let inserted = 0;
  let skipped = 0;
  for (const it of items) {
    if (!it.type || !it.periodStart || !it.rawJson) { skipped++; continue; }
    if (it.type !== "weekly" && it.type !== "monthly") { skipped++; continue; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(it.periodStart)) { skipped++; continue; }

    // 빈 period 방어 — cost=0 && calls=0 이면 활동 없는 슬롯, INSERT 안 함.
    // 클라이언트(historical.mjs) 도 같은 룰 적용하지만 서버 측에서 한 번 더 가드.
    const ov = (it.rawJson as { overview?: { cost?: number; calls?: number } })?.overview;
    const cost = Number(ov?.cost ?? 0);
    const calls = Number(ov?.calls ?? 0);
    if (cost === 0 && calls === 0) { skipped++; continue; }

    try {
      const result = await db
        .insert(periodSnapshots)
        .values({
          userId: userRow[0].id,
          periodType: it.type,
          periodStart: it.periodStart,
          capturedAt: new Date(),
          rawJson: it.rawJson as object,
        })
        .onConflictDoNothing()
        .returning({ id: periodSnapshots.id });
      if (result.length > 0) inserted++;
      else skipped++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, inserted, skipped });
}
