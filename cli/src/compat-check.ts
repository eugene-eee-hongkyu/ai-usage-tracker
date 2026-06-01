// compat-check — ccusage 신/구 버전의 raw daily 출력을 비교용으로 서버에 업로드.
//
// 흐름:
//   1. 사용자 prod ccusage (글로벌 설치, 절대 안 건드림) 로 claude/codex daily 호출 → old raw
//   2. npx -y ccusage@<target> 으로 새 버전 임시 다운로드 후 같은 명령 → new raw
//   3. 두 raw + meta (OS, version, runAt) 를 POST /api/ccusage-compat 로 전송
//   4. 사용자 prod 환경 그대로 (글로벌 install/uninstall 0건)
//
// 인증: keytar 의 API key 재사용 (사용자가 이미 init 된 상태 전제).
// 송신지: destinations[0] (보통 prod). LOCAL_MODE 는 의미 없음 → 거부.
//
// 분량 안전망: ccusage daily 67일 ~60KB. 4 raw 합쳐도 < 500KB.
// 민감 정보: ccusage daily 에는 path/cwd/branch 없음 (date/tokens/cost/modelsUsed 뿐) — 확인 완료.

import { spawn } from "child_process";
import * as os from "os";
import { loadDestinations } from "./destinations.js";
import { CLI_VERSION } from "./init.js";

const TIMEOUT_MS = 120_000;

type Provider = "claude" | "codex";

function run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { env: { ...process.env, TZ: Intl.DateTimeFormat().resolvedOptions().timeZone } });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (b: Buffer) => { stdout += b.toString(); });
    proc.stderr.on("data", (b: Buffer) => { stderr += b.toString(); });
    const t = setTimeout(() => { proc.kill("SIGKILL"); resolve({ stdout, stderr: stderr + "\n[timeout]", code: null }); }, TIMEOUT_MS);
    proc.on("close", (code) => { clearTimeout(t); resolve({ stdout, stderr, code }); });
    proc.on("error", (e) => { clearTimeout(t); resolve({ stdout, stderr: stderr + "\n" + e.message, code: null }); });
  });
}

async function captureCcusage(binary: string[], provider: Provider): Promise<{ ok: boolean; raw: unknown; error?: string }> {
  const r = await run(binary[0], [...binary.slice(1), provider, "daily", "--json"]);
  if (r.code !== 0) return { ok: false, raw: null, error: `exit ${r.code}: ${r.stderr.trim().slice(0, 500)}` };
  try {
    return { ok: true, raw: JSON.parse(r.stdout) };
  } catch (e) {
    return { ok: false, raw: null, error: `JSON parse: ${(e as Error).message}. stdout head: ${r.stdout.slice(0, 200)}` };
  }
}

function rowsCount(raw: unknown): number {
  const r = raw as { daily?: unknown[] } | null;
  return Array.isArray(r?.daily) ? r!.daily!.length : 0;
}

export async function runCompatCheck(opts: { target?: string } = {}): Promise<void> {
  const target = opts.target;
  if (!target || !/^\d+\.\d+\.\d+/.test(target)) {
    console.error("❌ 비교할 ccusage 버전을 명시해야 합니다.");
    console.error("");
    console.error("  예: npx -y github:eugene-eee-hongkyu/ai-usage-tracker compat-check --target 20.0.6");
    console.error("");
    console.error("  버전 목록: https://github.com/ryoppippi/ccusage/releases");
    process.exit(2);
  }

  console.log("");
  console.log(`ccusage compat-check — 현재 prod 버전 vs ccusage@${target} raw 출력 비교`);
  console.log("");

  // destination 확인 — 인증 + URL 확보
  const dests = await loadDestinations();
  const dest = dests.find((d) => d.apiKey) ?? dests[0];
  if (!dest?.apiKey) {
    console.error("❌ API key 없음. 먼저 `npx github:eugene-eee-hongkyu/ai-usage-tracker init` 로 가입/인증 후 다시 실행.");
    process.exit(2);
  }
  console.log(`송신지: ${dest.url}`);
  console.log("");

  // 옛 버전 (사용자 prod ccusage)
  console.log("[1/4] 현재 버전 (prod) 확인 중...");
  const oldVer = await run("ccusage", ["--version"]);
  if (oldVer.code !== 0) {
    console.error(`❌ ccusage 실행 실패: ${oldVer.stderr.trim()}`);
    console.error("   먼저 'npm i -g ccusage' 로 설치하고 다시 시도.");
    process.exit(3);
  }
  const oldVersion = oldVer.stdout.trim();
  console.log(`    현재 버전: ${oldVersion}`);

  console.log("[2/4] 현재 버전으로 claude/codex daily 캡처...");
  const oldClaude = await captureCcusage(["ccusage"], "claude");
  const oldCodex = await captureCcusage(["ccusage"], "codex");
  console.log(`    claude: ${oldClaude.ok ? `${rowsCount(oldClaude.raw)} rows` : `❌ ${oldClaude.error}`}`);
  console.log(`    codex:  ${oldCodex.ok ? `${rowsCount(oldCodex.raw)} rows` : `❌ ${oldCodex.error}`}`);

  // 비교 대상 버전 (npx 임시) — 글로벌 설치 안 함
  console.log(`[3/4] 비교 대상 버전 (${target}) 으로 동일 캡처 — npx 첫 호출 시 10-30초 다운로드 발생...`);
  const newClaude = await captureCcusage(["npx", "-y", `ccusage@${target}`], "claude");
  const newCodex = await captureCcusage(["npx", "-y", `ccusage@${target}`], "codex");
  console.log(`    claude: ${newClaude.ok ? `${rowsCount(newClaude.raw)} rows` : `❌ ${newClaude.error}`}`);
  console.log(`    codex:  ${newCodex.ok ? `${rowsCount(newCodex.raw)} rows` : `❌ ${newCodex.error}`}`);

  // 서버 전송
  console.log("[4/4] 서버 전송...");
  const body = {
    cliVersion: CLI_VERSION,
    runAt: new Date().toISOString(),
    os: `${os.platform()}-${os.arch()}-${os.release()}`,
    oldVersion,
    newVersion: target,
    claude: { old: oldClaude.raw, new: newClaude.raw, oldError: oldClaude.error, newError: newClaude.error },
    codex: { old: oldCodex.raw, new: newCodex.raw, oldError: oldCodex.error, newError: newCodex.error },
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
    process.exit(4);
  }
  console.log(`✓ 전송 완료 — 서버 응답: ${text.slice(0, 200)}`);
  console.log("");
  console.log("끝. 사용자 prod ccusage 환경은 그대로입니다 (글로벌 설치 미변경).");
}
