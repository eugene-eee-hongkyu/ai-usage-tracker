// 위저드가 첫 진입 시 호출 — legacy 환경 / 기존 config 상태 알려줌.
// 응답으로 위저드의 default 선택지 결정 (legacy 발견 시 'local+company' 추천 등).

import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { IS_LOCAL_MODE } from "@/lib/db";

const COMPANY_URL = "https://aiusage.z21labs.world";

export async function GET() {
  if (!IS_LOCAL_MODE) {
    return NextResponse.json({ error: "local-mode-only" }, { status: 403 });
  }

  const home = homedir();
  const dataDir = process.env.DATA_DIR ?? join(home, ".usage-tracker");
  const configPath = join(dataDir, "config.json");
  // Primus → z21labs 리네임 (단계 1~3) 으로 install.sh 의 migrate 가 옛 경로를
  // 새 경로로 이동. 위저드는 두 경로 모두 확인 — 새 install.sh 사용자 / 옛 잔존
  // 사용자 / migrate 안 돈 사용자 모두 커버.
  const newApiKeyFile = join(home, ".z21labs", "usage-key");
  const legacyApiKeyFile = join(home, ".primus-usage-key");
  const legacyLaunchAgentPath = join(
    home,
    "Library",
    "LaunchAgents",
    "com.primus.usage-tracker.daily.plist"
  );
  const newLaunchAgentPath = join(
    home,
    "Library",
    "LaunchAgents",
    "world.z21labs.ai-usage-tracker.sync.plist"
  );

  const hasConfig = existsSync(configPath);
  const readKey = (p: string) =>
    existsSync(p) ? readFileSync(p, "utf8").trim() || null : null;
  // 우선순위: 새 경로 → 옛 경로 fallback
  const legacyApiKey = readKey(newApiKeyFile) ?? readKey(legacyApiKeyFile);
  const hasLegacyLaunchAgent =
    process.platform === "darwin" &&
    (existsSync(legacyLaunchAgentPath) || existsSync(newLaunchAgentPath));

  return NextResponse.json({
    hasConfig,
    legacy: {
      hasApiKey: !!legacyApiKey,
      apiKey: legacyApiKey,
      hasLaunchAgent: hasLegacyLaunchAgent,
    },
    companyUrl: COMPANY_URL,
  });
}
