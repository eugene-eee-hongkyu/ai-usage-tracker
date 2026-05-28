// GET /api/changelog/latest — 가장 최근 changelog entry 의 date.
// Nav 의 '새 항목 dot' 표시용. localStorage 의 last_seen 보다 크면 표시.

import { NextResponse } from "next/server";
import { getAllChangelogEntries } from "@/lib/changelog";

// force-dynamic — 새 changelog md 가 hotfix branch 등으로 deploy 안 된 채
// 추가됐을 때 (또는 long-lived 빌드에서) stale 표시 방지. 매 요청마다 fs
// readdirSync (수십 ms) 가 부담 없음. 옛 force-static 은 빌드 시점 1회만.
export const dynamic = "force-dynamic";

export async function GET() {
  const entries = getAllChangelogEntries();
  const latest = entries[0]?.date ?? null;
  return NextResponse.json({ latest });
}
