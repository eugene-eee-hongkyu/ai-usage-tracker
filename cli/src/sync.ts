import { spawn } from "child_process";
import { loadApiKey } from "./init.js";

// 로컬 단독 모드 (.pkg/.msi 인스톨러) — Next.js 가 SQLite 모드로 localhost 에 떠 있다고 가정.
// API key 인증 우회 (서버 측 IS_LOCAL_MODE 가 ensureLocalUser 자동 생성).
// 명시 USAGE_TRACKER_URL 이 있으면 그것 우선. LOCAL_PORT 환경변수로 포트 커스터마이즈.
const LOCAL_MODE = process.env.USAGE_TRACKER_MODE === "local";
const LOCAL_PORT = process.env.LOCAL_PORT ?? "3000";
const SERVER_URL =
  process.env.USAGE_TRACKER_URL ??
  (LOCAL_MODE ? `http://localhost:${LOCAL_PORT}` : "https://aiusage.z21labs.world");

const PERIODS = ["today", "week", "month", "30days", "all"] as const;

// launchd가 Node에 TZ env를 안 넘겨주면 codeburn이 UTC로 today 계산. 명시 주입.
const SYSTEM_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const childEnv = { ...process.env, TZ: SYSTEM_TZ, CODEBURN_TZ: SYSTEM_TZ };

function spawnCodeburn(period: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const proc = spawn("codeburn", ["report", "--format", "json", "--provider", "claude", "--period", period], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: childEnv,
    });
    proc.stdout.on("data", (d: Buffer) => chunks.push(d));
    proc.on("close", (code: number) => {
      if (code !== 0) return reject(new Error(`codeburn exited ${code} (period=${period})`));
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8").trim()));
      } catch (e) { reject(e); }
    });
    proc.on("error", reject);
    setTimeout(() => { proc.kill(); reject(new Error(`codeburn timeout (period=${period})`)); }, 600_000);
  });
}

function spawnCcusageDaily(): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const proc = spawn("ccusage", ["daily", "--json"], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: childEnv,
    });
    proc.stdout.on("data", (d: Buffer) => chunks.push(d));
    proc.on("close", (code: number) => {
      if (code !== 0) return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8").trim()));
      } catch { resolve(null); }
    });
    proc.on("error", () => resolve(null));
    setTimeout(() => { proc.kill(); resolve(null); }, 600_000);
  });
}

function spawnCcusageBlocks(): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const proc = spawn("ccusage", ["blocks", "--json"], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: childEnv,
    });
    proc.stdout.on("data", (d: Buffer) => chunks.push(d));
    proc.on("close", (code: number) => {
      if (code !== 0) return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8").trim()));
      } catch { resolve(null); }
    });
    proc.on("error", () => resolve(null));
    setTimeout(() => { proc.kill(); resolve(null); }, 600_000);
  });
}

export async function runSync(_days?: number) {
  // 로컬 모드면 API key 불필요 — 서버 (localhost Next.js, SQLite) 가 자동 단일 사용자 보장.
  const apiKey = LOCAL_MODE ? "" : (process.env.USAGE_TRACKER_API_KEY ?? await loadApiKey());
  if (!LOCAL_MODE && !apiKey) {
    console.error("API 키가 없습니다. 먼저 init을 실행하세요.");
    process.exit(1);
  }

  console.log(`codeburn + ccusage 데이터 수집 중... (${LOCAL_MODE ? "로컬" : "서버"} 모드 → ${SERVER_URL})`);

  try {
    const [results, ccusageDaily, ccusageBlocks] = await Promise.all([
      Promise.all(PERIODS.map(p => spawnCodeburn(p))),
      spawnCcusageDaily(),
      spawnCcusageBlocks(),
    ]);
    const report: Record<string, unknown> = Object.fromEntries(PERIODS.map((p, i) => [p, results[i]]));
    if (ccusageDaily) report.ccusageDaily = ccusageDaily;
    if (ccusageBlocks) report.ccusageBlocks = ccusageBlocks;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (!LOCAL_MODE) headers["x-api-key"] = apiKey;
    const resp = await fetch(`${SERVER_URL}/api/ingest`, {
      method: "POST",
      headers,
      body: JSON.stringify(report),
    });

    if (resp.ok) {
      console.log("✅ 데이터 전송 완료");
    } else {
      console.error(`❌ 전송 실패: ${resp.status}`);
      process.exit(1);
    }
  } catch (err) {
    console.error("codeburn 실행 실패:", (err as Error).message);
    process.exit(1);
  }
}

const isMain = typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("sync.mjs") || process.argv[1].endsWith("sync.js"));
if (isMain) {
  runSync().catch((err: Error) => {
    process.stderr.write(`[sync] error: ${err.message}\n`);
    process.exit(1);
  });
}
