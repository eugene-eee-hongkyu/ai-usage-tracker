#!/usr/bin/env node
/**
 * SessionEnd hook entry point.
 * Installed to ~/.primus-usage-tracker/submit.mjs by `init`.
 * Calls codeburn for all periods and POSTs to /api/ingest.
 */

import { spawn, execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync, appendFileSync, statSync, truncateSync, mkdirSync, accessSync, constants as fsConstants } from "fs";
import { join } from "path";
import { homedir } from "os";

const STABLE_DIR_EARLY = join(homedir(), ".primus-usage-tracker");
const SUBMIT_LOG = join(STABLE_DIR_EARLY, "submit.log");

// 로그 파일 1MB 초과 시 truncate
try { mkdirSync(STABLE_DIR_EARLY, { recursive: true }); } catch {}
try {
  if (existsSync(SUBMIT_LOG) && statSync(SUBMIT_LOG).size > 1_000_000) {
    truncateSync(SUBMIT_LOG, 0);
  }
} catch {}

const ts = () => new Date().toISOString();
const log = (msg) => {
  const line = `[${ts()}] ${msg}\n`;
  try { appendFileSync(SUBMIT_LOG, line); } catch {}
};

// Self-detach: SessionEnd hook 부모 프로세스는 VS Code 종료 시 SIGKILL될 수 있음.
// _USAGE_TRACKER_DETACHED 없으면 자신을 detached 백그라운드로 재생성하고 즉시 종료.
if (!process.env._USAGE_TRACKER_DETACHED) {
  log("self-detach (parent will exit)");
  const child = spawn(process.execPath, [join(homedir(), ".primus-usage-tracker", "submit.mjs")], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, _USAGE_TRACKER_DETACHED: "1" },
  });
  child.unref();
  process.exit(0);
}

// launchd가 Node에 TZ env를 안 넘겨주면 codeburn이 UTC로 today 계산.
// 시스템 timezone을 명시적으로 자식에 주입.
const SYSTEM_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const childEnv = { ...process.env, TZ: SYSTEM_TZ, CODEBURN_TZ: SYSTEM_TZ };

log("=== submit.mjs start ===");
log(`SYSTEM_TZ=${SYSTEM_TZ}, process.env.TZ=${process.env.TZ ?? "(unset)"}`);

const SERVER_URL = process.env.USAGE_TRACKER_URL ?? "https://aiusage.z21labs.world";
const KEYTAR_SERVICE = "primus-usage-tracker";
const KEYTAR_ACCOUNT = "api-key";
const PERIODS = ["today", "week", "month", "30days", "all"];

const STABLE_DIR = join(homedir(), ".primus-usage-tracker");
const LOCK_FILE = join(STABLE_DIR, "submit.lock");
const LOCK_TTL = 90_000; // 90s — covers codeburn 60s timeout + margin

async function loadApiKey() {
  if (process.env.USAGE_TRACKER_API_KEY) return process.env.USAGE_TRACKER_API_KEY;
  try {
    const { default: keytar } = await import("keytar");
    const key = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    if (key) return key;
  } catch {
    // keytar unavailable
  }
  const fallbackPath = join(homedir(), ".primus-usage-key");
  if (existsSync(fallbackPath)) return readFileSync(fallbackPath, "utf8").trim();
  return null;
}

function acquireLock() {
  if (existsSync(LOCK_FILE)) {
    const lockAge = Date.now() - parseInt(readFileSync(LOCK_FILE, "utf8") || "0");
    if (lockAge < LOCK_TTL) return false; // another instance is running
  }
  writeFileSync(LOCK_FILE, Date.now().toString());
  return true;
}

function releaseLock() {
  try { unlinkSync(LOCK_FILE); } catch {}
}

function spawnCodeburn(period) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    // shell: true — Claude Code hook 환경에서 PATH가 제한될 수 있어 shell 경유
    const proc = spawn("codeburn", ["report", "--format", "json", "--provider", "claude", "--period", period], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: childEnv,
    });
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`codeburn exited ${code} (period=${period})`));
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8").trim()));
      } catch (e) {
        reject(new Error(`codeburn JSON parse error: ${e.message}`));
      }
    });
    proc.on("error", reject);
    setTimeout(() => { proc.kill(); reject(new Error(`codeburn timeout (period=${period})`)); }, 600_000);
  });
}

