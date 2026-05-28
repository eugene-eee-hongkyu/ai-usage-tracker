// 마이그레이션 위저드가 호출하는 config.json 저장 API.
// LOCAL_MODE 에서만 활성화 (서버 모드 = Vercel 에서는 ~/.usage-tracker 가 의미 없음).
// CLI 가 다음 sync 부터 이 config 를 자동으로 사용.

import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { IS_LOCAL_MODE } from "@/lib/db";

interface Destination {
  name: string;
  url: string;
  apiKey?: string | null;
}

interface SaveBody {
  destinations: Destination[];
}

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    // http/https 만 허용 — file://, javascript: 등 차단. CLI sync 가 다음에
    // 이 URL 로 POST 하므로 SSRF/임의 fetch 방어.
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidDestination(d: unknown): d is Destination {
  if (typeof d !== "object" || d === null) return false;
  const x = d as Record<string, unknown>;
  if (typeof x.name !== "string" || typeof x.url !== "string") return false;
  return isValidUrl(x.url);
}

export async function POST(req: NextRequest) {
  if (!IS_LOCAL_MODE) {
    return NextResponse.json({ error: "local-mode-only" }, { status: 403 });
  }

  let body: SaveBody;
  try {
    body = (await req.json()) as SaveBody;
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  if (!Array.isArray(body.destinations) || body.destinations.length === 0) {
    return NextResponse.json({ error: "destinations-empty" }, { status: 400 });
  }
  if (!body.destinations.every(isValidDestination)) {
    return NextResponse.json({ error: "destinations-malformed" }, { status: 400 });
  }

  const dataDir = process.env.DATA_DIR ?? join(homedir(), ".usage-tracker");
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const configPath = join(dataDir, "config.json");
  writeFileSync(
    configPath,
    JSON.stringify({ destinations: body.destinations }, null, 2) + "\n",
    { mode: 0o600 }
  );

  return NextResponse.json({ ok: true, path: configPath });
}
