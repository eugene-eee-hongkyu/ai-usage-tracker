import { createRequire } from "node:module";
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// src/init.ts
import { execSync, spawn, spawnSync } from "child_process";
import * as fs from "fs";
import * as http from "http";
import * as os from "os";
import * as path from "path";
import * as readline from "readline";
import { fileURLToPath } from "url";
var __dirname2 = path.dirname(fileURLToPath(import.meta.url));
var SERVER_URL = process.env.USAGE_TRACKER_URL ?? "https://aiusage.z21labs.world";
var CLI_VERSION = "0.2.0";
var KEYTAR_SERVICE = "z21labs-usage-tracker";
var KEYTAR_ACCOUNT = "api-key";
var CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
var STABLE_DIR = path.join(os.homedir(), ".z21labs", "usage-tracker");
var STABLE_SUBMIT = path.join(STABLE_DIR, "submit.mjs");
var STABLE_HISTORICAL = path.join(STABLE_DIR, "historical.mjs");
var API_KEY_FALLBACK = path.join(os.homedir(), ".z21labs", "usage-key");
var CLI_PORT = 9988;
var LAUNCHD_LABEL = "world.z21labs.ai-usage-tracker.sync";
var LAUNCHD_PLIST = process.platform === "darwin" ? path.join(os.homedir(), "Library", "LaunchAgents", `${LAUNCHD_LABEL}.plist`) : null;
var LEGACY_KEYTAR_SERVICE = "primus-usage-tracker";
var LEGACY_STABLE_DIR = path.join(os.homedir(), ".primus-usage-tracker");
var LEGACY_API_KEY_FALLBACK = path.join(os.homedir(), ".primus-usage-key");
var LEGACY_LAUNCHD_LABEL = "com.primus.usage-tracker.daily";
var LEGACY_LAUNCHD_PLIST = process.platform === "darwin" ? path.join(os.homedir(), "Library", "LaunchAgents", `${LEGACY_LAUNCHD_LABEL}.plist`) : null;
function preflightOwnership() {
  if (process.platform === "win32" || !process.getuid)
    return;
  const myUid = process.getuid();
  const bar = "═".repeat(60);
  if (myUid === 0) {
    console.error(`
` + bar);
    console.error("❌ root 권한으로 실행되었습니다");
    console.error("   설치/수리는 일반 사용자 권한으로만 실행하세요.");
    console.error("   sudo 없이 다시 시도하세요.");
    console.error(bar + `
`);
    process.exit(1);
  }
  const targets = [
    { path: STABLE_DIR, label: STABLE_DIR },
    { path: API_KEY_FALLBACK, label: API_KEY_FALLBACK },
    { path: LEGACY_STABLE_DIR, label: LEGACY_STABLE_DIR },
    { path: LEGACY_API_KEY_FALLBACK, label: LEGACY_API_KEY_FALLBACK }
  ];
  if (LAUNCHD_PLIST)
    targets.push({ path: LAUNCHD_PLIST, label: LAUNCHD_PLIST });
  if (LEGACY_LAUNCHD_PLIST)
    targets.push({ path: LEGACY_LAUNCHD_PLIST, label: LEGACY_LAUNCHD_PLIST });
  const wrong = [];
  for (const t of targets) {
    if (!fs.existsSync(t.path))
      continue;
    const stat = fs.statSync(t.path);
    if (stat.uid !== myUid)
      wrong.push({ ...t, uid: stat.uid, isDir: stat.isDirectory() });
  }
  if (wrong.length === 0)
    return;
  console.error(`
` + bar);
  console.error("❌ 다른 사용자 소유의 파일이 있습니다 (보통 root)");
  console.error("   원인: 과거 설치가 elevated 권한으로 실행됨.");
  console.error("   현 상태에선 launchd 가 daily.log / submit.lock 을 못 만들어");
  console.error("   매 실행이 EX_CONFIG (78) 으로 떨어집니다.");
  console.error("");
  for (const w of wrong)
    console.error(`   uid=${w.uid}  ${w.label}`);
  console.error("");
  console.error("   다음 명령으로 소유권 복구 후 다시 실행하세요:");
  for (const w of wrong) {
    const flag = w.isDir ? "-R " : "";
    console.error(`     sudo chown ${flag}"$(whoami):staff" "${w.path}"`);
  }
  console.error(bar + `
`);
  process.exit(1);
}
function promptYn(question, defaultYes = true) {
  let ttyFd;
  try {
    ttyFd = fs.openSync("/dev/tty", "r");
  } catch {
    return false;
  }
  process.stdout.write(question);
  const chunks = [];
  const single = Buffer.alloc(1);
  try {
    while (true) {
      const n = fs.readSync(ttyFd, single, 0, 1, null);
      if (n === 0)
        break;
      const c = single[0];
      if (c === 10)
        break;
      if (c === 13)
        continue;
      chunks.push(c);
    }
  } finally {
    fs.closeSync(ttyFd);
  }
  const ans = Buffer.from(chunks).toString("utf8").trim();
  if (!ans)
    return defaultYes;
  const lower = ans.toLowerCase();
  return lower === "y" || lower === "yes";
}
function runInstallShAndExit() {
  const bar = "═".repeat(60);
  console.log("");
  console.log("\uD83D\uDCE6 install.sh 자동 실행 중 (nvm + Node 22 + 자동 init)...");
  console.log("");
  try {
    execSync(`curl -fsSL ${SERVER_URL}/install.sh | bash`, { stdio: "inherit" });
  } catch {
    console.error("");
    console.error("❌ 자동 복구 실패. 수동 절차:");
    console.error(`   curl -fsSL ${SERVER_URL}/install.sh | bash`);
    console.error(`   npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair`);
    process.exit(1);
  }
  console.log("");
  console.log(bar);
  console.log("✅ 환경 설정 완료");
  console.log("");
  console.log("   현재 셸은 아직 옛 PATH 를 보고 있습니다. 새 Node 적용:");
  console.log("     1. 터미널 새 창 (⌘N) 열고 repair 재실행 — 권장");
  console.log("     2. 또는 현재 셸에서: exec $SHELL -l");
  console.log("        그 다음: npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair");
  console.log(bar);
  console.log("");
  process.exit(0);
}
function preflightNodeVersion() {
  const major = parseInt((process.versions.node ?? "0").split(".")[0], 10);
  if (!Number.isFinite(major) || major >= 22)
    return;
  const bar = "═".repeat(60);
  console.error(`
` + bar);
  console.error(`⚠️  Node ${process.versions.node} 감지 — codeburn / ccusage 는 Node 22 이상 필요`);
  console.error("");
  console.error("   이대로 install 하면:");
  console.error("     - npm EBADENGINE 경고 (install 자체는 됨)");
  console.error("     - codeburn / ccusage 런타임 오작동 위험");
  console.error("     - launchd 가 매 2시간마다 silent 실패 가능");
  console.error("");
  console.error("   자동 복구 가능:");
  console.error("     - nvm 설치 (~/.nvm/ 안에만, 시스템 Node 그대로 보존)");
  console.error("     - Node 22 설치 + 기본값으로 설정");
  console.error("     - ~/.zshrc 자동 백업 후 nvm 라인 추가");
  console.error("");
  console.error("   롤백 방법:");
  console.error("     nvm use system          # 셸 1개만 옛 Node 로");
  console.error(`     nvm alias default ${major}    # 기본을 다시 옛 버전으로`);
  console.error(bar);
  const autoFix = promptYn(`
   지금 자동 복구할까요? [Y/n]: `, true);
  if (autoFix) {
    runInstallShAndExit();
  }
  const forceProceed = promptYn(`
   자동 복구 건너뜀. 그래도 Node ${major} 로 강행할까요? [y/N]: `, false);
  if (!forceProceed) {
    console.error(`
   중단됨. 수동 복구:`);
    console.error("     nvm install 22 && nvm use 22 && nvm alias default 22");
    console.error("     npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair");
    process.exit(1);
  }
  console.warn(`
   ⚠️  Node ${major} 로 강행. 깨질 위험 인지함.
`);
}
function preflightGlobalPackages() {
  if (process.platform === "win32" || !process.getuid)
    return;
  let npmRoot;
  try {
    npmRoot = execSync("npm root -g", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return;
  }
  if (!npmRoot || !fs.existsSync(npmRoot))
    return;
  try {
    fs.accessSync(npmRoot, fs.constants.W_OK);
    return;
  } catch {}
  const myUid = process.getuid();
  const parentStat = fs.statSync(npmRoot);
  const installed = [];
  for (const p of ["codeburn", "ccusage"]) {
    if (fs.existsSync(path.join(npmRoot, p)))
      installed.push(p);
  }
  const bar = "═".repeat(60);
  console.error(`
` + bar);
  console.error("❌ npm 전역 디렉토리에 쓰기 권한이 없습니다");
  console.error(`   ${npmRoot}`);
  console.error(`   소유자 uid=${parentStat.uid}, 현재 uid=${myUid}`);
  console.error("");
  console.error("   원인: 시스템 Node 사용 중이거나 과거 sudo 로 설치됨.");
  console.error("   이 상태에선 codeburn/ccusage @latest 업그레이드가 EACCES");
  console.error("   (npm rename 단계) 로 실패합니다.");
  if (installed.length > 0) {
    console.error("");
    console.error(`   현재 막혀있는 패키지: ${installed.join(", ")}`);
  }
  console.error("");
  console.error("   자동 복구 가능:");
  console.error("     1. nvm 설치 (~/.nvm/ 안에만, 시스템 Node 그대로 보존)");
  console.error("     2. Node 22 설치 + 기본값으로 설정");
  console.error("     3. ~/.zshrc 자동 백업 후 nvm 라인 추가");
  console.error("");
  console.error("   변경되는 것:");
  console.error("     - ~/.zshrc 끝에 nvm 활성화 라인 추가 (백업본 자동 생성)");
  console.error("     - 기본 Node 가 ~/.nvm/.../v22.x.x 로 변경");
  console.error("     - 글로벌 CLI 들이 새 Node 환경에서 안 보일 수 있음 (목록 자동 백업)");
  console.error("");
  console.error("   롤백 방법:");
  console.error("     nvm use system            # 셸 1개만 옛 Node 로");
  console.error("     nvm alias default 20      # 기본을 다시 옛 버전으로");
  console.error("     백업: ~/.z21labs/usage-tracker/zshrc.bak-{timestamp}");
  console.error(bar);
  const accept = promptYn(`
   지금 자동 복구를 진행할까요? [Y/n]: `);
  if (accept) {
    runInstallShAndExit();
  }
  console.error("");
  console.error("   자동 복구를 건너뜁니다. 수동 절차:");
  console.error("");
  console.error("     # 1. root 소유로 박혀있는 옛 글로벌 패키지 제거");
  console.error("     sudo npm uninstall -g codeburn ccusage");
  console.error("");
  console.error("     # 2. nvm + Node 22 로 재설치");
  console.error(`     curl -fsSL ${SERVER_URL}/install.sh | bash`);
  console.error("");
  console.error("     # 3. repair 재실행");
  console.error("     npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair");
  console.error(bar + `
`);
  process.exit(1);
}
async function getKeytar() {
  try {
    const kt = await import("keytar");
    return kt.default ?? kt;
  } catch {
    return null;
  }
}
async function saveApiKey(apiKey) {
  const keytar = await getKeytar();
  if (keytar) {
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, apiKey);
  }
  fs.mkdirSync(path.dirname(API_KEY_FALLBACK), { recursive: true });
  fs.writeFileSync(API_KEY_FALLBACK, apiKey, { mode: 384 });
}
async function loadApiKey() {
  const keytar = await getKeytar();
  if (keytar) {
    const key = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    if (key)
      return key;
    const legacyKey = await keytar.getPassword(LEGACY_KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    if (legacyKey)
      return legacyKey;
  }
  if (fs.existsSync(API_KEY_FALLBACK)) {
    return fs.readFileSync(API_KEY_FALLBACK, "utf8").trim();
  }
  if (fs.existsSync(LEGACY_API_KEY_FALLBACK)) {
    return fs.readFileSync(LEGACY_API_KEY_FALLBACK, "utf8").trim();
  }
  return null;
}
async function deleteApiKey() {
  const keytar = await getKeytar();
  if (keytar) {
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    try {
      await keytar.deletePassword(LEGACY_KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    } catch {}
  }
  if (fs.existsSync(API_KEY_FALLBACK))
    fs.unlinkSync(API_KEY_FALLBACK);
  if (fs.existsSync(LEGACY_API_KEY_FALLBACK))
    fs.unlinkSync(LEGACY_API_KEY_FALLBACK);
}
function openBrowser(url) {
  try {
    const platform = process.platform;
    if (platform === "darwin")
      execSync(`open "${url}"`);
    else if (platform === "win32")
      execSync(`start "" "${url}"`);
    else
      execSync(`xdg-open "${url}"`);
  } catch {}
}
function getApiKeyViaLocalServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${CLI_PORT}`);
      const apiKey = url.searchParams.get("apiKey");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (apiKey) {
        res.end("<html><body style='font-family:sans-serif;padding:2em'><h2>&#x2705; Authentication Complete</h2><p>You can close this window.</p></body></html>");
        server.close();
        resolve(apiKey);
      } else {
        res.end("<html><body><h2>Waiting...</h2></body></html>");
      }
    });
    server.listen(CLI_PORT, "127.0.0.1", () => {
      const authUrl = `${SERVER_URL}/api/cli-auth?port=${CLI_PORT}`;
      console.log(`
브라우저에서 GitHub 계정으로 로그인하세요...`);
      console.log(`URL: ${authUrl}
`);
      openBrowser(authUrl);
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error(`포트 ${CLI_PORT}가 이미 사용 중입니다. 잠시 후 다시 시도하세요.`));
      } else {
        reject(err);
      }
    });
    setTimeout(() => {
      server.close();
      reject(new Error("인증 시간 초과 (5분)"));
    }, 300000);
  });
}
function findStableNodePath() {
  const candidates = [
    "/opt/homebrew/bin/node",
    "/usr/local/bin/node"
  ];
  for (const c of candidates) {
    if (fs.existsSync(c))
      return c;
  }
  try {
    const npmPrefix = execSync("npm config get prefix", { encoding: "utf8" }).trim();
    const npmNode = path.join(npmPrefix, "bin", "node");
    if (fs.existsSync(npmNode))
      return npmNode;
  } catch {}
  return process.execPath;
}
function registerLaunchd(submitPath) {
  const label = LAUNCHD_LABEL;
  const plistDir = path.join(os.homedir(), "Library", "LaunchAgents");
  const plistPath = path.join(plistDir, `${label}.plist`);
  if (LEGACY_LAUNCHD_PLIST && fs.existsSync(LEGACY_LAUNCHD_PLIST)) {
    try {
      execSync(`launchctl unload "${LEGACY_LAUNCHD_PLIST}"`, { stdio: "ignore" });
    } catch {}
    try {
      fs.unlinkSync(LEGACY_LAUNCHD_PLIST);
    } catch {}
  }
  const nodePath = findStableNodePath();
  if (nodePath !== process.execPath) {
    console.log("\uD83D\uDCCD plist node 경로: " + nodePath + " (nvm 의존성 회피)");
  }
  const envPath = process.env.PATH ?? "/usr/bin:/bin:/usr/sbin:/sbin";
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${submitPath}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${envPath}</string>
  </dict>
  <key>StartInterval</key>
  <integer>7200</integer>
  <key>StandardOutPath</key>
  <string>${path.join(STABLE_DIR, "daily.log")}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(STABLE_DIR, "daily-error.log")}</string>
</dict>
</plist>`;
  const uid = (() => {
    try {
      return execSync("id -u", { encoding: "utf8" }).trim();
    } catch (e) {
      console.log("⚠️  uid 조회 실패 — launchd 등록 건너뜀:", e.message);
      return null;
    }
  })();
  if (!uid)
    return;
  const gui = `gui/${uid}`;
  try {
    fs.mkdirSync(plistDir, { recursive: true });
  } catch (e) {
    console.log("⚠️  LaunchAgents 디렉토리 생성 실패:", e.message);
    return;
  }
  const alreadyLoaded = spawnSync("launchctl", ["print", `${gui}/${label}`], { stdio: "ignore" }).status === 0;
  if (alreadyLoaded) {
    const out = spawnSync("launchctl", ["bootout", `${gui}/${label}`], { encoding: "utf8" });
    if (out.status !== 0) {
      const errMsg = ((out.stderr ?? "") + (out.stdout ?? "")).trim();
      console.log("⚠️  기존 service bootout 실패 (exit " + out.status + ")");
      if (errMsg)
        console.log("    stderr:", errMsg);
      console.log("    수동 처리: launchctl bootout " + gui + "/" + label);
      return;
    }
  }
  try {
    fs.writeFileSync(plistPath, plist);
  } catch (e) {
    console.log(`⚠️  plist 파일 작성 실패 (${plistPath}):`, e.message);
    return;
  }
  const bootstrap = spawnSync("launchctl", ["bootstrap", gui, plistPath], { encoding: "utf8" });
  const bootstrapStderr = ((bootstrap.stderr ?? "") + (bootstrap.stdout ?? "")).trim();
  if (bootstrap.status !== 0) {
    console.log("⚠️  launchctl bootstrap 실패 (exit " + bootstrap.status + ")");
    if (bootstrapStderr)
      console.log("    stderr:", bootstrapStderr);
    console.log("    plist 파일은 생성됨:", plistPath);
    console.log("    수동 시도: launchctl bootstrap " + gui + ' "' + plistPath + '"');
    return;
  }
  const verify = spawnSync("launchctl", ["print", `${gui}/${label}`], { encoding: "utf8" });
  if (verify.status !== 0) {
    console.log("⚠️  bootstrap 종료코드 0 인데 service 가 launchd 에 안 보임");
    console.log("    launchctl print stderr:", ((verify.stderr ?? "") + (verify.stdout ?? "")).trim());
    console.log("    plist 파일은 생성됨:", plistPath);
    console.log("    수동 검증: launchctl list | grep " + label);
    return;
  }
  spawnSync("launchctl", ["kickstart", "-p", `${gui}/${label}`], { stdio: "ignore" });
  console.log("✅ 자동 동기화 등록 완료 (2시간마다, launchd. sleep 시 wake 즉시 catch-up)");
}
function registerWindowsTask(submitPath) {
  const taskName = "Z21labsUsageTracker";
  const wrapperPath = path.join(STABLE_DIR, "daily-sync.cmd");
  const xmlPath = path.join(STABLE_DIR, "task.xml");
  fs.writeFileSync(wrapperPath, `@echo off\r
"${process.execPath}" "${submitPath}"\r
`);
  const xml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <CalendarTrigger><StartBoundary>2000-01-01T00:00:00</StartBoundary><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger>
    <CalendarTrigger><StartBoundary>2000-01-01T06:00:00</StartBoundary><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger>
    <CalendarTrigger><StartBoundary>2000-01-01T12:00:00</StartBoundary><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger>
    <CalendarTrigger><StartBoundary>2000-01-01T18:00:00</StartBoundary><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger>
  </Triggers>
  <Settings>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT2H</ExecutionTimeLimit>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
  </Settings>
  <Actions>
    <Exec><Command>${wrapperPath}</Command></Exec>
  </Actions>
</Task>`;
  fs.writeFileSync(xmlPath, Buffer.from("\uFEFF" + xml, "utf16le"));
  const result = spawnSync("schtasks", [
    "/Create",
    "/TN",
    taskName,
    "/XML",
    xmlPath,
    "/F"
  ], { stdio: "ignore" });
  if (result.status === 0) {
    console.log("✅ 자동 동기화 등록 완료 (0/6/12/18시, Task Scheduler)");
  } else {
    console.log("⚠️  일간 자동 동기화 등록 실패 (선택 사항, 수동으로 등록 가능)");
  }
}
function registerDailySchedule(submitPath) {
  if (process.platform === "darwin") {
    registerLaunchd(submitPath);
  } else if (process.platform === "win32") {
    registerWindowsTask(submitPath);
  }
}
function removeHook() {
  if (!fs.existsSync(CLAUDE_SETTINGS_PATH))
    return;
  let settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS_PATH, "utf8"));
  } catch {
    return;
  }
  const hooks = settings.hooks ?? {};
  let changed = false;
  for (const event of ["SessionStart", "SessionEnd"]) {
    const existing = hooks[event] ?? [];
    const cleaned = existing.filter((group) => !group.hooks?.some((h) => h.command.includes("submit.mjs")));
    if (cleaned.length !== existing.length) {
      hooks[event] = cleaned;
      changed = true;
    }
  }
  if (changed) {
    settings.hooks = hooks;
    fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
    console.log("✅ 기존 세션 hook 제거 완료");
  }
}
function runBackfill(apiKey) {
  const syncScript = path.join(__dirname2, "sync.mjs");
  const syncTs = path.join(__dirname2, "sync.js");
  const scriptPath = fs.existsSync(syncScript) ? syncScript : fs.existsSync(syncTs) ? syncTs : null;
  if (!scriptPath)
    return;
  const child = spawn(process.execPath, [scriptPath], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      USAGE_TRACKER_API_KEY: apiKey,
      USAGE_TRACKER_URL: SERVER_URL,
      USAGE_TRACKER_DAYS: "90"
    }
  });
  child.unref();
  console.log("\uD83D\uDCE6 과거 데이터 백그라운드 수집 시작 (최대 90일)");
}
function runImmediateSync(apiKey) {
  if (!fs.existsSync(STABLE_SUBMIT))
    return;
  const child = spawn(process.execPath, [STABLE_SUBMIT], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      USAGE_TRACKER_API_KEY: apiKey,
      USAGE_TRACKER_URL: SERVER_URL,
      _USAGE_TRACKER_DETACHED: "1"
    }
  });
  child.unref();
  console.log("\uD83D\uDCE4 현재 데이터 즉시 수집 시작 (백그라운드)");
}
function runHistoricalBackfill(apiKey) {
  if (!fs.existsSync(STABLE_HISTORICAL))
    return;
  const child = spawn(process.execPath, [STABLE_HISTORICAL], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      USAGE_TRACKER_API_KEY: apiKey,
      USAGE_TRACKER_URL: SERVER_URL
    }
  });
  child.unref();
  console.log("\uD83D\uDCDA 과거 8주 + 12개월 historical backfill 시작 (백그라운드)");
}
function checkCodeburn() {
  try {
    const cmd = process.platform === "win32" ? "where codeburn" : "which codeburn";
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
async function installCodeburn() {
  console.log("\uD83D\uDCE6 codeburn 0.9.7 (핀 버전) 설치 중...");
  try {
    execSync("npm install -g codeburn@0.9.7", { stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}
function checkCcusage() {
  try {
    const cmd = process.platform === "win32" ? "where ccusage" : "which ccusage";
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
async function installCcusage() {
  console.log("\uD83D\uDCE6 ccusage 19.0.2 (핀 버전) 설치 중...");
  try {
    execSync("npm install -g ccusage@19.0.2", { stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}
async function ensureCcusage() {
  const hadBefore = checkCcusage();
  console.log(hadBefore ? "\uD83D\uDCE6 ccusage 19.0.2 (핀 버전) 강제 설치 시도..." : "⚠️  ccusage 미설치 — 최신 설치 시도...");
  const installed = await installCcusage();
  if (installed && checkCcusage()) {
    console.log(`✅ ccusage 19.0.2 확인됨
`);
    return true;
  }
  if (hadBefore) {
    console.log(`⚠️  ccusage 업그레이드 실패 — 기존 버전으로 계속 진행
`);
    return true;
  }
  const bar = "═".repeat(60);
  console.log(`
` + bar);
  console.log("❌ ccusage 설치 실패");
  console.log("   → 토큰/비용 데이터가 수집되지 않습니다.");
  console.log("   → 수동 설치 후 repair 를 다시 실행하세요:");
  console.log("       npm install -g ccusage@19.0.2");
  console.log("       npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair");
  console.log(bar + `
`);
  return false;
}
async function ensureCodeburn() {
  const hadBefore = checkCodeburn();
  console.log(hadBefore ? "\uD83D\uDCE6 codeburn 0.9.7 (핀 버전) 강제 설치 시도..." : "⚠️  codeburn 미설치 — 최신 설치 시도...");
  const installed = await installCodeburn();
  if (installed && checkCodeburn()) {
    console.log(`✅ codeburn 0.9.7 확인됨
`);
    return true;
  }
  if (hadBefore) {
    console.log(`⚠️  codeburn 업그레이드 실패 — 기존 버전으로 계속 진행
`);
    return true;
  }
  return false;
}
async function runRepair() {
  console.log(`\uD83D\uDD27 Usage Tracker v${CLI_VERSION} 복구 시작
`);
  preflightOwnership();
  preflightGlobalPackages();
  preflightNodeVersion();
  const apiKey = await loadApiKey();
  if (!apiKey) {
    console.error("❌ 설치된 API 키가 없습니다. 먼저 init을 실행하세요:");
    console.error("   npx --yes github:eugene-eee-hongkyu/ai-usage-tracker init");
    process.exit(1);
  }
  console.log(`✅ API 키 확인됨
`);
  const codeburnOk = await ensureCodeburn();
  if (!codeburnOk) {
    console.error("❌ codeburn 사용 불가 상태. 수동 설치 후 다시 시도하세요:");
    console.error("   npm install -g codeburn@0.9.7");
    process.exit(1);
  }
  const ccusageOk = await ensureCcusage();
  fs.mkdirSync(path.dirname(API_KEY_FALLBACK), { recursive: true });
  fs.writeFileSync(API_KEY_FALLBACK, apiKey, { mode: 384 });
  fs.mkdirSync(STABLE_DIR, { recursive: true });
  fs.copyFileSync(path.join(__dirname2, "submit.mjs"), STABLE_SUBMIT);
  fs.copyFileSync(path.join(__dirname2, "historical.mjs"), STABLE_HISTORICAL);
  removeHook();
  registerDailySchedule(STABLE_SUBMIT);
  runImmediateSync(apiKey);
  runHistoricalBackfill(apiKey);
  console.log(`
✨ 복구 완료!`);
  console.log("   백그라운드에서 자동으로 사용량이 수집됩니다.");
  console.log(`   대시보드: ${SERVER_URL}/dashboard
`);
  if (!ccusageOk) {
    console.log(`⚠️  주의: ccusage 미설치 상태로 저장되어 토큰/비용은 비어 있습니다.
`);
  }
  process.exit(0);
}
async function runInit() {
  console.log(`\uD83D\uDE80 Usage Tracker v${CLI_VERSION} 설치 시작
`);
  preflightOwnership();
  preflightGlobalPackages();
  preflightNodeVersion();
  const codeburnOk = await ensureCodeburn();
  if (!codeburnOk) {
    console.error("❌ codeburn 설치 실패. 수동으로 설치 후 다시 시도하세요:");
    console.error("   npm install -g codeburn@0.9.7");
    process.exit(1);
  }
  const ccusageOk = await ensureCcusage();
  const existingKey = await loadApiKey();
  if (existingKey) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((res) => rl.question("이미 설치되어 있습니다. 재설치할까요? (y/N) ", res));
    rl.close();
    if (answer.toLowerCase() !== "y") {
      console.log("설치 취소됨.");
      return;
    }
    await deleteApiKey();
  }
  let apiKey;
  try {
    apiKey = await getApiKeyViaLocalServer();
  } catch (err) {
    console.error("❌ 인증 실패:", err.message);
    process.exit(1);
  }
  await saveApiKey(apiKey);
  console.log("\uD83D\uDD11 API 키 저장 완료");
  fs.mkdirSync(STABLE_DIR, { recursive: true });
  fs.copyFileSync(path.join(__dirname2, "submit.mjs"), STABLE_SUBMIT);
  fs.copyFileSync(path.join(__dirname2, "historical.mjs"), STABLE_HISTORICAL);
  removeHook();
  registerDailySchedule(STABLE_SUBMIT);
  runBackfill(apiKey);
  runHistoricalBackfill(apiKey);
  console.log(`
✨ 설치 완료!`);
  console.log("   백그라운드에서 자동으로 사용량이 수집됩니다.");
  console.log(`   대시보드: ${SERVER_URL}/dashboard
`);
  if (!ccusageOk) {
    console.log(`⚠️  주의: ccusage 미설치 상태로 저장되어 토큰/비용은 비어 있습니다.
`);
  }
  process.exit(0);
}
export {
  runRepair,
  runInit,
  loadApiKey,
  deleteApiKey,
  CLI_VERSION
};
