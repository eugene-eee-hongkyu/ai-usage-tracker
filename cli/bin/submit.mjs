#!/usr/bin/env node
/**
 * SessionEnd hook entry point.
 * Spawns ccusage, collects today's sessions, POSTs to /api/ingest.
 */

import { spawn } from "child_process";
import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const SERVER_URL = process.env.USAGE_TRACKER_URL ?? "https://usage.primuslabs.gg";
const KEYTAR_SERVICE = "primus-usage-tracker";
const KEYTAR_ACCOUNT = "api-key";

async function loadApiKey() {
  // Try env var first
  if (process.env.USAGE_TRACKER_API_KEY) return process.env.USAGE_TRACKER_API_KEY;

  // Try keytar
  try {
    const { default: keytar } = await import("keytar");
    const key = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    if (key) return key;
  } catch {
    // keytar unavailable
  }

  // Fallback file
  const fallbackPath = join(homedir(), ".primus-usage-key");
  if (existsSync(fallbackPath)) return readFileSync(fallbackPath, "utf8").trim();

  return null;
}

function spawnCcusage(since) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const proc = spawn("npx", ["ccusage", "--json", "--since", since], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ccusage exited ${code}`));
      try {
        const raw = Buffer.concat(chunks).toString("utf8").trim();
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error(`ccusage JSON parse error: ${e.message}`));
      }
    });
    proc.on("error", reject);
    // Timeout 60s
    setTimeout(() => { proc.kill(); reject(new Error("ccusage timeout")); }, 60_000);
  });
}

function sessionToRecord(session) {
  // ccusage session shape (best-effort mapping)
  const raw = JSON.stringify({
    project: session.projectPath ?? session.project ?? "unknown",
    startedAt: session.startTime ?? session.created_at ?? new Date().toISOString(),
  });
  const sessionIdHash = createHash("sha256").update(raw).digest("hex").slice(0, 32);

  return {
    sessionIdHash,
    project: session.projectPath ?? session.project ?? "unknown",
    model: session.model ?? "unknown",
    inputTokens: session.inputTokens ?? session.input_tokens ?? 0,
    outputTokens: session.outputTokens ?? session.output_tokens ?? 0,
    cacheRead: session.cacheReadTokens ?? session.cache_read_tokens ?? 0,
    cacheWrite: session.cacheWriteTokens ?? session.cache_write_tokens ?? 0,
    costUsd: session.costUsd ?? session.cost ?? 0,
    oneShotEdits: session.oneShotEdits ?? 0,
    totalEdits: session.totalEdits ?? 0,
    startedAt: session.startTime ?? session.created_at ?? new Date().toISOString(),
    endedAt: session.endTime ?? session.ended_at ?? new Date().toISOString(),
  };
}

async function main() {
  const apiKey = await loadApiKey();
  if (!apiKey) {
    // Silent exit — not yet configured
    process.exit(0);
  }

  // Collect last 2 days to handle timezone edge cases
  const since = new Date();
  since.setDate(since.getDate() - 2);
  const sinceStr = since.toISOString().slice(0, 10);

  let rawSessions;
  try {
    rawSessions = await spawnCcusage(sinceStr);
  } catch (err) {
    // ccusage unavailable — silent exit
    process.exit(0);
  }

  if (!Array.isArray(rawSessions) || rawSessions.length === 0) process.exit(0);

  const sessions = rawSessions.map(sessionToRecord);

  try {
    const resp = await fetch(`${SERVER_URL}/api/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ sessions }),
    });
    if (!resp.ok) {
      // Log to stderr but don't crash
      process.stderr.write(`[usage-tracker] ingest failed: ${resp.status}\n`);
    }
  } catch {
    // Network error — silent
  }

  process.exit(0);
}

main();
