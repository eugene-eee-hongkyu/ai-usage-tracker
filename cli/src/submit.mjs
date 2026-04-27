#!/usr/bin/env node
/**
 * SessionEnd hook entry point.
 * Installed to ~/.primus-usage-tracker/submit.mjs by `init`.
 * Calls codeburn for all periods and POSTs to /api/ingest.
 */

import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const SERVER_URL = process.env.USAGE_TRACKER_URL ?? "https://ai-usage-tracker-web-psi.vercel.app";
const KEYTAR_SERVICE = "primus-usage-tracker";
const KEYTAR_ACCOUNT = "api-key";
const PERIODS = ["today", "week", "month", "all"];

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
  const apiKey = await loadApiKey();
  if (!apiKey) process.exit(0);

  let report;
  try {
    const results = await Promise.all(PERIODS.map((p) => spawnCodeburn(p)));
    report = Object.fromEntries(PERIODS.map((p, i) => [p, results[i]]));
  } catch {
    process.exit(0);
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

  process.exit(0);
}

main();
