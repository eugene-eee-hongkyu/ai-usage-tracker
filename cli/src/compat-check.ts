// compat-check — ccusage + codeburn 신/구 버전 raw 출력을 비교용으로 서버에 업로드.
//
// 흐름 (사용자 prod 글로벌 설치는 절대 안 건드림):
//   1. 옛 ccusage (글로벌) — claude/codex daily 캡처
//   2. npx -y ccusage@<ccusageTarget> — 같은 두 캡처
//   3. 옛 codeburn (글로벌) — claude/codex × 5 period (today/week/month/30days/all)
//   4. npx -y codeburn@<codeburnTarget> — 같은 10 캡처
//   5. 모두 묶어 POST /api/ccusage-compat
//
// 호출 수: 2 + 2 + 10 + 10 = 24. 본인 머신 추정 1-3분. npx 첫 다운로드 캐시 됨.
//
// payload: 본인 추정 1.6MB. 서버 안전망 5MB (Vercel 4.5MB body limit 안).
//
// 인증: keytar API key (사용자가 이미 init 된 상태 전제).
// LOCAL_MODE 거부 (의미 없음).
// 민감 정보: ccusage 는 path/cwd 없음 확인 완료. codeburn 도 sync 그대로 보내는 raw 라 안전.

import { spawn } from "child_process";
import * as os from "os";
import { loadDestinations } from "./destinations.js";
import { CLI_VERSION } from "./init.js";

const TIMEOUT_MS = 600_000;  // codeburn 의 큰 history parse 가 길어질 수 있음
const PERIODS = ["today", "week", "month", "30days", "all"] as const;
type Period = typeof PERIODS[number];
type Provider = "claude" | "codex";

interface Capture {
  ok: boolean;
  raw: unknown;
  error?: string;
}

function run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    // Windows 의 ccusage / codeburn / npx 는 .cmd / .ps1 shim. spawn 의 default
    // (shell=false) 면 PATHEXT 미적용 → exact filename 만 찾아 ENOENT. shell 모드로
    // 위임해서 PATHEXT 가 자동 적용되게. macOS/Linux 는 shell=false 그대로 유지 (영진님
    // Windows 보고 2026-06-01). 인자는 모두 단순 토큰 (semver / 'claude' 등) 이라
    // shell quoting 위험 없음.
    const useShell = process.platform === "win32";
    const proc = spawn(cmd, args, { shell: useShell, env: { ...process.env, TZ: Intl.DateTimeFormat().resolvedOptions().timeZone } });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (b: Buffer) => { stdout += b.toString(); });
    proc.stderr.on("data", (b: Buffer) => { stderr += b.toString(); });
    const t = setTimeout(() => { proc.kill("SIGKILL"); resolve({ stdout, stderr: stderr + "\n[timeout]", code: null }); }, TIMEOUT_MS);
    proc.on("close", (code) => { clearTimeout(t); resolve({ stdout, stderr, code }); });
    proc.on("error", (e) => { clearTimeout(t); resolve({ stdout, stderr: stderr + "\n" + e.message, code: null }); });
  });
}

function parseJson(stdout: string, label: string): Capture {
  try {
    return { ok: true, raw: JSON.parse(stdout) };
  } catch (e) {
    return { ok: false, raw: null, error: `JSON parse (${label}): ${(e as Error).message}. head: ${stdout.slice(0, 200)}` };
  }
}

async function captureCcusage(binary: string[], provider: Provider): Promise<Capture> {
  const r = await run(binary[0], [...binary.slice(1), provider, "daily", "--json"]);
  if (r.code !== 0) return { ok: false, raw: null, error: `exit ${r.code}: ${r.stderr.trim().slice(0, 500)}` };
  return parseJson(r.stdout, `ccusage ${provider}`);
}

async function captureCodeburn(binary: string[], provider: Provider, period: Period): Promise<Capture> {
  const r = await run(binary[0], [...binary.slice(1), "report", "--format", "json", "--provider", provider, "--period", period]);
  if (r.code !== 0) return { ok: false, raw: null, error: `exit ${r.code}: ${r.stderr.trim().slice(0, 500)}` };
  return parseJson(r.stdout, `codeburn ${provider}/${period}`);
}

