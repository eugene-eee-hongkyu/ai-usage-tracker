#!/usr/bin/env node
import { spawn } from "child_process";
import { createHash } from "crypto";
import { loadApiKey } from "./init.mjs";

const SERVER_URL = process.env.USAGE_TRACKER_URL ?? "https://usage.primuslabs.gg";

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
        reject(e);
      }
    });
    proc.on("error", reject);
    setTimeout(() => { proc.kill(); reject(new Error("ccusage timeout")); }, 120_000);
  });
}

function dailyToRecords(dailyData) {
  const records = [];
  for (const day of dailyData) {
    const date = day.date;
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

export async function runSync(days = 90) {
  const apiKey = process.env.USAGE_TRACKER_API_KEY ?? await loadApiKey();
  if (!apiKey) {
    console.error("API 키가 없습니다. 먼저 init을 실행하세요.");
    process.exit(1);
  }

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10).replace(/-/g, "");

  console.log(`${days}일치 데이터 수집 중... (${sinceStr} 이후)`);

  let result;
  try {
    result = await spawnCcusage(sinceStr);
  } catch (err) {
    console.error("ccusage 실행 실패:", err.message);
    process.exit(1);
  }

  const dailyData = result?.daily ?? [];
  if (dailyData.length === 0) {
    console.log("수집할 데이터가 없습니다.");
    return;
  }

  const sessions = dailyToRecords(dailyData);
  console.log(`${sessions.length}개 레코드 전송 중...`);

  const resp = await fetch(`${SERVER_URL}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ sessions }),
  });

  if (resp.ok) {
    const data = await resp.json();
    console.log(`✅ ${data.inserted ?? sessions.length}개 레코드 전송 완료`);
  } else {
    console.error(`❌ 전송 실패: ${resp.status}`);
    process.exit(1);
  }
}

// Allow running directly as a script (backfill mode)
if (process.argv[1] && process.argv[1].endsWith("sync.mjs")) {
  const days = parseInt(process.env.USAGE_TRACKER_DAYS ?? "90");
  runSync(days).catch((err) => {
    process.stderr.write(`[sync] error: ${err.message}\n`);
    process.exit(1);
  });
}
