#!/usr/bin/env node
/**
 * SessionEnd hook entry point.
 * Installed to ~/.primus-usage-tracker/submit.mjs by `init`.
 * Calls codeburn for all periods and POSTs to /api/ingest.
 */

import { spawn } from "child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// Self-detach: SessionEnd hook 부모 프로세스는 VS Code 종료 시 SIGKILL될 수 있음.
// _USAGE_TRACKER_DETACHED 없으면 자신을 detached 백그라운드로 재생성하고 즉시 종료.
if (!process.env._USAGE_TRACKER_DETACHED) {
  const child = spawn(process.execPath, [join(homedir(), ".primus-usage-tracker", "submit.mjs")], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, _USAGE_TRACKER_DETACHED: "1" },
  });
  child.unref();
  process.exit(0);
}

const SERVER_URL = process.env.USAGE_TRACKER_URL ?? "https://ai-usage-tracker-web-psi.vercel.app";
const KEYTAR_SERVICE = "primus-usage-tracker";
const KEYTAR_ACCOUNT = "api-key";
const PERIODS = ["today", "week", "month", "all"];

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
    setTimeout(() => { proc.kill(); reject(new Error(`codeburn timeout (period=${period})`)); }, 60_000);
  });
}

async function main() {
  if (!acquireLock()) process.exit(0);

  try {
    const apiKey = await loadApiKey();
    if (!apiKey) return;

    let report;
    try {
      const results = await Promise.all(PERIODS.map((p) => spawnCodeburn(p)));
      report = Object.fromEntries(PERIODS.map((p, i) => [p, results[i]]));
    } catch {
      return;
    }

    try {
      const resp = await fetch(`${SERVER_URL}/api/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify(report),
      });
      if (!resp.ok) {
        process.stderr.write(`[usage-tracker] ingest failed: ${resp.status}\n`);
      }
    } catch {
      // Network error — silent
    }
  } finally {
    releaseLock();
  }

  process.exit(0);
}

main();
