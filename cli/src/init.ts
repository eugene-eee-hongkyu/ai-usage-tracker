import { execSync, spawn } from "child_process";
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
    return;
  }
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

      res.writeHead(200, { "Content-Type": "text/html" });
      if (apiKey) {
        res.end(
          "<html><body style='font-family:sans-serif;padding:2em'>" +
          "<h2>✅ 인증 완료</h2><p>이 창을 닫아도 됩니다.</p></body></html>"
        );
        server.close();
        resolve(apiKey);
      } else {
        res.end("<html><body><h2>대기 중...</h2></body></html>");
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

function mergeHook(submitPath: string) {
  let settings: Record<string, unknown> = {};
  if (fs.existsSync(CLAUDE_SETTINGS_PATH)) {
    try {
      settings = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS_PATH, "utf8"));
    } catch {
      settings = {};
    }
  }

  type HookEntry = { matcher: string; hooks: Array<{ type: string; command: string }> };
  const hooks = (settings.hooks as Record<string, HookEntry[]>) ?? {};
  const sessionEndHooks: HookEntry[] = (hooks.SessionEnd as HookEntry[]) ?? [];

  const hookCommand = `node "${submitPath}"`;
  const alreadyRegistered = sessionEndHooks.some((group) =>
    group.hooks?.some((h) => h.command === hookCommand)
  );

  if (!alreadyRegistered) {
    sessionEndHooks.push({
      matcher: ".*",
      hooks: [{ type: "command", command: hookCommand }],
    });
    hooks.SessionEnd = sessionEndHooks;
    settings.hooks = hooks;

    fs.mkdirSync(path.dirname(CLAUDE_SETTINGS_PATH), { recursive: true });
    fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
    console.log("✅ SessionEnd hook 등록 완료");
  } else {
    console.log("✅ SessionEnd hook 이미 등록되어 있음");
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

export async function runInit() {
  console.log("🚀 Primus Usage Tracker 설치 시작\n");

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

  const submitPath = path.join(__dirname, "submit.mjs");
  mergeHook(submitPath);
  runBackfill(apiKey);

  console.log("\n✨ 설치 완료!");
  console.log("   Claude Code 세션을 종료하면 자동으로 사용량이 수집됩니다.");
  console.log(`   대시보드: ${SERVER_URL}/dashboard\n`);
}
