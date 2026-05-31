import { createRequire } from "node:module";
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// src/sync.ts
import { spawn } from "child_process";

// src/destinations.ts
import { readFileSync as readFileSync2 } from "fs";
import { join as join2 } from "path";
import { homedir as homedir2 } from "os";

// src/init.ts
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
var __dirname2 = path.dirname(fileURLToPath(import.meta.url));
var SERVER_URL = process.env.USAGE_TRACKER_URL ?? "https://aiusage.z21labs.world";
var KEYTAR_SERVICE = "z21labs-usage-tracker";
var KEYTAR_ACCOUNT = "api-key";
var CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
var STABLE_DIR = path.join(os.homedir(), ".z21labs", "usage-tracker");
var STABLE_SUBMIT = path.join(STABLE_DIR, "submit.mjs");
var STABLE_HISTORICAL = path.join(STABLE_DIR, "historical.mjs");
var API_KEY_FALLBACK = path.join(os.homedir(), ".z21labs", "usage-key");
var LAUNCHD_LABEL = "world.z21labs.ai-usage-tracker.sync";
var LAUNCHD_PLIST = process.platform === "darwin" ? path.join(os.homedir(), "Library", "LaunchAgents", `${LAUNCHD_LABEL}.plist`) : null;
var LEGACY_KEYTAR_SERVICE = "primus-usage-tracker";
var LEGACY_STABLE_DIR = path.join(os.homedir(), ".primus-usage-tracker");
var LEGACY_API_KEY_FALLBACK = path.join(os.homedir(), ".primus-usage-key");
var LEGACY_LAUNCHD_LABEL = "com.primus.usage-tracker.daily";
var LEGACY_LAUNCHD_PLIST = process.platform === "darwin" ? path.join(os.homedir(), "Library", "LaunchAgents", `${LEGACY_LAUNCHD_LABEL}.plist`) : null;
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

// src/destinations.ts
function readConfigFile() {
  const path2 = process.env.USAGE_TRACKER_CONFIG ?? join2(homedir2(), ".usage-tracker", "config.json");
  try {
    const raw = readFileSync2(path2, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed.destinations && Array.isArray(parsed.destinations) && parsed.destinations.length > 0) {
      return parsed;
    }
  } catch {}
  return null;
}
async function loadDestinations() {
  const cfg = readConfigFile();
  if (cfg?.destinations?.length) {
    return cfg.destinations.map((d) => ({
      name: d.name,
      url: d.url.replace(/\/$/, ""),
      apiKey: d.apiKey ?? null
    }));
  }
  const localMode = process.env.USAGE_TRACKER_MODE === "local";
  const localPort = process.env.LOCAL_PORT ?? "3000";
  const url = process.env.USAGE_TRACKER_URL ?? (localMode ? `http://localhost:${localPort}` : "https://aiusage.z21labs.world");
  const apiKey = localMode ? null : process.env.USAGE_TRACKER_API_KEY ?? await loadApiKey();
  return [
    {
      name: localMode ? "local" : "default",
      url: url.replace(/\/$/, ""),
      apiKey
    }
  ];
}

// src/sync.ts
var PERIODS = ["today", "week", "month", "30days", "all"];
var PROVIDERS = ["claude", "codex"];
var SYSTEM_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
var childEnv = { ...process.env, TZ: SYSTEM_TZ, CODEBURN_TZ: SYSTEM_TZ };
function spawnCodeburn(provider, period) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const proc = spawn("codeburn", ["report", "--format", "json", "--provider", provider, "--period", period], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: childEnv
    });
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.on("close", (code) => {
      if (code !== 0)
        return reject(new Error(`codeburn exited ${code} (${provider}/${period})`));
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8").trim()));
      } catch (e) {
        reject(e);
      }
    });
    proc.on("error", reject);
    setTimeout(() => {
      proc.kill();
      reject(new Error(`codeburn timeout (${provider}/${period})`));
    }, 600000);
  });
}
function spawnCcusageDaily(provider) {
  return new Promise((resolve) => {
    const chunks = [];
    const proc = spawn("ccusage", [provider, "daily", "--json"], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: childEnv
    });
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.on("close", (code) => {
      if (code !== 0)
        return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8").trim()));
      } catch {
        resolve(null);
      }
    });
    proc.on("error", () => resolve(null));
    setTimeout(() => {
      proc.kill();
      resolve(null);
    }, 600000);
  });
}
async function collectForProvider(provider) {
  const [results, ccusageDaily] = await Promise.all([
    Promise.all(PERIODS.map((p) => spawnCodeburn(provider, p))),
    spawnCcusageDaily(provider)
  ]);
  const providerReport = Object.fromEntries(PERIODS.map((p, i) => [p, results[i]]));
  if (ccusageDaily)
    providerReport.ccusageDaily = ccusageDaily;
  return providerReport;
}
async function postTo(dest, payload) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (dest.apiKey)
      headers["x-api-key"] = dest.apiKey;
    const resp = await fetch(`${dest.url}/api/ingest`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    return { ok: resp.ok, status: resp.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
async function runSync(_days) {
  const destinations = await loadDestinations();
  const orphan = destinations.find((d) => !d.apiKey && !d.url.includes("localhost") && !d.url.includes("127.0.0.1"));
  if (orphan) {
    console.error(`API 키가 없습니다 (destination=${orphan.name}). config.json 의 apiKey 또는 init 실행.`);
    process.exit(1);
  }
  const summary = destinations.map((d) => d.name).join(", ");
  console.log(`codeburn + ccusage 데이터 수집 중 (claude + codex)... (destinations: ${summary})`);
  let report;
  try {
    const [claudeReport, codexReport] = await Promise.all(PROVIDERS.map((p) => collectForProvider(p)));
    report = { claude: claudeReport, codex: codexReport };
  } catch (err) {
    console.error("codeburn 실행 실패:", err.message);
    process.exit(1);
  }
  const outcomes = await Promise.allSettled(destinations.map((d) => postTo(d, report)));
  let successCount = 0;
  outcomes.forEach((r, i) => {
    const d = destinations[i];
    if (r.status === "fulfilled" && r.value.ok) {
      console.log(`  ✅ ${d.name} (${d.url})`);
      successCount++;
    } else {
      const msg = r.status === "fulfilled" ? `HTTP ${r.value.status ?? "?"}${r.value.error ? " — " + r.value.error : ""}` : r.reason?.message ?? "unknown";
      console.error(`  ❌ ${d.name} (${d.url}) — ${msg}`);
    }
  });
  if (successCount === 0) {
    console.error("❌ 모든 destination 실패");
    process.exit(1);
  }
  console.log(`✅ ${successCount}/${destinations.length} destination 전송 완료`);
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
