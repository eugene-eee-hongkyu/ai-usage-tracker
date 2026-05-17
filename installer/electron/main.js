// Electron main process — AI Usage Tracker 데스크탑 앱.
//
// 동작:
//   1. ~/.usage-tracker 디렉토리 / SQLite / config.json 첫 실행 시 초기화
//   2. legacy 환경 (~/.primus-usage-key) detect → config.json 자동 마이그레이션
//   3. Next.js standalone server 를 child_process 로 띄움 (포트 자동 선택)
//   4. BrowserWindow 가 첫 실행이면 /wizard, 아니면 /dashboard 로드
//   5. 시스템 locale 자동 감지 → URL ?locale=ko/en/ja/... 전달
//   6. 윈도우 닫히면 server child 도 같이 종료
//
// 빌드 시점 (packaged): resourcesPath 안에 web/ + cli/ 가 들어 있음 (electron-builder
// extraResources 로 복사). 개발 모드 (electron .) 면 repo root 에서 직접 참조.

const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("path");
const { spawn, execSync } = require("child_process");
const { mkdirSync, existsSync, readFileSync, writeFileSync, openSync, readdirSync } = require("fs");
const { homedir } = require("os");
const net = require("net");
const crypto = require("crypto");

// better-sqlite3 가 시스템 Node 용으로 빌드되어 있음 (npm install 결과).
// Electron 의 Node ABI 와 안 맞아 NODE_MODULE_VERSION 충돌.
// 우회: 시스템 Node 를 찾아서 standalone server child 를 그걸로 띄움.
function findSystemNode() {
  const candidates = [
    "/opt/homebrew/bin/node",  // arm64 brew
    "/usr/local/bin/node",     // x86_64 brew + nvm shim
    "/usr/bin/node",
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  try {
    return execSync("which node", { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 경로 — 패키지 / 개발 분기

const isDev = !app.isPackaged;
// 패키지 모드: extraResources 가 process.resourcesPath/web, /cli 에 들어옴
// 개발 모드: repo root (= installer/electron 의 부모의 부모)
const APP_ROOT = isDev
  ? path.resolve(__dirname, "..", "..")
  : process.resourcesPath;

const DATA_DIR = process.env.DATA_DIR || path.join(homedir(), ".usage-tracker");
const SQLITE_PATH = path.join(DATA_DIR, "data.sqlite3");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const SECRET_FILE = path.join(DATA_DIR, ".nextauth-secret");
const LOG_FILE = path.join(DATA_DIR, "server.log");

const WEB_DIR = path.join(APP_ROOT, "web");
const STANDALONE_DIR = isDev
  ? path.join(WEB_DIR, ".next", "standalone")
  : WEB_DIR;
const STANDALONE_SERVER = path.join(STANDALONE_DIR, "server.js");
const MIGRATIONS_DIR = isDev
  ? path.join(WEB_DIR, "drizzle-sqlite")
  : path.join(WEB_DIR, "drizzle-sqlite");

const LEGACY_API_KEY_FILE = path.join(homedir(), ".primus-usage-key");
const LEGACY_LAUNCH_AGENT = path.join(
  homedir(),
  "Library",
  "LaunchAgents",
  "com.primus.usage-tracker.daily.plist"
);
const NEW_LAUNCH_AGENT_LABEL = "world.z21labs.ai-usage-tracker.sync";
const NEW_LAUNCH_AGENT_PATH = path.join(
  homedir(),
  "Library",
  "LaunchAgents",
  `${NEW_LAUNCH_AGENT_LABEL}.plist`
);
const COMPANY_URL = "https://aiusage.z21labs.world";

// ────────────────────────────────────────────────────────────────────────────
// helpers

function log(msg) {
  console.log(`[main] ${msg}`);
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
    log(`데이터 디렉토리 생성: ${DATA_DIR}`);
  }
}

function ensureSecret() {
  if (existsSync(SECRET_FILE)) return readFileSync(SECRET_FILE, "utf8").trim();
  const secret = crypto.randomBytes(32).toString("hex");
  writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
  return secret;
}

function detectLegacy() {
  const apiKey = existsSync(LEGACY_API_KEY_FILE)
    ? readFileSync(LEGACY_API_KEY_FILE, "utf8").trim() || null
    : null;
  const hasLaunchAgent = process.platform === "darwin" && existsSync(LEGACY_LAUNCH_AGENT);
  return { apiKey, hasLaunchAgent };
}

function isFirstRun() {
  return !existsSync(CONFIG_FILE);
}

async function ensureSqliteSchema() {
  if (existsSync(SQLITE_PATH)) return;
  if (!existsSync(MIGRATIONS_DIR)) {
    log(`migrations 디렉토리 없음 (${MIGRATIONS_DIR}) — SQLite 초기화 건너뜀`);
    return;
  }
  const sqlFiles = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  if (sqlFiles.length === 0) return;

  // 시스템 sqlite3 (mac/linux 기본 포함) 사용. windows 는 sqlite3 동봉 필요 (Phase 3.5).
  for (const f of sqlFiles) {
    const sqlPath = path.join(MIGRATIONS_DIR, f);
    log(`migration 적용: ${f}`);
    const proc = spawn("sqlite3", [SQLITE_PATH], {
      stdio: ["pipe", "inherit", "inherit"],
    });
    proc.stdin.write(readFileSync(sqlPath, "utf8"));
    proc.stdin.end();
    const code = await new Promise((res) => proc.on("close", res));
    if (code !== 0) throw new Error(`migration ${f} 실패 (exit ${code})`);
  }
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host: "127.0.0.1", port });
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

async function findFreePort(start = 3737) {
  for (let p = start; p < start + 100; p++) {
    if (!(await isPortOpen(p))) return p;
  }
  throw new Error(`사용 가능한 포트 없음 (${start}-${start + 100})`);
}

async function waitForServer(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(port)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

// 첫 실행 시 cli/sync.mjs 한 번 백그라운드 실행 — launchd 다음 사이클 (최대 2h) 까지
// 기다리지 않고 즉시 데이터 채움. 사용자가 dashboard 새로고침하면 표시됨.
function triggerFirstSync(syncPath, configPath) {
  if (!existsSync(syncPath)) {
    log(`sync.mjs 없음 (${syncPath}) — first-run sync 건너뜀`);
    return;
  }
  const nodeBin = findSystemNode();
  if (!nodeBin) {
    log("시스템 Node 없음 — first-run sync 건너뜀");
    return;
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const syncLog = openSync(path.join(DATA_DIR, "sync.log"), "a");
  const proc = spawn(nodeBin, [syncPath], {
    env: {
      ...process.env,
      USAGE_TRACKER_CONFIG: configPath,
      TZ: tz,
    },
    stdio: ["ignore", syncLog, syncLog],
    detached: true,
  });
  proc.unref();
  log(`first-run sync 트리거 (PID ${proc.pid})`);
}

function ensureLaunchAgentMac(syncPath, configPath) {
  if (process.platform !== "darwin") return;
  if (existsSync(LEGACY_LAUNCH_AGENT)) return;  // legacy 그대로
  if (existsSync(NEW_LAUNCH_AGENT_PATH)) return;
  if (!existsSync(syncPath)) {
    log(`sync.mjs 없음 (${syncPath}) — launchd 등록 건너뜀`);
    return;
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const logPath = path.join(DATA_DIR, "sync.log");
  // ProgramArguments 에 사용자 시스템 node 가 필요 — Electron 안의 node 가 아니라
  // 시스템 node 가 cli/sync.mjs 를 실행해야 ccusage / codeburn spawn 가능.
  const nodePath = "/usr/local/bin/node";
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${NEW_LAUNCH_AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${syncPath}</string>
  </array>
  <key>StartInterval</key>
  <integer>7200</integer>
  <key>EnvironmentVariables</key>
  <dict>
    <key>TZ</key>
    <string>${tz}</string>
    <key>USAGE_TRACKER_CONFIG</key>
    <string>${configPath}</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${logPath}</string>
  <key>StandardErrorPath</key>
  <string>${logPath}</string>
</dict>
</plist>
`;
  const laDir = path.dirname(NEW_LAUNCH_AGENT_PATH);
  if (!existsSync(laDir)) mkdirSync(laDir, { recursive: true });
  writeFileSync(NEW_LAUNCH_AGENT_PATH, plist);
  log(`launchd plist 생성: ${NEW_LAUNCH_AGENT_PATH}`);
  spawn("launchctl", ["load", NEW_LAUNCH_AGENT_PATH], {
    stdio: "ignore",
    detached: true,
  }).unref();
}

let serverProc = null;

function startServer(port) {
  if (!existsSync(STANDALONE_SERVER)) {
    throw new Error(`standalone server 없음: ${STANDALONE_SERVER}`);
  }
  const nodeBin = findSystemNode();
  if (!nodeBin) {
    throw new Error(
      "시스템 Node 를 찾을 수 없습니다.\n" +
        "https://nodejs.org/ 에서 Node 22+ 설치 후 다시 실행하세요.\n" +
        "(better-sqlite3 의 ABI 호환을 위해 시스템 Node 가 필요합니다.)"
    );
  }
  const secret = ensureSecret();
  const out = openSync(LOG_FILE, "a");
  const err = openSync(LOG_FILE, "a");

  // Next.js standalone server 가 spawn 의 process.env 를 module-load 시점 평가에
  // 즉시 반영 못 하는 케이스가 있어 (특히 DATABASE_KIND 같이 module top-level 에서
  // 확인되는 값), .env 파일로 함께 주입. .env 는 standalone cwd 에서 next-server 가
  // 자동 로드. 사용자별로 다른 SQLITE_PATH 등이 들어가야 하므로 매 실행마다 갱신.
  const envFile = path.join(STANDALONE_DIR, ".env");
  const envBody =
    `DATABASE_KIND=sqlite\n` +
    `SQLITE_PATH=${SQLITE_PATH}\n` +
    `NEXTAUTH_SECRET=${secret}\n` +
    `NEXTAUTH_URL=http://localhost:${port}\n`;
  writeFileSync(envFile, envBody, { mode: 0o600 });

  // Electron 안의 환경변수 leak 방지 — child 에는 standalone 에 필요한 것만 전달.
  const childEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      ([k]) => !k.startsWith("ELECTRON_") && k !== "NODE_OPTIONS"
    )
  );

  // Node 20.6+ 의 --env-file flag — Next.js standalone 의 module-load 시점
  // 환경변수 누락 우회. spawn 의 env 도 함께 전달 (PORT/HOSTNAME 등 next-server
  // 본체에 필요한 변수).
  serverProc = spawn(nodeBin, ["--env-file=" + envFile, STANDALONE_SERVER], {
    env: {
      ...childEnv,
      DATABASE_KIND: "sqlite",
      SQLITE_PATH,
      NEXTAUTH_SECRET: secret,
      NEXTAUTH_URL: `http://localhost:${port}`,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
    },
    cwd: STANDALONE_DIR,
    detached: false,
    stdio: ["ignore", out, err],
  });
  serverProc.on("exit", (code) => {
    log(`server 종료 (code=${code})`);
    serverProc = null;
  });
  log(`server 시작 (PID ${serverProc.pid}, port ${port})`);
}

function normalizeLocale(input) {
  if (!input) return "en";
  const lang = String(input).toLowerCase().split(/[-_]/)[0];
  return ["en", "ko"].includes(lang) ? lang : "en";
}

// ────────────────────────────────────────────────────────────────────────────
// app lifecycle

let mainWindow = null;
let serverPort = 3737;

async function main() {
  ensureDataDir();
  await ensureSqliteSchema();

  const firstRun = isFirstRun();
  serverPort = await findFreePort(3737);
  startServer(serverPort);

  const ready = await waitForServer(serverPort, 30000);
  if (!ready) {
    throw new Error(`server 시작 실패 — 로그: ${LOG_FILE}`);
  }

  // sync launchd 등록 — 패키지된 cli/sync.mjs 위치
  const syncPath = path.join(APP_ROOT, "cli", "sync.mjs");
  ensureLaunchAgentMac(syncPath, CONFIG_FILE);

  // 첫 실행 (data.sqlite3 처음 생성됐거나 user_snapshots 비어있는 경우) sync 한 번
  // 즉시 트리거 — 사용자가 launchd 사이클 (최대 2h) 기다리지 않게.
  if (firstRun) {
    triggerFirstSync(syncPath, CONFIG_FILE);
  }

  const locale = normalizeLocale(app.getLocale());
  const path0 = firstRun ? "/wizard" : "/dashboard";
  const url = `http://localhost:${serverPort}${path0}?locale=${locale}`;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "AI Usage Tracker",
    backgroundColor: "#0a0a0a",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(url);

  // 외부 링크는 시스템 브라우저
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  main().catch((err) => {
    log(`치명적 오류: ${err.message}\n${err.stack}`);
    const { dialog } = require("electron");
    dialog.showErrorBox("AI Usage Tracker — 시작 실패", err.message);
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && serverPort) {
      const locale = normalizeLocale(app.getLocale());
      mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: { contextIsolation: true, nodeIntegration: false },
      });
      mainWindow.loadURL(`http://localhost:${serverPort}/dashboard?locale=${locale}`);
    }
  });
});

app.on("window-all-closed", () => {
  if (serverProc) {
    try {
      serverProc.kill();
    } catch {}
  }
  // mac 도 quit (트레이 아이콘 없으므로)
  app.quit();
});
