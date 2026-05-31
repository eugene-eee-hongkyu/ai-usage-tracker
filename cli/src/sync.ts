import { spawn } from "child_process";
import { loadDestinations, type Destination } from "./destinations.js";

const PERIODS = ["today", "week", "month", "30days", "all"] as const;
const PROVIDERS = ["claude", "codex"] as const;
type Provider = (typeof PROVIDERS)[number];

// launchd가 Node에 TZ env를 안 넘겨주면 codeburn이 UTC로 today 계산. 명시 주입.
const SYSTEM_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const childEnv = { ...process.env, TZ: SYSTEM_TZ, CODEBURN_TZ: SYSTEM_TZ };

// Multi-provider (2026-05-29): provider 인자로 Claude / Codex 분리 호출.
// codeburn 은 `--provider <name>`, ccusage 는 sub-command (`ccusage claude/codex daily|blocks`).
// 빈 환경 (e.g. ~/.codex/sessions/ 없음) 도 안전 — overview 0 + 빈 배열 응답.

function spawnCodeburn(provider: Provider, period: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const proc = spawn("codeburn", ["report", "--format", "json", "--provider", provider, "--period", period], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: childEnv,
    });
    proc.stdout.on("data", (d: Buffer) => chunks.push(d));
    proc.on("close", (code: number) => {
      if (code !== 0) return reject(new Error(`codeburn exited ${code} (${provider}/${period})`));
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8").trim()));
      } catch (e) { reject(e); }
    });
    proc.on("error", reject);
    setTimeout(() => { proc.kill(); reject(new Error(`codeburn timeout (${provider}/${period})`)); }, 600_000);
  });
}

function spawnCcusageDaily(provider: Provider): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const proc = spawn("ccusage", [provider, "daily", "--json"], {
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

// provider 1개 분량 — codeburn × PERIODS + ccusage daily.
// 2026-05-31 phase1b: ccusageBlocks 송신 제거 (user_blocks 테이블 deprecated).
async function collectForProvider(provider: Provider): Promise<Record<string, unknown>> {
  const [results, ccusageDaily] = await Promise.all([
    Promise.all(PERIODS.map((p) => spawnCodeburn(provider, p))),
    spawnCcusageDaily(provider),
  ]);
  const providerReport: Record<string, unknown> = Object.fromEntries(
    PERIODS.map((p, i) => [p, results[i]])
  );
  if (ccusageDaily) providerReport.ccusageDaily = ccusageDaily;
  return providerReport;
}

interface PostOutcome { ok: boolean; status?: number; error?: string; }

async function postTo(dest: Destination, payload: object): Promise<PostOutcome> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (dest.apiKey) headers["x-api-key"] = dest.apiKey;
    const resp = await fetch(`${dest.url}/api/ingest`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    return { ok: resp.ok, status: resp.status };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function runSync(_days?: number) {
  const destinations = await loadDestinations();

  // 외부 (localhost 아님) destination 인데 API 키 없으면 의미가 없으니 사전 차단.
  const orphan = destinations.find(
    (d) => !d.apiKey && !d.url.includes("localhost") && !d.url.includes("127.0.0.1")
  );
  if (orphan) {
    console.error(`API 키가 없습니다 (destination=${orphan.name}). config.json 의 apiKey 또는 init 실행.`);
    process.exit(1);
  }

  const summary = destinations.map((d) => d.name).join(", ");
  console.log(`codeburn + ccusage 데이터 수집 중 (claude + codex)... (destinations: ${summary})`);

  // body schema (신): { claude: {...}, codex: {...} }
  let report: Record<string, unknown>;
  try {
    const [claudeReport, codexReport] = await Promise.all(
      PROVIDERS.map((p) => collectForProvider(p))
    );
    report = { claude: claudeReport, codex: codexReport };
  } catch (err) {
    console.error("codeburn 실행 실패:", (err as Error).message);
    process.exit(1);
  }

  // fan-out: 각 destination 독립 — 하나 실패해도 다른 destination 진행.
  const outcomes = await Promise.allSettled(destinations.map((d) => postTo(d, report)));

  let successCount = 0;
  outcomes.forEach((r, i) => {
    const d = destinations[i];
    if (r.status === "fulfilled" && r.value.ok) {
      console.log(`  ✅ ${d.name} (${d.url})`);
      successCount++;
    } else {
      const msg =
        r.status === "fulfilled"
          ? `HTTP ${r.value.status ?? "?"}${r.value.error ? " — " + r.value.error : ""}`
          : (r as PromiseRejectedResult).reason?.message ?? "unknown";
      console.error(`  ❌ ${d.name} (${d.url}) — ${msg}`);
    }
  });

  if (successCount === 0) {
    console.error("❌ 모든 destination 실패");
    process.exit(1);
  }
  console.log(`✅ ${successCount}/${destinations.length} destination 전송 완료`);
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
