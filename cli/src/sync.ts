import { spawn } from "child_process";
import { createHash } from "crypto";
import { loadApiKey } from "./init.js";

const SERVER_URL = process.env.USAGE_TRACKER_URL ?? "https://ai-usage-tracker-web-psi.vercel.app";

function spawnCcusage(since: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const proc = spawn("npx", ["ccusage", "--json", "--since", since], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    proc.stdout.on("data", (d: Buffer) => chunks.push(d));
    proc.on("close", (code: number) => {
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

function toRecord(session: Record<string, unknown>) {
  const raw = JSON.stringify({
    project: session.projectPath ?? session.project ?? "unknown",
    startedAt: session.startTime ?? session.created_at ?? new Date().toISOString(),
  });
  const sessionIdHash = createHash("sha256").update(raw).digest("hex").slice(0, 32);

  return {
    sessionIdHash,
    project: session.projectPath ?? session.project ?? "unknown",
    model: session.model ?? "unknown",
    inputTokens: (session.inputTokens ?? session.input_tokens ?? 0) as number,
    outputTokens: (session.outputTokens ?? session.output_tokens ?? 0) as number,
    cacheRead: (session.cacheReadTokens ?? session.cache_read_tokens ?? 0) as number,
    cacheWrite: (session.cacheWriteTokens ?? session.cache_write_tokens ?? 0) as number,
    costUsd: (session.costUsd ?? session.cost ?? 0) as number,
    oneShotEdits: (session.oneShotEdits ?? 0) as number,
    totalEdits: (session.totalEdits ?? 0) as number,
    startedAt: (session.startTime ?? session.created_at ?? new Date().toISOString()) as string,
    endedAt: (session.endTime ?? session.ended_at ?? new Date().toISOString()) as string,
  };
}

export async function runSync(days = 90) {
  const apiKey = process.env.USAGE_TRACKER_API_KEY ?? await loadApiKey();
  if (!apiKey) {
    console.error("API 키가 없습니다. 먼저 init을 실행하세요.");
    process.exit(1);
  }

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  console.log(`${days}일치 데이터 수집 중... (${sinceStr} 이후)`);

  let rawSessions: unknown[];
  try {
    rawSessions = await spawnCcusage(sinceStr);
  } catch (err) {
    console.error("ccusage 실행 실패:", (err as Error).message);
    process.exit(1);
  }

  if (!Array.isArray(rawSessions) || rawSessions.length === 0) {
    console.log("수집할 세션이 없습니다.");
    return;
  }

  const sessions = (rawSessions as Record<string, unknown>[]).map(toRecord);
  console.log(`${sessions.length}개 세션 전송 중...`);

  const resp = await fetch(`${SERVER_URL}/api/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ sessions }),
  });

  if (resp.ok) {
    const data = await resp.json() as { inserted: number };
    console.log(`✅ ${data.inserted ?? sessions.length}개 세션 전송 완료`);
  } else {
    console.error(`❌ 전송 실패: ${resp.status}`);
    process.exit(1);
  }
}
