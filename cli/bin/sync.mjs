#!/usr/bin/env node
import { createRequire } from "node:module";
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// cli/src/sync.mjs
import { spawn } from "child_process";
import { createHash } from "crypto";

// cli/src/init.mjs
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
var __dirname2 = path.dirname(fileURLToPath(import.meta.url));
var SERVER_URL = process.env.USAGE_TRACKER_URL ?? "https://usage.primuslabs.gg";
var KEYTAR_SERVICE = "primus-usage-tracker";
var KEYTAR_ACCOUNT = "api-key";
var CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
var STABLE_DIR = path.join(os.homedir(), ".primus-usage-tracker");
async function getKeytar() {
  try {
    const kt = await import("keytar");
    return kt.default ?? kt;
  } catch {
    return null;
  }
}
async function loadApiKey() {
  if (process.env.USAGE_TRACKER_API_KEY)
    return process.env.USAGE_TRACKER_API_KEY;
  const keytar = await getKeytar();
  if (keytar) {
    const key = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    if (key)
      return key;
  }
  const fallbackPath = path.join(os.homedir(), ".primus-usage-key");
  if (fs.existsSync(fallbackPath))
    return fs.readFileSync(fallbackPath, "utf8").trim();
  return null;
}

// cli/src/sync.mjs
var SERVER_URL2 = process.env.USAGE_TRACKER_URL ?? "https://usage.primuslabs.gg";
function spawnCcusage(since) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const proc = spawn("npx", ["ccusage", "--json", "--since", since], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false
    });
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.on("close", (code) => {
      if (code !== 0)
        return reject(new Error(`ccusage exited ${code}`));
      try {
        const raw = Buffer.concat(chunks).toString("utf8").trim();
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    proc.on("error", reject);
    setTimeout(() => {
      proc.kill();
      reject(new Error("ccusage timeout"));
    }, 120000);
  });
}
function toRecord(session) {
  const raw = JSON.stringify({
    project: session.projectPath ?? session.project ?? "unknown",
    startedAt: session.startTime ?? session.created_at ?? new Date().toISOString()
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
    endedAt: session.endTime ?? session.ended_at ?? new Date().toISOString()
  };
}
async function runSync(days = 90) {
  const apiKey = process.env.USAGE_TRACKER_API_KEY ?? await loadApiKey();
  if (!apiKey) {
    console.error("API 키가 없습니다. 먼저 init을 실행하세요.");
    process.exit(1);
  }
  const since = new Date;
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);
  console.log(`${days}일치 데이터 수집 중... (${sinceStr} 이후)`);
  let rawSessions;
  try {
    rawSessions = await spawnCcusage(sinceStr);
  } catch (err) {
    console.error("ccusage 실행 실패:", err.message);
    process.exit(1);
  }
  if (!Array.isArray(rawSessions) || rawSessions.length === 0) {
    console.log("수집할 세션이 없습니다.");
    return;
  }
  const sessions = rawSessions.map(toRecord);
  console.log(`${sessions.length}개 세션 전송 중...`);
  const resp = await fetch(`${SERVER_URL2}/api/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey
    },
    body: JSON.stringify({ sessions })
  });
  if (resp.ok) {
    const data = await resp.json();
    console.log(`✅ ${data.inserted ?? sessions.length}개 세션 전송 완료`);
  } else {
    console.error(`❌ 전송 실패: ${resp.status}`);
    process.exit(1);
  }
}
if (process.argv[1] && process.argv[1].endsWith("sync.mjs")) {
  const days = parseInt(process.env.USAGE_TRACKER_DAYS ?? "90");
  runSync(days).catch((err) => {
    process.stderr.write(`[sync] error: ${err.message}
`);
    process.exit(1);
  });
}
export {
  runSync
};
