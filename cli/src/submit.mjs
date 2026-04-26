#!/usr/bin/env node
/**
 * SessionEnd hook entry point.
 * Runs `codeburn report --format json --provider claude --period all`
 * and POSTs the full JSON to /api/ingest.
 */

import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const SERVER_URL = process.env.USAGE_TRACKER_URL ?? "https://ai-usage-tracker-web-psi.vercel.app";
const KEYTAR_SERVICE = "primus-usage-tracker";
const KEYTAR_ACCOUNT = "api-key";

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

function spawnCodeburn() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const proc = spawn("codeburn", ["report", "--format", "json", "--provider", "claude", "--period", "all"], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`codeburn exited ${code}`));
      try {
        const raw = Buffer.concat(chunks).toString("utf8").trim();
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error(`codeburn JSON parse error: ${e.message}`));
      }
    });
    proc.on("error", reject);
    setTimeout(() => { proc.kill(); reject(new Error("codeburn timeout")); }, 60_000);
  });
}

async function main() {
  const apiKey = await loadApiKey();
  if (!apiKey) process.exit(0);

  let report;
  try {
    report = await spawnCodeburn();
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
