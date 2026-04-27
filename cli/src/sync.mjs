import { createRequire } from "node:module";
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// src/sync.ts
import { spawn } from "child_process";

// src/init.ts
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
var __dirname2 = path.dirname(fileURLToPath(import.meta.url));
var SERVER_URL = process.env.USAGE_TRACKER_URL ?? "https://ai-usage-tracker-web-psi.vercel.app";
var KEYTAR_SERVICE = "primus-usage-tracker";
var KEYTAR_ACCOUNT = "api-key";
var CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
var STABLE_DIR = path.join(os.homedir(), ".primus-usage-tracker");
var STABLE_SUBMIT = path.join(STABLE_DIR, "submit.mjs");
async function getKeytar() {
  try {
    const kt = await import("keytar");
    return kt.default ?? kt;
  } catch {
    return null;
  }
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

// src/sync.ts
var SERVER_URL2 = process.env.USAGE_TRACKER_URL ?? "https://ai-usage-tracker-web-psi.vercel.app";
var PERIODS = ["today", "week", "month", "all"];
function spawnCodeburn(period) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const proc = spawn("codeburn", ["report", "--format", "json", "--provider", "claude", "--period", period], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true
    });
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.on("close", (code) => {
      if (code !== 0)
        return reject(new Error(`codeburn exited ${code} (period=${period})`));
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8").trim()));
      } catch (e) {
        reject(e);
      }
    });
    proc.on("error", reject);
    setTimeout(() => {
      proc.kill();
      reject(new Error(`codeburn timeout (period=${period})`));
    }, 120000);
  });
}
async function runSync(_days) {
  const apiKey = process.env.USAGE_TRACKER_API_KEY ?? await loadApiKey();
  if (!apiKey) {
    console.error("API 키가 없습니다. 먼저 init을 실행하세요.");
    process.exit(1);
  }
  console.log("codeburn 데이터 수집 중...");
  try {
    const results = await Promise.all(PERIODS.map((p) => spawnCodeburn(p)));
    const report = Object.fromEntries(PERIODS.map((p, i) => [p, results[i]]));
    const resp = await fetch(`${SERVER_URL2}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(report)
    });
    if (resp.ok) {
      console.log("✅ 데이터 전송 완료");
    } else {
      console.error(`❌ 전송 실패: ${resp.status}`);
      process.exit(1);
    }
  } catch (err) {
    console.error("codeburn 실행 실패:", err.message);
    process.exit(1);
  }
}
var isMain = typeof process !== "undefined" && process.argv[1] && (process.argv[1].endsWith("sync.mjs") || process.argv[1].endsWith("sync.js"));
if (isMain) {
  runSync().catch((err) => {
    process.stderr.write(`[sync] error: ${err.message}
`);
    process.exit(1);
  });
}
export {
  runSync
};
