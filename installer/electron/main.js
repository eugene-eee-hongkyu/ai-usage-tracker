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
// 우회: Node 바이너리를 찾아서 standalone server child 를 그걸로 띄움.
// 우선순위: ① .app 동봉 Node 22 → ② 시스템 Node (brew/nvm/system) → ③ which.
function findBundledNode() {
  // packaged: process.resourcesPath/runtime/node/bin/node
  // dev: installer/electron/staged/runtime/node/bin/node
  const candidate = isDev
    ? path.join(__dirname, "staged", "runtime", "node", "bin", "node")
    : path.join(process.resourcesPath, "runtime", "node", "bin", "node");
  return existsSync(candidate) ? candidate : null;
}

function findSystemNode() {
  // 동봉 Node 가 최우선 — better-sqlite3 ABI 127 (Node 22) prebuilt 와 일치.
  const bundled = findBundledNode();
  if (bundled) return bundled;
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

// 동봉 의존성 (codeburn/ccusage) 가 설치되는 사용자별 위치.
// .app 안 (read-only) 이 아니라 ~/.usage-tracker/runtime/ 에 두는 이유:
//   1) .app 은 mac Gatekeeper 가 read-only mount 처리
//   2) 사용자별로 codeburn 캐시 / config 분리
const RUNTIME_DIR = path.join(DATA_DIR, "runtime");
const RUNTIME_BIN = path.join(RUNTIME_DIR, "node_modules", ".bin");
const RUNTIME_MANIFEST = path.join(RUNTIME_DIR, "installed.json");

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
const MAIN_LOG_FILE = path.join(DATA_DIR, "main.log");

// ────────────────────────────────────────────────────────────────────────────
// helpers

// .app 더블클릭 실행 시 main process 의 console.log 는 어디로도 안 감.
// 진단 가능한 위치로 보내야 ensureRuntimeDeps / config sync 같은 사일런트
// 실패를 추적할 수 있다. server.log 는 standalone server child 전용이라 분리.
function log(msg) {
  const line = `[${new Date().toISOString()}] [main] ${msg}\n`;
  console.log(line.trim());
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    require("fs").appendFileSync(MAIN_LOG_FILE, line);
  } catch {
    // logging 실패는 silent — main process 진행에 영향 안 줘야 함
  }
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

// .dmg 자족화 — .app 안 prebuilt/node_modules 트리를 ~/.usage-tracker/runtime/ 에
// 한 번 복사. installed.json 의 버전 매니페스트가 staged manifest 와 일치하면 skip.
//
// 사용자 홈에 두는 이유:
//   - .app 은 Gatekeeper read-only mount (codeburn 이 install 디렉토리에 쓰려 하면 실패)
//   - codeburn cache / config 도 같은 트리에 모이도록
async function ensureRuntimeDeps() {
  const stagedManifestPath = isDev
    ? path.join(__dirname, "staged", "runtime", "manifest.json")
    : path.join(process.resourcesPath, "runtime", "manifest.json");
  if (!existsSync(stagedManifestPath)) {
    log(`동봉 runtime 매니페스트 없음 (${stagedManifestPath}) — dep 복사 건너뜀`);
    return;
  }
  const stagedManifest = JSON.parse(readFileSync(stagedManifestPath, "utf8"));
  const packages = stagedManifest.packages || [];
  if (packages.length === 0) return;

  // 이미 동일 버전 설치되어 있으면 skip.
  const stagedKey = packages.map((p) => `${p.name}@${p.version}`).sort().join(",");
  const codeburnBin = path.join(RUNTIME_BIN, "codeburn");
  const ccusageBin = path.join(RUNTIME_BIN, "ccusage");
  const binsExist = existsSync(codeburnBin) && existsSync(ccusageBin);

  function writeManifest() {
    try {
      writeFileSync(
        RUNTIME_MANIFEST,
        JSON.stringify({ installedAt: new Date().toISOString(), packages }, null, 2)
      );
      log(`installed.json 작성 완료: ${RUNTIME_MANIFEST}`);
    } catch (e) {
      log(`installed.json 작성 실패 (계속 진행): ${e.message}`);
    }
  }

  if (existsSync(RUNTIME_MANIFEST)) {
    try {
      const installed = JSON.parse(readFileSync(RUNTIME_MANIFEST, "utf8"));
      const installedKey = (installed.packages || [])
        .map((p) => `${p.name}@${p.version}`)
        .sort()
        .join(",");
      if (installedKey === stagedKey && binsExist) {
        log(`runtime deps 이미 설치됨 (${installedKey}) — skip`);
        return;
      }
    } catch {
      // 매니페스트 손상 — 재설치
    }
  } else if (binsExist) {
    // installed.json 만 없고 .bin/* 은 이미 정상 — cp 는 이전 launch 에서 성공했는데
    // writeFileSync 가 어떤 이유로 실패했던 상태. 다시 cp 할 필요 없이 매니페스트만 박는다.
    log(`installed.json 없음 but .bin/codeburn + .bin/ccusage 존재 — 매니페스트만 보강`);
    writeManifest();
    return;
  }

  const prebuiltDir = isDev
    ? path.join(__dirname, "staged", "runtime", "prebuilt")
    : path.join(process.resourcesPath, "runtime", "prebuilt");
  const prebuiltNm = path.join(prebuiltDir, "node_modules");
  if (!existsSync(prebuiltNm)) {
    log(`prebuilt node_modules 없음 (${prebuiltNm}) — dep 복사 건너뜀`);
    return;
  }

  log(`runtime deps 복사 시작 (${stagedKey}) — ${prebuiltNm} → ${RUNTIME_DIR}`);
  mkdirSync(RUNTIME_DIR, { recursive: true });

  // 기존 node_modules 가 있으면 제거 후 통째로 복사.
  const targetNm = path.join(RUNTIME_DIR, "node_modules");
  if (existsSync(targetNm)) {
    require("fs").rmSync(targetNm, { recursive: true, force: true });
  }
  // symlink (.bin/* → ../<pkg>/bin/...) 보존 — `cp -RP` (preserve symlinks
  // verbatim). Node 의 fs.cpSync 는 기본값으로 symlink target 을 resolve 해버려
  // 상대 경로가 절대 경로로 깨진다.
  try {
    execSync(`cp -RP "${prebuiltNm}" "${targetNm}"`, { stdio: "pipe" });
  } catch (e) {
    log(`cp -RP 실패: ${e.message}`);
    throw e;
  }
  log(`runtime deps 복사 완료 — ${RUNTIME_BIN}`);
  writeManifest();
}

function buildEnrichedPath() {
  // codeburn/ccusage 탐색 우선순위:
  //   ① 사용자 홈 runtime/.bin (~/.usage-tracker/runtime/node_modules/.bin)
  //   ② .app 동봉 Node bin (#!/usr/bin/env node 해석용)
  //   ③ nvm 버전 bin
  //   ④ /opt/homebrew/bin (arm64 brew)
  //   ⑤ /usr/local/bin (x86_64 brew + nvm shim)
  //   ⑥ 기존 PATH
  const bundledNode = findBundledNode();
  const bundledNodeBin = bundledNode ? path.dirname(bundledNode) : "";
  const homeNvm = path.join(homedir(), ".nvm", "versions", "node");
  let nvmBins = "";
  try {
    const versions = require("fs").readdirSync(homeNvm).filter((v) => v.startsWith("v"));
    nvmBins = versions.map((v) => path.join(homeNvm, v, "bin")).join(":");
  } catch {}
  return [RUNTIME_BIN, bundledNodeBin, nvmBins, "/opt/homebrew/bin", "/usr/local/bin", process.env.PATH || "/usr/bin:/bin"]
    .filter(Boolean)
    .join(":");
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
  // GUI launch 환경의 PATH 는 빈약 (`/usr/bin:/bin` 만). 동봉 codeburn/ccusage 와
  // 시스템 글로벌을 모두 보강 (buildEnrichedPath).
  const proc = spawn(nodeBin, [syncPath], {
    env: {
      ...process.env,
      PATH: buildEnrichedPath(),
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
  if (!existsSync(syncPath)) {
    log(`sync.mjs 없음 (${syncPath}) — launchd 등록 건너뜀`);
    return;
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const logPath = path.join(DATA_DIR, "sync.log");
  // ProgramArguments 의 Node 경로 — findSystemNode 는 동봉 Node (.app 안) 를
  // 우선 반환. 사용자가 .app 옮기면 launchd 가 깨지지만, 정상 설치 경로 (Applications)
  // 면 안정.
  const nodePath = findSystemNode() || "/usr/local/bin/node";
  // launchd 의 기본 PATH 가 빈약해 codeburn/ccusage 못 찾음. 동봉 deps 포함
  // 우선순위 PATH 보강 (buildEnrichedPath 와 동일 정책).
  const launchdPath = buildEnrichedPath();
  const desiredPlist = `<?xml version="1.0" encoding="UTF-8"?>
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
    <key>PATH</key>
    <string>${launchdPath}</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${logPath}</string>
  <key>StandardErrorPath</key>
  <string>${logPath}</string>
</dict>
</plist>
`;
  // 업그레이드 경로 처리: 기존 plist 의 내용이 desired 와 다르면 unload + 재작성.
  // 이전 .dmg 버전 (시스템 Node 의존) 사용자가 v0.1.1 으로 올라올 때 plist 가
  // 옛 Node 경로 / 옛 PATH 를 그대로 두면 launchd 가 codeburn 못 찾음.
  if (existsSync(NEW_LAUNCH_AGENT_PATH)) {
    try {
      const currentPlist = readFileSync(NEW_LAUNCH_AGENT_PATH, "utf8");
      if (currentPlist === desiredPlist) {
        return; // 이미 최신
      }
      log(`launchd plist 변경 감지 — unload + 재작성`);
      try {
        execSync(`launchctl unload "${NEW_LAUNCH_AGENT_PATH}"`, { stdio: "ignore" });
      } catch {
        // unload 실패 (이미 unloaded 일 수 있음) — 무시
      }
    } catch {
      // 읽기 실패 — 그냥 덮어쓰기
    }
  }
  const laDir = path.dirname(NEW_LAUNCH_AGENT_PATH);
  if (!existsSync(laDir)) mkdirSync(laDir, { recursive: true });
  writeFileSync(NEW_LAUNCH_AGENT_PATH, desiredPlist);
  log(`launchd plist 작성: ${NEW_LAUNCH_AGENT_PATH}`);
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

  // 동봉 의존성 버전 — nav 의 AboutPopover 에서 표시. staged manifest + electron
  // app.getVersion() 으로 산출. cloud 빌드에는 env 가 안 박혀 있어 권장 버전
  // fallback (PINNED 상수) 으로 표시됨.
  const stagedManifestPath = isDev
    ? path.join(__dirname, "staged", "runtime", "manifest.json")
    : path.join(process.resourcesPath, "runtime", "manifest.json");
  let runtimeNodeVersion = "";
  let runtimeCodeburnVersion = "";
  let runtimeCcusageVersion = "";
  try {
    const stagedManifest = JSON.parse(readFileSync(stagedManifestPath, "utf8"));
    runtimeNodeVersion = stagedManifest.node || "";
    const pkgs = stagedManifest.packages || [];
    runtimeCodeburnVersion = pkgs.find((p) => p.name === "codeburn")?.version || "";
    runtimeCcusageVersion = pkgs.find((p) => p.name === "ccusage")?.version || "";
  } catch {
    // manifest 없음 (dev 또는 broken stage) — env 비움
  }
  const appVersion = app.getVersion ? app.getVersion() : "";

  // Next.js standalone server 가 spawn 의 process.env 를 module-load 시점 평가에
  // 즉시 반영 못 하는 케이스가 있어 (특히 DATABASE_KIND 같이 module top-level 에서
  // 확인되는 값), .env 파일로 함께 주입. .env 는 standalone cwd 에서 next-server 가
  // 자동 로드. 사용자별로 다른 SQLITE_PATH 등이 들어가야 하므로 매 실행마다 갱신.
  const envFile = path.join(STANDALONE_DIR, ".env");
  const envBody =
    `DATABASE_KIND=sqlite\n` +
    `SQLITE_PATH=${SQLITE_PATH}\n` +
    `NEXTAUTH_SECRET=${secret}\n` +
    `NEXTAUTH_URL=http://localhost:${port}\n` +
    `LOCAL_MODE=1\n` +
    `APP_VERSION=${appVersion}\n` +
    `RUNTIME_NODE_VERSION=${runtimeNodeVersion}\n` +
    `RUNTIME_CODEBURN_VERSION=${runtimeCodeburnVersion}\n` +
    `RUNTIME_CCUSAGE_VERSION=${runtimeCcusageVersion}\n`;
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
      LOCAL_MODE: "1",
      APP_VERSION: appVersion,
      RUNTIME_NODE_VERSION: runtimeNodeVersion,
      RUNTIME_CODEBURN_VERSION: runtimeCodeburnVersion,
      RUNTIME_CCUSAGE_VERSION: runtimeCcusageVersion,
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

// config.json 의 name === "local" destination URL 을 현재 server port 로 자동 갱신.
// 위저드가 `http://localhost:${window.location.port}` 으로 박은 값이 다음 launch 의
// 새 동적 port (findFreePort) 와 어긋나는 문제를 해결. launchd sync 가 항상 살아 있는
// 새 server 로 POST 하도록 유지.
//
// 사용자가 손편집한 "local" 도 덮어쓰지만, 자연 흐름엔 그런 케이스 없음 (위저드가
// 항상 localhost 로 set + 사용자가 손편집할 동기 없음).
function syncLocalDestinationPort(port) {
  if (!existsSync(CONFIG_FILE)) return;
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
  } catch (e) {
    log(`config.json 파싱 실패 — local port 동기화 skip: ${e.message}`);
    return;
  }
  if (!cfg || !Array.isArray(cfg.destinations)) return;
  const desired = `http://localhost:${port}`;
  let changed = false;
  for (const d of cfg.destinations) {
    if (d?.name === "local" && d.url !== desired) {
      log(`config.json local destination 갱신: ${d.url} → ${desired}`);
      d.url = desired;
      changed = true;
    }
  }
  if (!changed) return;
  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
  } catch (e) {
    log(`config.json 쓰기 실패: ${e.message}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// app lifecycle

let mainWindow = null;
let serverPort = 3737;

async function main() {
  ensureDataDir();
  await ensureSqliteSchema();
  try {
    await ensureRuntimeDeps();
  } catch (e) {
    log(`runtime deps 복사 실패 (계속 진행): ${e.message}`);
  }

  const firstRun = isFirstRun();
  serverPort = await findFreePort(3737);
  startServer(serverPort);

  const ready = await waitForServer(serverPort, 30000);
  if (!ready) {
    throw new Error(`server 시작 실패 — 로그: ${LOG_FILE}`);
  }

  // server ready 후 config.json local destination port 동기화 — 매 launch 마다
  // 동적 port 잡으므로 옛 port 가 stale 상태가 되는 걸 방지.
  syncLocalDestinationPort(serverPort);

  // sync launchd 등록 — 패키지된 cli/sync.mjs 위치
  const syncPath = path.join(APP_ROOT, "cli", "sync.mjs");
  ensureLaunchAgentMac(syncPath, CONFIG_FILE);

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
  mainWindow.webContents.setWindowOpenHandler(({ url: u }) => {
    shell.openExternal(u);
    return { action: "deny" };
  });

  // 위저드가 /dashboard 로 client-side router.push 하면 그 시점에 sync 한 번 트리거.
  // 그래야 위저드 save 가 만든 config.json 을 sync 가 읽음 (legacy fallback 아니라).
  let syncTriggered = false;
  const onNav = (_e, navUrl) => {
    if (syncTriggered) return;
    if (!navUrl.includes("/dashboard")) return;
    if (!existsSync(CONFIG_FILE)) return;
    syncTriggered = true;
    triggerFirstSync(syncPath, CONFIG_FILE);
  };
  mainWindow.webContents.on("did-navigate-in-page", onNav);
  mainWindow.webContents.on("did-navigate", onNav);
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