// ccusage 결과 + 실패 사유. main()에서 ingest payload에 ccusageMissing 플래그를 붙이고
// submit.log에 명확한 진단 라인을 남긴다.
let ccusageStatus = "unknown"; // "ok" | "missing" | "error" | "timeout" | "parse"

function spawnCcusageDaily() {
  return new Promise((resolve) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    const proc = spawn("ccusage", ["daily", "--json"], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: childEnv,
    });
    proc.stdout.on("data", (d) => stdoutChunks.push(d));
    proc.stderr.on("data", (d) => stderrChunks.push(d));
    proc.on("close", (code) => {
      if (code !== 0) {
        // shell: true → ENOENT는 exit 127 + stderr "command not found"로 나타남
        const stderr = Buffer.concat(stderrChunks).toString("utf8");
        if (code === 127 || /not found|not recognized|cannot find/i.test(stderr)) {
          ccusageStatus = "missing";
          log("ccusage NOT INSTALLED — token graphs will be empty. Run: npm install -g ccusage");
        } else {
          ccusageStatus = "error";
          log(`ccusage exited ${code} — ${stderr.trim().slice(0, 200)}`);
        }
        return resolve(null);
      }
      try {
        const data = JSON.parse(Buffer.concat(stdoutChunks).toString("utf8").trim());
        ccusageStatus = "ok";
        resolve(data);
      } catch (e) {
        ccusageStatus = "parse";
        log(`ccusage JSON parse error: ${e?.message ?? e}`);
        resolve(null);
      }
    });
    proc.on("error", (err) => {
      if (err && err.code === "ENOENT") {
        ccusageStatus = "missing";
        log("ccusage NOT INSTALLED — token graphs will be empty. Run: npm install -g ccusage");
      } else {
        ccusageStatus = "error";
        log(`ccusage spawn error: ${err?.message ?? err}`);
      }
      resolve(null);
    });
    setTimeout(() => {
      proc.kill();
      ccusageStatus = "timeout";
      log("ccusage timeout (600s)");
      resolve(null);
    }, 600_000);
  });
}

// ccusage blocks — wall-clock 분 단위 분석용 5h 빌링 블록 데이터.
// daily가 성공하면 blocks도 보통 성공함. 실패해도 daily 진단 메시지가 이미
// 있으니 blocks 별도 로깅은 최소화 (성공/실패만 한 줄).
// 사용자 환경 진단 정보. ingest body 에 envInfo 로 포함되어 user_snapshots.rawJson
// 에 저장됨. /setup-status 페이지가 이걸 읽어 "내 환경" 카드 렌더링.
// 비민감 정보만 — Node 버전 / npm root 권한 / codeburn·ccusage 버전 / 매니저 종류.
function collectEnvInfo() {
  const safeExec = (cmd) => {
    try {
      return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"], encoding: "utf8", timeout: 3000 }).trim();
    } catch { return null; }
  };
  const detectManager = (p) => {
    if (!p) return null;
    if (p.includes("/.nvm/")) return "nvm";
    if (p.includes("/.asdf/")) return "asdf";
    if (p.includes("/.volta/")) return "volta";
    if (p.includes("/.fnm/") || process.env.FNM_DIR) return "fnm";
    if (p === "/usr/local/bin/node") return "pkg_installer";
    if (p.startsWith("/opt/homebrew/") || p.includes("/Cellar/node/")) return "homebrew";
    return "unknown";
  };
  const nodePath = safeExec(process.platform === "win32" ? "where node" : "which node");
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.replace(/^v/, "").split(".")[0], 10) || null;
  const npmRoot = safeExec("npm root -g");
  let npmRootWritable = null;
  if (npmRoot) {
    try { accessSync(npmRoot, fsConstants.W_OK); npmRootWritable = true; }
    catch { npmRootWritable = false; }
  }
  return {
    platform: process.platform,
    nodeVersion,
    nodeMajor,
    nodeManager: detectManager(nodePath),
    npmRoot,
    npmRootWritable,
    codeburnVersion: safeExec("codeburn --version"),
    ccusageVersion: safeExec("ccusage --version"),
    collectedAt: new Date().toISOString(),
  };
}

