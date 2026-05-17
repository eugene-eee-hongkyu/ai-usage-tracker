export const dynamic = "force-dynamic";

// 클라이언트가 현재 서버 모드 + config.json 의 destinations 정보 조회.
// Nav 분기 (팀 메뉴 표시 여부 / 외부 URL) + useSession 우회 결정용.

import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { IS_LOCAL_MODE } from "@/lib/db";

interface Destination {
  name: string;
  url: string;
  apiKey?: string | null;
}

function loadCompanyUrl(): string | null {
  if (!IS_LOCAL_MODE) return null;
  const configPath = process.env.USAGE_TRACKER_CONFIG ?? join(homedir(), ".usage-tracker", "config.json");
  try {
    if (!existsSync(configPath)) return null;
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as { destinations?: Destination[] };
    if (!Array.isArray(parsed.destinations)) return null;
    // localhost 가 아닌 첫 destination = 외부 (회사) 서버. team 메뉴 표시 + 클릭 시 link.
    const external = parsed.destinations.find(
      (d) => d?.url && !d.url.includes("localhost") && !d.url.includes("127.0.0.1")
    );
    return external?.url.replace(/\/$/, "") ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  return NextResponse.json({
    isLocalMode: IS_LOCAL_MODE,
    companyUrl: loadCompanyUrl(),
  });
}