function ccusageRowCount(raw: unknown): number {
  const r = raw as { daily?: unknown[] } | null;
  return Array.isArray(r?.daily) ? r!.daily!.length : 0;
}

function codeburnSummary(raw: unknown): string {
  const r = raw as { daily?: unknown[]; overview?: { totalCost?: number; totalCalls?: number } } | null;
  const daily = Array.isArray(r?.daily) ? r!.daily!.length : 0;
  const cost = r?.overview?.totalCost ?? 0;
  const calls = r?.overview?.totalCalls ?? 0;
  return `daily=${daily} cost=$${Number(cost).toFixed(2)} calls=${calls}`;
}

async function captureAllCcusage(binary: string[], label: string) {
  console.log(`    ccusage (${label}) — claude/codex daily...`);
  const claude = await captureCcusage(binary, "claude");
  const codex = await captureCcusage(binary, "codex");
  console.log(`      claude: ${claude.ok ? `${ccusageRowCount(claude.raw)} rows` : `❌ ${claude.error}`}`);
  console.log(`      codex:  ${codex.ok ? `${ccusageRowCount(codex.raw)} rows` : `❌ ${codex.error}`}`);
  return { claude, codex };
}

async function captureAllCodeburn(binary: string[], label: string) {
  console.log(`    codeburn (${label}) — claude/codex × ${PERIODS.length} period...`);
  const out: Record<Provider, Record<Period, Capture>> = {
    claude: {} as Record<Period, Capture>,
    codex: {} as Record<Period, Capture>,
  };
  for (const provider of ["claude", "codex"] as const) {
    for (const period of PERIODS) {
      out[provider][period] = await captureCodeburn(binary, provider, period);
    }
    const ok = PERIODS.filter((p) => out[provider][p].ok);
    const fail = PERIODS.filter((p) => !out[provider][p].ok);
    const sampleOk = ok[0] ? `${ok[0]}: ${codeburnSummary(out[provider][ok[0]].raw)}` : "all failed";
    console.log(`      ${provider}: ${ok.length}/${PERIODS.length} ok — ${sampleOk}${fail.length ? ` (fail: ${fail.join(",")})` : ""}`);
  }
  return out;
}

function semverOk(v: string | undefined): boolean {
  return typeof v === "string" && /^\d+\.\d+\.\d+/.test(v);
}

