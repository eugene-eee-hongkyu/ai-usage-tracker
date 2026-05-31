#!/usr/bin/env node
//
// ⚠️ DEPRECATED — 옛 .pkg/.msi 인스톨러 흐름 (Phase 3.0~3.2).
// 현 방식: .dmg (Electron) — installer/electron/main.js 가 이 launcher 의 역할을
// 대체 + Node/codeburn/ccusage 동봉 (v0.1.4 부터). 본 파일은 history 보존용으로만
// 남아 있고 새 빌드에선 호출 안 됨. installer/mac/build.sh 와 함께 차기 cleanup
// 사이클에 삭제 예정.
//
// .pkg/.msi 인스톨러 안의 launcher — 사용자가 앱 아이콘 더블클릭 시 실행되는 entry point.
//
//   1. ~/.usage-tracker/ 디렉토리 / SQLite 파일 / config.json 첫 실행 시 초기화
//   2. SQLite migration 자동 적용 (./web/migrations/*.sql)
//   3. Next.js standalone 서버 백그라운드 띄움 (포트 자동 선택 또는 USAGE_TRACKER_PORT)
//   4. 시스템 브라우저로 http://localhost:PORT/dashboard 열기
//
// 환경:
//   - APP_DIR     인스톨 루트 (web/, migrations/, cli/ 가 들어있는 곳)
//                 미지정 시 launcher.mjs 위치 기준으로 자동 추정
//   - DATA_DIR    데이터/로그 경로 (기본 ~/.usage-tracker)
//   - USAGE_TRACKER_PORT  포트 (기본 3737)
//
// cross-platform — mac/windows/linux 모두 작동. 인스톨러 (pkg/msi) 가 이 스크립트
// 그대로 호출. Phase 3.3 의 legacy detect 도 여기에 추가 예정.

import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { spawn } from "child_process";
import { createConnection } from "net";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const APP_DIR = process.env.APP_DIR ?? resolve(__dirname, "..");
const DATA_DIR = process.env.DATA_DIR ?? join(homedir(), ".usage-tracker");
const PORT = parseInt(process.env.USAGE_TRACKER_PORT ?? "3737", 10);
const SQLITE_PATH = join(DATA_DIR, "data.sqlite3");
const LOG_FILE = join(DATA_DIR, "server.log");
const SECRET_FILE = join(DATA_DIR, ".nextauth-secret");
const CONFIG_FILE = join(DATA_DIR, "config.json");

// legacy install.sh 흔적 — 기존 5명용. detect 되면 config 자동 마이그레이션.
const LEGACY_API_KEY_FILE = join(homedir(), ".primus-usage-key");
const LEGACY_LAUNCH_AGENT = join(
  homedir(),
  "Library",
  "LaunchAgents",
  "com.primus.usage-tracker.daily.plist"
);
const COMPANY_URL = "https://aiusage.z21labs.world";

// 새 launchd plist (legacy 없는 신규 설치 환경용). legacy 가 있으면 그대로 두고
// 새 plist 는 만들지 않음 — 같은 sync 가 두 번 돌면 비효율적.
const NEW_LAUNCH_AGENT_LABEL = "world.z21labs.ai-usage-tracker.sync";
const NEW_LAUNCH_AGENT_PATH = join(
  homedir(),
  "Library",
  "LaunchAgents",
  `${NEW_LAUNCH_AGENT_LABEL}.plist`
);

const STANDALONE_DIR = join(APP_DIR, "web", ".next", "standalone");
const STANDALONE_SERVER = join(STANDALONE_DIR, "server.js");
const MIGRATIONS_DIR = join(APP_DIR, "web", "drizzle-sqlite");

function log(msg) {
  process.stderr.write(`[launcher] ${msg}\n`);
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
    log(`데이터 디렉토리 생성: ${DATA_DIR}`);
  }
}

function detectLegacy() {
  const apiKey =
    existsSync(LEGACY_API_KEY_FILE)
      ? readFileSync(LEGACY_API_KEY_FILE, "utf8").trim() || null
      : null;
  const hasLaunchAgent = process.platform === "darwin" && existsSync(LEGACY_LAUNCH_AGENT);
  return { apiKey, hasLaunchAgent };
}

function ensureConfig() {
  // 이미 사용자가 만들었으면 건드리지 않음.
  if (existsSync(CONFIG_FILE)) return;

  const destinations = [{ name: "local", url: `http://localhost:${PORT}` }];
  const legacy = detectLegacy();
  if (legacy.apiKey) {
    destinations.push({ name: "company", url: COMPANY_URL, apiKey: legacy.apiKey });
    log(`기존 API key 감지 (~/.primus-usage-key) → company destination 자동 추가.`);
  }
  if (legacy.hasLaunchAgent) {
    log(`기존 launchd 감지 (${LEGACY_LAUNCH_AGENT}) — 기존 sync 가 이 config 를 자동 사용합니다.`);
    log(`로컬만 보내고 싶으면 ${CONFIG_FILE} 의 company destination 을 제거하세요.`);
  }
  writeFileSync(CONFIG_FILE, JSON.stringify({ destinations }, null, 2) + "\n", { mode: 0o600 });
  log(`config 생성: ${CONFIG_FILE} (destinations=${destinations.map((d) => d.name).join(",")})`);
}

