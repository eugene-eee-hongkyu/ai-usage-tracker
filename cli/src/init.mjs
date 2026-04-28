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
var SERVER_URL = process.env.USAGE_TRACKER_URL ?? "https://ai-usage-tracker-web-psi.vercel.app";
var KEYTAR_SERVICE = "primus-usage-tracker";
var KEYTAR_ACCOUNT = "api-key";
var CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
var STABLE_DIR = path.join(os.homedir(), ".primus-usage-tracker");
var STABLE_SUBMIT = path.join(STABLE_DIR, "submit.mjs");
var CLI_PORT = 9988;
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
  const fallbackPath = path.join(os.homedir(), ".primus-usage-key");
  fs.writeFileSync(fallbackPath, apiKey, { mode: 384 });
}
async function loadApiKey() {
  const keytar = await getKeytar();
  if (keytar) {
    const key = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    if (key)
      return key;
  }
  const fallbackPath = path.join(os.homedir(), ".primus-usage-key");
  if (fs.existsSync(fallbackPath)) {
    return fs.readFileSync(fallbackPath, "utf8").trim();
  }
  return null;
}
async function deleteApiKey() {
  const keytar = await getKeytar();
  if (keytar) {
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
  }
  const fallbackPath = path.join(os.homedir(), ".primus-usage-key");
  if (fs.existsSync(fallbackPath))
    fs.unlinkSync(fallbackPath);
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
function registerLaunchd(submitPath) {
  const label = "com.primus.usage-tracker.daily";
  const plistDir = path.join(os.homedir(), "Library", "LaunchAgents");
  const plistPath = path.join(plistDir, `${label}.plist`);
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>${submitPath}</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>9</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${path.join(STABLE_DIR, "daily.log")}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(STABLE_DIR, "daily-error.log")}</string>
</dict>
</plist>`;
  try {
    const uid = execSync("id -u", { encoding: "utf8" }).trim();
    const gui = `gui/${uid}`;
    fs.mkdirSync(plistDir, { recursive: true });
    try {
      execSync(`launchctl bootout ${gui} "${plistPath}"`, { stdio: "ignore" });
    } catch {}
    try {
      execSync(`launchctl bootout ${gui}/${label}`, { stdio: "ignore" });
    } catch {}
    fs.writeFileSync(plistPath, plist);
    execSync(`launchctl bootstrap ${gui} "${plistPath}"`, { stdio: "ignore" });
    console.log("✅ 일간 자동 동기화 등록 완료 (매일 오전 9시, launchd)");
  } catch {
    console.log("⚠️  일간 자동 동기화 등록 실패 (선택 사항, 수동으로 등록 가능)");
  }
}
function registerWindowsTask(submitPath) {
  const taskName = "PrimusUsageTracker";
  const wrapperPath = path.join(STABLE_DIR, "daily-sync.cmd");
  const xmlPath = path.join(STABLE_DIR, "task.xml");
  fs.writeFileSync(wrapperPath, `@echo off\r
"${process.execPath}" "${submitPath}"\r
`);
  const xml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>2000-01-01T09:00:00</StartBoundary>
      <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
    </CalendarTrigger>
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
    console.log("✅ 일간 자동 동기화 등록 완료 (매일 오전 9시, Task Scheduler)");
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
function mergeHook(submitPath) {
  let settings = {};
  if (fs.existsSync(CLAUDE_SETTINGS_PATH)) {
    try {
      settings = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS_PATH, "utf8"));
    } catch {
      settings = {};
    }
  }
  const hooks = settings.hooks ?? {};
  const submitEntry = {
    matcher: ".*",
    hooks: [{ type: "command", command: `node "${submitPath}"` }]
  };
  for (const event of ["SessionStart", "SessionEnd"]) {
    const existing = hooks[event] ?? [];
    const cleaned = existing.filter((group) => !group.hooks?.some((h) => h.command.includes("submit.mjs")));
    cleaned.push(submitEntry);
    hooks[event] = cleaned;
  }
  settings.hooks = hooks;
  fs.mkdirSync(path.dirname(CLAUDE_SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
  console.log("✅ SessionStart + SessionEnd hook 등록 완료");
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
  console.log("\uD83D\uDCE6 codeburn 설치 중...");
  try {
    execSync("npm install -g codeburn", { stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}
async function runRepair() {
  console.log(`\uD83D\uDD27 Usage Tracker 복구 시작
`);
  const apiKey = await loadApiKey();
  if (!apiKey) {
    console.error("❌ 설치된 API 키가 없습니다. 먼저 init을 실행하세요:");
    console.error("   npx --yes github:eugene-eee-hongkyu/ai-usage-tracker init");
    process.exit(1);
  }
  console.log(`✅ API 키 확인됨
`);
  fs.mkdirSync(STABLE_DIR, { recursive: true });
  fs.copyFileSync(path.join(__dirname2, "submit.mjs"), STABLE_SUBMIT);
  mergeHook(STABLE_SUBMIT);
  registerDailySchedule(STABLE_SUBMIT);
  console.log(`
✨ 복구 완료!`);
  console.log("   Claude Code 세션 종료 시 + 매일 오전 9시 자동으로 사용량이 수집됩니다.");
  console.log(`   대시보드: ${SERVER_URL}/dashboard
`);
  process.exit(0);
}
async function runInit() {
  console.log(`\uD83D\uDE80 Usage Tracker 설치 시작
`);
  if (!checkCodeburn()) {
    console.log("⚠️  codeburn이 설치되어 있지 않습니다.");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((res) => rl.question("지금 설치할까요? (Y/n) ", res));
    rl.close();
    if (answer.toLowerCase() !== "n") {
      const ok = await installCodeburn();
      if (!ok) {
        console.error("❌ codeburn 설치 실패. 수동으로 설치하세요: npm install -g codeburn");
        process.exit(1);
      }
      console.log(`✅ codeburn 설치 완료
`);
    } else {
      console.log("⚠️  codeburn 없이는 사용량을 수집할 수 없습니다.");
      console.log("   나중에: npm install -g codeburn");
    }
  } else {
    console.log(`✅ codeburn 확인됨
`);
  }
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
  mergeHook(STABLE_SUBMIT);
  registerDailySchedule(STABLE_SUBMIT);
  runBackfill(apiKey);
  console.log(`
✨ 설치 완료!`);
  console.log("   Claude Code 세션 종료 시 + 매일 오전 9시 자동으로 사용량이 수집됩니다.");
  console.log(`   대시보드: ${SERVER_URL}/dashboard
`);
  process.exit(0);
}
export {
  runRepair,
  runInit,
  loadApiKey,
  deleteApiKey
};