export async function runCompatCheck(opts: { ccusageTarget?: string; codeburnTarget?: string } = {}): Promise<void> {
  const ccusageTarget = opts.ccusageTarget;
  const codeburnTarget = opts.codeburnTarget;
  if (!semverOk(ccusageTarget) || !semverOk(codeburnTarget)) {
    console.error("❌ 비교할 ccusage / codeburn 버전 둘 다 명시해야 합니다.");
    console.error("");
    console.error("  예:");
    console.error("    npx -y github:eugene-eee-hongkyu/ai-usage-tracker compat-check \\");
    console.error("      --ccusage-target 20.0.6 --codeburn-target 0.9.11");
    console.error("");
    console.error("  버전 목록:");
    console.error("    ccusage  https://github.com/ryoppippi/ccusage/releases");
    console.error("    codeburn https://github.com/getagentseal/codeburn/releases");
    process.exit(2);
  }

  console.log("");
  console.log(`ccusage + codeburn compat-check`);
  console.log(`  ccusage  prod vs @${ccusageTarget}`);
  console.log(`  codeburn prod vs @${codeburnTarget}`);
  console.log("");

  // destination 확인
  const dests = await loadDestinations();
  const dest = dests.find((d) => d.apiKey) ?? dests[0];
  if (!dest?.apiKey) {
    console.error("❌ API key 없음. 먼저 `npx github:eugene-eee-hongkyu/ai-usage-tracker init` 후 다시 실행.");
    process.exit(3);
  }
  console.log(`송신지: ${dest.url}`);
  console.log("");

  // [1/6] 옛 ccusage 버전 확인
  console.log("[1/6] 옛 ccusage 버전 확인...");
  const oldCcusageVer = await run("ccusage", ["--version"]);
  if (oldCcusageVer.code !== 0) {
    console.error(`❌ ccusage 미설치 또는 실행 실패: ${oldCcusageVer.stderr.trim()}`);
    console.error("   먼저 'npm i -g ccusage' 로 설치하고 다시 시도.");
    process.exit(4);
  }
  const oldCcusageVersion = oldCcusageVer.stdout.trim();
  console.log(`    prod ccusage: ${oldCcusageVersion}`);

  // [2/6] 옛 codeburn 버전 확인
  console.log("[2/6] 옛 codeburn 버전 확인...");
  const oldCodeburnVer = await run("codeburn", ["--version"]);
  if (oldCodeburnVer.code !== 0) {
    console.error(`❌ codeburn 미설치 또는 실행 실패: ${oldCodeburnVer.stderr.trim()}`);
    console.error("   먼저 'npm i -g codeburn' 로 설치하고 다시 시도.");
    process.exit(5);
  }
  const oldCodeburnVersion = oldCodeburnVer.stdout.trim().split("\n")[0];
  console.log(`    prod codeburn: ${oldCodeburnVersion}`);

  // [3/6] 옛 ccusage 캡처
  console.log("[3/6] 옛 ccusage 캡처...");
  const ccusageOld = await captureAllCcusage(["ccusage"], "prod");

  // [4/6] 옛 codeburn 캡처 (10 호출)
  console.log("[4/6] 옛 codeburn 캡처 — 5 period × 2 provider...");
  const codeburnOld = await captureAllCodeburn(["codeburn"], "prod");

  // [5/6] 새 버전 캡처 (npx 임시) — ccusage + codeburn
  console.log(`[5/6] 새 버전 캡처 — npx 첫 호출 시 다운로드 (각 도구 10-30초)...`);
  const ccusageNew = await captureAllCcusage(["npx", "-y", `ccusage@${ccusageTarget}`], `@${ccusageTarget}`);
  const codeburnNew = await captureAllCodeburn(["npx", "-y", `codeburn@${codeburnTarget}`], `@${codeburnTarget}`);

  // [6/6] 서버 전송
  console.log("[6/6] 서버 전송...");
  const body = {
    cliVersion: CLI_VERSION,
    runAt: new Date().toISOString(),
    os: `${os.platform()}-${os.arch()}-${os.release()}`,
    ccusage: {
      oldVersion: oldCcusageVersion,
      newVersion: ccusageTarget,
      claude: { old: ccusageOld.claude.raw, new: ccusageNew.claude.raw, oldError: ccusageOld.claude.error, newError: ccusageNew.claude.error },
      codex:  { old: ccusageOld.codex.raw,  new: ccusageNew.codex.raw,  oldError: ccusageOld.codex.error,  newError: ccusageNew.codex.error  },
    },
    codeburn: {
      oldVersion: oldCodeburnVersion,
      newVersion: codeburnTarget,
      claude: Object.fromEntries(PERIODS.map((p) => [p, {
        old: codeburnOld.claude[p].raw, new: codeburnNew.claude[p].raw,
        oldError: codeburnOld.claude[p].error, newError: codeburnNew.claude[p].error,
      }])),
      codex: Object.fromEntries(PERIODS.map((p) => [p, {
        old: codeburnOld.codex[p].raw, new: codeburnNew.codex[p].raw,
        oldError: codeburnOld.codex[p].error, newError: codeburnNew.codex[p].error,
      }])),
    },
  };
  const url = `${dest.url}/api/ccusage-compat`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": dest.apiKey },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  if (!resp.ok) {
    console.error(`❌ 서버 응답 ${resp.status}: ${text.slice(0, 500)}`);
    process.exit(6);
  }
  console.log(`✓ 전송 완료 — 서버 응답: ${text.slice(0, 200)}`);
  console.log("");
  console.log("끝. 사용자 prod ccusage / codeburn 환경은 그대로입니다 (글로벌 설치 미변경).");
}