function ensureSecret() {
  if (existsSync(SECRET_FILE)) return readFileSync(SECRET_FILE, "utf8").trim();
  const buf = new Uint8Array(32);
  globalThis.crypto.getRandomValues(buf);
  const secret = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
  writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
  return secret;
}

async function ensureSqliteSchema() {
  if (existsSync(SQLITE_PATH)) return;
  if (!existsSync(MIGRATIONS_DIR)) {
    log(`migrations 디렉토리 없음 (${MIGRATIONS_DIR}) — SQLite 초기화 건너뜀.`);
    return;
  }
  const sqlFiles = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  if (sqlFiles.length === 0) {
    log(`migrations SQL 없음 — SQLite 초기화 건너뜀.`);
    return;
  }
  // sqlite3 CLI 가 시스템에 있다고 가정 (mac/linux 기본 포함, windows .msi 에는 동봉 필요).
  // 향후 better-sqlite3 로 in-process 실행으로 교체 가능.
  for (const f of sqlFiles) {
    const sqlPath = join(MIGRATIONS_DIR, f);
    log(`migration 적용: ${f}`);
    const proc = spawn("sqlite3", [SQLITE_PATH], {
      stdio: ["pipe", "inherit", "inherit"],
    });
    const sql = readFileSync(sqlPath, "utf8");
    proc.stdin.write(sql);
    proc.stdin.end();
    const code = await new Promise((res) => proc.on("close", res));
    if (code !== 0) {
      throw new Error(`migration ${f} 실패 (exit ${code})`);
    }
  }
}

function ensureLaunchAgentMac() {
  if (process.platform !== "darwin") return;

  const legacy = detectLegacy();
  if (legacy.hasLaunchAgent) {
    // legacy npx sync 가 이미 etc 2h 마다 호출됨 — config.json 변경만으로 fan-out
    // 자동 적용되니 새 plist 만들 필요 X.
    return;
  }
  if (existsSync(NEW_LAUNCH_AGENT_PATH)) return;

  const syncPath = join(APP_DIR, "cli", "sync.mjs");
  if (!existsSync(syncPath)) {
    log(`sync.mjs 없음 (${syncPath}) — launchd 등록 건너뜀.`);
    return;
  }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const logPath = join(DATA_DIR, "sync.log");
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${NEW_LAUNCH_AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>${syncPath}</string>
  </array>
  <key>StartInterval</key>
  <integer>3600</integer>
  <key>EnvironmentVariables</key>
  <dict>
    <key>TZ</key>
    <string>${tz}</string>
    <key>USAGE_TRACKER_CONFIG</key>
    <string>${CONFIG_FILE}</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${logPath}</string>
  <key>StandardErrorPath</key>
  <string>${logPath}</string>
</dict>
</plist>
`;
  const laDir = dirname(NEW_LAUNCH_AGENT_PATH);
  if (!existsSync(laDir)) mkdirSync(laDir, { recursive: true });
  writeFileSync(NEW_LAUNCH_AGENT_PATH, plist);
  log(`launchd plist 생성: ${NEW_LAUNCH_AGENT_PATH}`);
  spawn("launchctl", ["load", NEW_LAUNCH_AGENT_PATH], {
    stdio: "ignore",
    detached: true,
  }).unref();
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const sock = createConnection({ host: "127.0.0.1", port });
    sock.on("connect", () => {
      sock.destroy();
      resolve(true);
    });
    sock.on("error", () => resolve(false));
    setTimeout(() => {
      sock.destroy();
      resolve(false);
    }, 500);
  });
}

async function waitForServer(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(port)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function openBrowser(url) {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
}

function startServer() {
  if (!existsSync(STANDALONE_SERVER)) {
    throw new Error(`standalone server 없음: ${STANDALONE_SERVER}. npm run build 먼저 실행하세요.`);
  }
  const secret = ensureSecret();
  const env = {
    ...process.env,
    DATABASE_KIND: "sqlite",
    SQLITE_PATH,
    NEXTAUTH_SECRET: secret,
    NEXTAUTH_URL: `http://localhost:${PORT}`,
    PORT: String(PORT),
    HOSTNAME: "127.0.0.1",
  };

  // 로그 파일에 stdout/stderr 리다이렉트.
  const out = openSync(LOG_FILE, "a");
  const err = openSync(LOG_FILE, "a");

  const proc = spawn(process.execPath, [STANDALONE_SERVER], {
    env,
    cwd: STANDALONE_DIR,
    detached: true,
    stdio: ["ignore", out, err],
  });
  proc.unref();
  log(`server 시작 (PID ${proc.pid}, port ${PORT})`);
}

async function main() {
  ensureDataDir();
  ensureConfig();
  ensureLaunchAgentMac();
  await ensureSqliteSchema();

  if (await isPortOpen(PORT)) {
    log(`이미 ${PORT} 에 떠 있음 — 브라우저만 엽니다.`);
  } else {
    startServer();
    const ready = await waitForServer(PORT, 30000);
    if (!ready) {
      log(`server 가 30초 안에 응답하지 않음. 로그: ${LOG_FILE}`);
      process.exit(1);
    }
  }

  const url = `http://localhost:${PORT}/dashboard`;
  log(`브라우저 열기: ${url}`);
  openBrowser(url);
}

main().catch((err) => {
  log(`치명적 오류: ${err.message}`);
  process.exit(1);
});
