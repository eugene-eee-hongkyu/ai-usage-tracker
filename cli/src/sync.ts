import { spawn } from "child_process";
import { loadApiKey } from "./init.js";

const SERVER_URL = process.env.USAGE_TRACKER_URL ?? "https://ai-usage-tracker-web-psi.vercel.app";

const PERIODS = ["today", "week", "month", "all"] as const;

function spawnCodeburn(period: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const proc = spawn("codeburn", ["report", "--format", "json", "--provider", "claude", "--period", period], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    proc.stdout.on("data", (d: Buffer) => chunks.push(d));
    proc.on("close", (code: number) => {
      if (code !== 0) return reject(new Error(`codeburn exited ${code} (period=${period})`));
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8").trim()));
      } catch (e) { reject(e); }
    });
    proc.on("error", reject);
    setTimeout(() => { proc.kill(); reject(new Error(`codeburn timeout (period=${period})`)); }, 120_000);
  });
}

export async function runSync(_days?: number) {
  const apiKey = process.env.USAGE_TRACKER_API_KEY ?? await loadApiKey();
  if (!apiKey) {
    console.error("API 키가 없습니다. 먼저 init을 실행하세요.");
    process.exit(1);
  }

  console.log("codeburn 데이터 수집 중...");

  try {
    const results = await Promise.all(PERIODS.map(p => spawnCodeburn(p)));
    const report = Object.fromEntries(PERIODS.map((p, i) => [p, results[i]]));

    const resp = await fetch(`${SERVER_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
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