function spawnCcusageBlocks() {
  return new Promise((resolve) => {
    const stdoutChunks = [];
    const proc = spawn("ccusage", ["blocks", "--json"], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: childEnv,
    });
    proc.stdout.on("data", (d) => stdoutChunks.push(d));
    proc.on("close", (code) => {
      if (code !== 0) return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(stdoutChunks).toString("utf8").trim()));
      } catch { resolve(null); }
    });
    proc.on("error", () => resolve(null));
    setTimeout(() => { proc.kill(); resolve(null); }, 600_000);
  });
}

async function main() {
  if (!acquireLock()) {
    log("lock skip — another instance running");
    process.exit(0);
  }
  log("lock acquired");

  try {
    const apiKey = await loadApiKey();
    if (!apiKey) {
      log("ERROR: API key not found");
      return;
    }
    log("API key loaded");

    let report = {};
    try {
      log(`spawning codeburn x${PERIODS.length} + ccusage daily + ccusage blocks...`);
      const settled = await Promise.allSettled([
        ...PERIODS.map((p) => spawnCodeburn(p)),
        spawnCcusageDaily(),
        spawnCcusageBlocks(),
      ]);
      const cbResults = settled.slice(0, PERIODS.length);
      const ccResult = settled[PERIODS.length];
      const blocksResult = settled[PERIODS.length + 1];

      const okPeriods = [];
      const failPeriods = [];
      for (let i = 0; i < PERIODS.length; i++) {
        const r = cbResults[i];
        if (r.status === "fulfilled" && r.value) {
          report[PERIODS[i]] = r.value;
          okPeriods.push(PERIODS[i]);
        } else {
          failPeriods.push(`${PERIODS[i]}:${r.status === "rejected" ? r.reason?.message ?? r.reason : "empty"}`);
        }
      }
      const ccusageDaily = ccResult.status === "fulfilled" ? ccResult.value : null;
      if (ccusageDaily) report.ccusageDaily = ccusageDaily;
      if (ccusageStatus === "missing") report.ccusageMissing = true;
      const ccusageBlocks = blocksResult.status === "fulfilled" ? blocksResult.value : null;
      if (ccusageBlocks) {
        report.ccusageBlocks = ccusageBlocks;
        const cnt = Array.isArray(ccusageBlocks?.blocks) ? ccusageBlocks.blocks.length : 0;
        log(`ccusage blocks ok — ${cnt} blocks`);
      }

      if (okPeriods.length === 0 && !ccusageDaily) {
        log(`ERROR: all spawns failed — ${failPeriods.join(", ")}`);
        return;
      }
      log(`spawn done — codeburn ok=[${okPeriods.join(",")}]${failPeriods.length ? ` fail=[${failPeriods.join(",")}]` : ""}, ccusage=${ccusageStatus}`);

      try {
        report.envInfo = collectEnvInfo();
        log(`envInfo: node=${report.envInfo.nodeVersion} mgr=${report.envInfo.nodeManager} npm_writable=${report.envInfo.npmRootWritable}`);
      } catch (e) {
        log(`WARN: envInfo collect failed — ${e?.message ?? e}`);
      }
    } catch (e) {
      log(`ERROR: spawn block — ${e?.message ?? e}`);
      return;
    }

    try {
      log(`POST ${SERVER_URL}/api/ingest ...`);
      const resp = await fetch(`${SERVER_URL}/api/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify(report),
      });
      log(`ingest response: ${resp.status} ${resp.statusText}`);
      if (!resp.ok) {
        process.stderr.write(`[usage-tracker] ingest failed: ${resp.status}\n`);
      }
    } catch (e) {
      log(`ERROR: ingest network — ${e?.message ?? e}`);
      // Network error — silent
    }
  } finally {
    releaseLock();
    log("=== submit.mjs end ===");
  }

  process.exit(0);
}

main();
