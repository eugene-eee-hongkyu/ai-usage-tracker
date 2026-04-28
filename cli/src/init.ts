import { execSync, spawn, spawnSync } from "child_process";
import * as fs from "fs";
import * as http from "http";
import * as os from "os";
import * as path from "path";
import * as readline from "readline";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SERVER_URL = process.env.USAGE_TRACKER_URL ?? "https://ai-usage-tracker-web-psi.vercel.app";
const KEYTAR_SERVICE = "primus-usage-tracker";
const KEYTAR_ACCOUNT = "api-key";
const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
const STABLE_DIR = path.join(os.homedir(), ".primus-usage-tracker");
const STABLE_SUBMIT = path.join(STABLE_DIR, "submit.mjs");
const CLI_PORT = 9988;

async function getKeytar() {
  try {
    const kt = await import("keytar");
    return (kt as { default?: unknown }).default ?? kt;
  } catch {
    return null;
  }
}

async function saveApiKey(apiKey: string) {
  const keytar = await getKeytar() as { setPassword: (s: string, a: string, p: string) => Promise<void> } | null;
  if (keytar) {
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, apiKey);
  }
  // submit.mjs는 standalone 실행 시 keytar node_modules가 없으므로 항상 파일에도 저장
  const fallbackPath = path.join(os.homedir(), ".primus-usage-key");
  fs.writeFileSync(fallbackPath, apiKey, { mode: 0o600 });
}

export async function loadApiKey(): Promise<string | null> {
  const keytar = await getKeytar() as { getPassword: (s: string, a: string) => Promise<string | null> } | null;
  if (keytar) {
    const key = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    if (key) return key;
  }
  const fallbackPath = path.join(os.homedir(), ".primus-usage-key");
  if (fs.existsSync(fallbackPath)) {
    return fs.readFileSync(fallbackPath, "utf8").trim();
  }
  return null;
}

export async function deleteApiKey() {
  const keytar = await getKeytar() as { deletePassword: (s: string, a: string) => Promise<boolean> } | null;
  if (keytar) {
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
  }
  const fallbackPath = path.join(os.homedir(), ".primus-usage-key");
  if (fs.existsSync(fallbackPath)) fs.unlinkSync(fallbackPath);
}

function openBrowser(url: string) {
  try {
    const platform = process.platform;
    if (platform === "darwin") execSync(`open "${url}"`);
    else if (platform === "win32") execSync(`start "" "${url}"`);
    else execSync(`xdg-open "${url}"`);
  } catch {
    // ignore
  }
}

function getApiKeyViaLocalServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${CLI_PORT}`);
      const apiKey = url.searchParams.get("apiKey");

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (apiKey) {
        res.end(
          "<html><body style='font-family:sans-serif;padding:2em'>" +
          "<h2>&#x2705; Authentication Complete</h2><p>You can close this window.</p></body></html>"
        );
        server.close();
        resolve(apiKey);
      } else {
        res.end("<html><body><h2>Waiting...</h2></body></html>");
      }
    });

    server.listen(CLI_PORT, "127.0.0.1", () => {
      const authUrl = `${SERVER_URL}/api/cli-auth?port=${CLI_PORT}`;
      console.log("\n브라우저에서 GitHub 계정으로 로그인하세요...");
      console.log(`URL: ${authUrl}\n`);
      openBrowser(authUrl);
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error(`포트 ${CLI_PORT}가 이미 사용 중입니다. 잠시 후 다시 시도하세요.`));
      } else {
        reject(err);
      }
    });

    setTimeout(() => {
      server.close();
      reject(new Error("인증 시간 초과 (5분)"));
    }, 5 * 60 * 1000);
  });
}

function registerLaunchd(submitPath: string): void {
  const label = "com.primus.usage-tracker.daily";
  const plistDir = path.join(os.homedir(), "Library", "LaunchAgents");
  const plistPath = path.join(plistDir, `${label}.plist`);

  const envPath = process.env.PATH ?? "/usr/bin:/bin:/usr/sbin:/sbin";
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
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${envPath}</string>
  </dict>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>0</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>6</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>12</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>18</integer><key>Minute</key><integer>0</integer></dict>
  </array>
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
    try { execSync(`launchctl bootout ${gui} "${plistPath}"`, { stdio: "ignore" }); } catch {}
    try { execSync(`launchctl bootout ${gui}/${label}`, { stdio: "ignore" }); } catch {}
    fs.writeFileSync(plistPath, plist);
    execSync(`launchctl bootstrap ${gui} "${plistPath}"`, { stdio: "ignore" });
    console.log("✅ 자동 동기화 등록 완료 (0/6/12/18시, launchd)");
  } catch {
    console.log("⚠️  일간 자동 동기화 등록 실패 (선택 사항, 수동으로 등록 가능)");
  }
}

function registerWindowsTask(submitPath: string): void {
  const taskName = "PrimusUsageTracker";
  const wrapperPath = path.join(STABLE_DIR, "daily-sync.cmd");
  const xmlPath = path.join(STABLE_DIR, "task.xml");

  fs.writeFileSync(wrapperPath, `@echo off\r\n"${process.execPath}" "${submitPath}"\r\n`);

  // XML 등록: StartWhenAvailable=true → 꺼져 있다가 켜지면 즉시 실행
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

  // Task Scheduler XML은 UTF-16LE로 저장해야 인식됨
  fs.writeFileSync(xmlPath, Buffer.from("﻿" + xml, "utf16le"));

  const result = spawnSync("schtasks", [
    "/Create", "/TN", taskName, "/XML", xmlPath, "/F",
  ], { stdio: "ignore" });

  if (result.status === 0) {
    console.log("✅ 자동 동기화 등록 완료 (0/6/12/18시, Task Scheduler)");
  } else {
    console.log("⚠️  일간 자동 동기화 등록 실패 (선택 사항, 수동으로 등록 가능)");
  }
}

function registerDailySchedule(submitPath: string): void {
  if (process.platform === "darwin") {
    registerLaunchd(submitPath);
  } else if (process.platform === "win32") {
    registerWindowsTask(submitPath);
  }
}

function removeHook() {
  if (!fs.existsSync(CLAUDE_SETTINGS_PATH)) return;
  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS_PATH, "utf8"));
  } catch {
    return;
  }

  type HookEntry = { matcher: string; hooks: Array<{ type: string; command: string }> };
  const hooks = (settings.hooks as Record<string, HookEntry[]>) ?? {};
  let changed = false;

  for (const event of ["SessionStart", "SessionEnd"] as const) {
    const existing: HookEntry[] = (hooks[event] as HookEntry[]) ?? [];
    const cleaned = existing.filter(
      (group) => !group.hooks?.some((h) => h.command.includes("submit.mjs"))
    );
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

function runBackfill(apiKey: string) {
  const syncScript = path.join(__dirname, "sync.mjs");
  const syncTs = path.join(__dirname, "sync.js");
  const scriptPath = fs.existsSync(syncScript) ? syncScript : fs.existsSync(syncTs) ? syncTs : null;
  if (!scriptPath) return;

  const child = spawn(process.execPath, [scriptPath], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      USAGE_TRACKER_API_KEY: apiKey,
      USAGE_TRACKER_URL: SERVER_URL,
      USAGE_TRACKER_DAYS: "90",
    },
  });
  child.unref();
  console.log("📦 과거 데이터 백그라운드 수집 시작 (최대 90일)");
}

function checkCodeburn(): boolean {
  try {
    const cmd = process.platform === "win32" ? "where codeburn" : "which codeburn";
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function installCodeburn(): Promise<boolean> {
  console.log("📦 codeburn 설치 중...");
  try {
    execSync("npm install -g codeburn", { stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}

export async function runRepair() {
  console.log("🔧 Usage Tracker 복구 시작\n");

  const apiKey = await loadApiKey();
  if (!apiKey) {
    console.error("❌ 설치된 API 키가 없습니다. 먼저 init을 실행하세요:");
    console.error("   npx --yes github:eugene-eee-hongkyu/ai-usage-tracker init");
    process.exit(1);
  }
  console.log("✅ API 키 확인됨\n");

  fs.mkdirSync(STABLE_DIR, { recursive: true });
  fs.copyFileSync(path.join(__dirname, "submit.mjs"), STABLE_SUBMIT);
  removeHook();
  registerDailySchedule(STABLE_SUBMIT);

  console.log("\n✨ 복구 완료!");
  console.log("   0/6/12/18시마다 자동으로 사용량이 수집됩니다.");
  console.log(`   대시보드: ${SERVER_URL}/dashboard\n`);
  process.exit(0);
}

export async function runInit() {
  console.log("🚀 Usage Tracker 설치 시작\n");

  if (!checkCodeburn()) {
    console.log("⚠️  codeburn이 설치되어 있지 않습니다.");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((res) =>
      rl.question("지금 설치할까요? (Y/n) ", res)
    );
    rl.close();
    if (answer.toLowerCase() !== "n") {
      const ok = await installCodeburn();
      if (!ok) {
        console.error("❌ codeburn 설치 실패. 수동으로 설치하세요: npm install -g codeburn");
        process.exit(1);
      }
      console.log("✅ codeburn 설치 완료\n");
    } else {
      console.log("⚠️  codeburn 없이는 사용량을 수집할 수 없습니다.");
      console.log("   나중에: npm install -g codeburn");
    }
  } else {
    console.log("✅ codeburn 확인됨\n");
  }

  const existingKey = await loadApiKey();
  if (existingKey) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((res) =>
      rl.question("이미 설치되어 있습니다. 재설치할까요? (y/N) ", res)
    );
    rl.close();
    if (answer.toLowerCase() !== "y") {
      console.log("설치 취소됨.");
      return;
    }
    await deleteApiKey();
  }

  let apiKey: string;
  try {
    apiKey = await getApiKeyViaLocalServer();
  } catch (err) {
    console.error("❌ 인증 실패:", (err as Error).message);
    process.exit(1);
  }

  await saveApiKey(apiKey);
  console.log("🔑 API 키 저장 완료");

  // submit.mjs를 안정적인 경로에 복사 (npx 캐시 경로는 갱신 시 깨짐)
  fs.mkdirSync(STABLE_DIR, { recursive: true });
  fs.copyFileSync(path.join(__dirname, "submit.mjs"), STABLE_SUBMIT);
  removeHook();
  registerDailySchedule(STABLE_SUBMIT);
  runBackfill(apiKey);

  console.log("\n✨ 설치 완료!");
  console.log("   0/6/12/18시마다 자동으로 사용량이 수집됩니다.");
  console.log(`   대시보드: ${SERVER_URL}/dashboard\n`);
  process.exit(0);
}
