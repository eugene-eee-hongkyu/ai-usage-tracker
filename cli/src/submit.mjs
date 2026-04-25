#!/usr/bin/env node
/**
 * SessionEnd hook entry point.
 * Uses `ccusage daily --json` → maps to /api/ingest records (one per day×model).
 */

import { spawn } from "child_process";
import { createHash } from "crypto";
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

function spawnCcusage(since) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const proc = spawn("npx", ["ccusage", "daily", "--json", "--since", since], {
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
    setTimeout(() => { proc.kill(); reject(new Error("ccusage timeout")); }, 60_000);
  });
}

// ccusage daily output: { daily: [{ date, inputTokens, outputTokens, cacheCreationTokens,
//   cacheReadTokens, totalCost, modelBreakdowns: [{ modelName, inputTokens, ... }] }] }
function dailyToRecords(dailyData) {
  const records = [];
  for (const day of dailyData) {
    const date = day.date; // "2026-04-25"
    const breakdowns = day.modelBreakdowns ?? [];
    for (const model of breakdowns) {
      const key = `${date}|${model.modelName}`;
      const sessionIdHash = createHash("sha256").update(key).digest("hex").slice(0, 32);
      records.push({
        sessionIdHash,
        project: "claude-code",
        model: model.modelName,
        inputTokens: model.inputTokens ?? 0,
        outputTokens: model.outputTokens ?? 0,
        cacheRead: model.cacheReadTokens ?? 0,
        cacheWrite: model.cacheCreationTokens ?? 0,
        costUsd: model.cost ?? 0,
        oneShotEdits: 0,
        totalEdits: 0,
        startedAt: `${date}T00:00:00.000Z`,
        endedAt: `${date}T23:59:59.000Z`,
      });
    }
    // Fallback: if no model breakdowns, send one aggregate record
    if (breakdowns.length === 0) {
      const sessionIdHash = createHash("sha256").update(date).digest("hex").slice(0, 32);
      records.push({
        sessionIdHash,
        project: "claude-code",
        model: (day.modelsUsed ?? ["unknown"])[0],
        inputTokens: day.inputTokens ?? 0,
        outputTokens: day.outputTokens ?? 0,
        cacheRead: day.cacheReadTokens ?? 0,
        cacheWrite: day.cacheCreationTokens ?? 0,
        costUsd: day.totalCost ?? 0,
        oneShotEdits: 0,
        totalEdits: 0,
        startedAt: `${date}T00:00:00.000Z`,
        endedAt: `${date}T23:59:59.000Z`,
      });
    }
  }
  return records;
}

async function main() {
  const apiKey = await loadApiKey();
  if (!apiKey) process.exit(0);

  const since = new Date();
  since.setDate(since.getDate() - 2);
  const sinceStr = since.toISOString().slice(0, 10).replace(/-/g, "");

  let result;
  try {
    result = await spawnCcusage(sinceStr);
  } catch {
    process.exit(0);
  }

  const dailyData = result?.daily ?? [];
  if (dailyData.length === 0) process.exit(0);

  const sessions = dailyToRecords(dailyData);

  try {
    const resp = await fetch(`${SERVER_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ sessions }),
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
