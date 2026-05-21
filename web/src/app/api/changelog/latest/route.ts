// GET /api/changelog/latest — 가장 최근 changelog entry 의 date.
// Nav 의 '새 항목 dot' 표시용. localStorage 의 last_seen 보다 크면 표시.

import { NextResponse } from "next/server";
import { getAllChangelogEntries } from "@/lib/changelog";

export const dynamic = "force-static";

export async function GET() {
  const entries = getAllChangelogEntries();
  const latest = entries[0]?.date ?? null;
  return NextResponse.json({ latest });
}
