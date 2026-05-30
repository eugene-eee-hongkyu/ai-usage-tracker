#!/usr/bin/env node
/**
 * SessionEnd hook entry point.
 * Installed to ~/.z21labs/usage-tracker/submit.mjs by `init` (옛: ~/.primus-usage-tracker).
 * Calls codeburn for all periods and POSTs to /api/ingest.
 */

import { spawn, execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync, appendFileSync, statSync, truncateSync, mkdirSync, accessSync, constants as fsConstants } from "fs";
import { join } from "path";
import { homedir, arch as osArch, release as osRelease } from "os";

// M6e: CLI 자체 버전. init.ts 의 CLI_VERSION 과 동기화.
// 새 릴리즈 시 두 파일 같이 bump.
// Multi-provider (2026-05-29 M): 0.3.x 부터 Claude + Codex 분리 호출.
const CLI_VERSION = "0.3.0";

// 직전 sync 실패 정보를 다음 sync 가 함께 보내기 위한 marker.
// 실패 시 catch 블록에서 write, 성공 시 다음 envInfo 수집에서 read + 삭제.
const LAST_ERROR_FILE = join(homedir(), ".z21labs", "last-error.json");

// 새 위치 우선, 옛 위치 fallback (마이그 안 된 머신 대응)
const NEW_STABLE_DIR = join(homedir(), ".z21labs", "usage-tracker");
const LEGACY_STABLE_DIR = join(homedir(), ".primus-usage-tracker");
const STABLE_DIR_EARLY = existsSync(NEW_STABLE_DIR) || !existsSync(LEGACY_STABLE_DIR)
  ? NEW_STABLE_DIR
  : LEGACY_STABLE_DIR;
const SUBMIT_LOG = join(STABLE_DIR_EARLY, "submit.log");

// 로그 파일 1MB 초과 시 truncate
try { mkdirSync(STABLE_DIR_EARLY, { recursive: true }); } catch {}
try {
  if (existsSync(SUBMIT_LOG) && statSync(SUBMIT_LOG).size > 1_000_000) {
    truncateSync(SUBMIT_LOG, 0);
  }
} catch {}

const ts = () => new Date().toISOString();
const log = (msg) => {
  const line = `[${ts()}] ${msg}\n`;
  try { appendFileSync(SUBMIT_LOG, line); } catch {}
};

// Self-detach: SessionEnd hook 부모 프로세스는 VS Code 종료 시 SIGKILL될 수 있음.
// _USAGE_TRACKER_DETACHED 없으면 자신을 detached 백그라운드로 재생성하고 즉시 종료.
if (!process.env._USAGE_TRACKER_DETACHED) {
  log("self-detach (parent will exit)");
  const submitInStable = join(STABLE_DIR_EARLY, "submit.mjs");
  const child = spawn(process.execPath, [submitInStable], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, _USAGE_TRACKER_DETACHED: "1" },
  });
  child.unref();
  process.exit(0);
}

// launchd가 Node에 TZ env를 안 넘겨주면 codeburn이 UTC로 today 계산.
// 시스템 timezone을 명시적으로 자식에 주입.
const SYSTEM_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const childEnv = { ...process.env, TZ: SYSTEM_TZ, CODEBURN_TZ: SYSTEM_TZ };

log("=== submit.mjs start ===");
log(`SYSTEM_TZ=${SYSTEM_TZ}, process.env.TZ=${process.env.TZ ?? "(unset)"}`);

const SERVER_URL = process.env.USAGE_TRACKER_URL ?? "https://aiusage.z21labs.world";
const KEYTAR_SERVICE = "z21labs-usage-tracker";
const LEGACY_KEYTAR_SERVICE = "primus-usage-tracker";
const KEYTAR_ACCOUNT = "api-key";
const PERIODS = ["today", "week", "month", "30days", "all"];

const STABLE_DIR = STABLE_DIR_EARLY;
const LOCK_FILE = join(STABLE_DIR, "submit.lock");
const LOCK_TTL = 90_000; // 90s — covers codeburn 60s timeout + margin

async function loadApiKey() {
  if (process.env.USAGE_TRACKER_API_KEY) return process.env.USAGE_TRACKER_API_KEY;
  try {
    const { default: keytar } = await import("keytar");
    const key = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    if (key) return key;
    const legacyKey = await keytar.getPassword(LEGACY_KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    if (legacyKey) return legacyKey;
  } catch {
    // keytar unavailable
  }
  const newFile = join(homedir(), ".z21labs", "usage-key");
  if (existsSync(newFile)) return readFileSync(newFile, "utf8").trim();
  const legacyFile = join(homedir(), ".primus-usage-key");
  if (existsSync(legacyFile)) return readFileSync(legacyFile, "utf8").trim();
  return null;
}

function acquireLock() {
  if (existsSync(LOCK_FILE)) {
    const lockAge = Date.now() - parseInt(readFileSync(LOCK_FILE, "utf8") || "0");
    if (lockAge < LOCK_TTL) return false; // another instance is running
  }
  writeFileSync(LOCK_FILE, Date.now().toString());
  return true;
}

function releaseLock() {
  try { unlinkSync(LOCK_FILE); } catch {}
}

// Multi-provider (2026-05-29): provider 인자로 Claude / Codex 분리 호출.
// codeburn 은 `--provider <name>` 옵션, ccusage 는 sub-command (`ccusage claude daily` / `codex daily`).
// 빈 환경 (e.g. ~/.codex/sessions/ 없음) 도 안전 — overview 0 + 빈 배열 응답.

function spawnCodeburn(provider, period) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    // shell: true — Claude Code hook 환경에서 PATH가 제한될 수 있어 shell 경유
    const proc = spawn("codeburn", ["report", "--format", "json", "--provider", provider, "--period", period], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: childEnv,
    });
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`codeburn exited ${code} (${provider}/${period})`));
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8").trim()));
      } catch (e) {
        reject(new Error(`codeburn JSON parse error (${provider}/${period}): ${e.message}`));
      }
    });
    proc.on("error", reject);
    setTimeout(() => { proc.kill(); reject(new Error(`codeburn timeout (${provider}/${period})`)); }, 600_000);
  });
}

// ccusage 결과 + 실패 사유. provider 별로 분리 추적. main()에서 ingest payload의
// ccusageMissing 플래그는 양쪽 모두 missing 일 때만 true.
const ccusageStatus = { claude: "unknown", codex: "unknown" };

function spawnCcusageDaily(provider) {
  return new Promise((resolve) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    const proc = spawn("ccusage", [provider, "daily", "--json"], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: childEnv,
    });
    proc.stdout.on("data", (d) => stdoutChunks.push(d));
    proc.stderr.on("data", (d) => stderrChunks.push(d));
    proc.on("close", (code) => {
      if (code !== 0) {
        // shell: true → ENOENT는 exit 127 + stderr "command not found"로 나타남
        const stderr = Buffer.concat(stderrChunks).toString("utf8");
        if (code === 127 || /not found|not recognized|cannot find/i.test(stderr)) {
          ccusageStatus[provider] = "missing";
          log(`ccusage NOT INSTALLED (${provider}) — token graphs will be empty. Run: npm install -g ccusage`);
        } else {
          ccusageStatus[provider] = "error";
          log(`ccusage ${provider} exited ${code} — ${stderr.trim().slice(0, 200)}`);
        }
        return resolve(null);
      }
      try {
        const data = JSON.parse(Buffer.concat(stdoutChunks).toString("utf8").trim());
        ccusageStatus[provider] = "ok";
        resolve(data);
      } catch (e) {
        ccusageStatus[provider] = "parse";
        log(`ccusage ${provider} JSON parse error: ${e?.message ?? e}`);
        resolve(null);
      }
    });
    proc.on("error", (err) => {
      if (err && err.code === "ENOENT") {
        ccusageStatus[provider] = "missing";
        log(`ccusage NOT INSTALLED (${provider}) — token graphs will be empty. Run: npm install -g ccusage`);
      } else {
        ccusageStatus[provider] = "error";
        log(`ccusage ${provider} spawn error: ${err?.message ?? err}`);
      }
      resolve(null);
    });
    setTimeout(() => {
      proc.kill();
      ccusageStatus[provider] = "timeout";
      log(`ccusage ${provider} timeout (600s)`);
      resolve(null);
    }, 600_000);
  });
}

// ccusage blocks — wall-clock 분 단위 분석용 5h 빌링 블록 데이터.
// daily가 성공하면 blocks도 보통 성공함. 실패해도 daily 진단 메시지가 이미
// 있으니 blocks 별도 로깅은 최소화 (성공/실패만 한 줄).
// 사용자 환경 진단 정보. ingest body 에 envInfo 로 포함되어 user_snapshots.rawJson
// 에 저장됨. /setup-status 페이지가 이걸 읽어 "내 환경" 카드 렌더링.
// 비민감 정보만 — Node 버전 / npm root 권한 / codeburn·ccusage 버전 / 매니저 종류.
function collectEnvInfo() {
  const safeExec = (cmd) => {
    try {
      return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"], encoding: "utf8", timeout: 3000 }).trim();
    } catch { return null; }
  };
  const detectManager = (p) => {
    if (!p) return null;
    if (p.includes("/.nvm/")) return "nvm";
    if (p.includes("/.asdf/")) return "asdf";
    if (p.includes("/.volta/")) return "volta";
    if (p.includes("/.fnm/") || process.env.FNM_DIR) return "fnm";
    if (p === "/usr/local/bin/node") return "pkg_installer";
    if (p.startsWith("/opt/homebrew/") || p.includes("/Cellar/node/")) return "homebrew";
    return "unknown";
  };
  const nodePath = safeExec(process.platform === "win32" ? "where node" : "which node");
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.replace(/^v/, "").split(".")[0], 10) || null;
  const npmRoot = safeExec("npm root -g");
  let npmRootWritable = null;
  if (npmRoot) {
    try { accessSync(npmRoot, fsConstants.W_OK); npmRootWritable = true; }
    catch { npmRootWritable = false; }
  }

  // M6e (1순위): OS release / arch / CLI 자체 버전 / Claude Code 버전.
  const claudeVersion = safeExec("claude --version") ?? safeExec("claude-code --version");

  // M6e (2순위): SessionEnd hook 등록 여부 — ~/.claude/settings.json 파싱.
  let hookEnabled = null;
  try {
    const settingsPath = join(homedir(), ".claude", "settings.json");
    if (existsSync(settingsPath)) {
      const cfg = JSON.parse(readFileSync(settingsPath, "utf8"));
      const hooks = cfg?.hooks;
      // SessionEnd hook 이 등록되어 있는지 — key 이름 spec 변할 수 있어 keys 검사.
      hookEnabled = !!(hooks && typeof hooks === "object" && (
        hooks.SessionEnd != null || hooks.sessionEnd != null || hooks.session_end != null
      ));
    } else {
      hookEnabled = false;
    }
  } catch { hookEnabled = null; }

  // M6e (2순위): 직전 sync 실패 marker 가 있으면 같이 보냄. 1회용 — 즉시 삭제.
  let lastError = null;
  try {
    if (existsSync(LAST_ERROR_FILE)) {
      lastError = JSON.parse(readFileSync(LAST_ERROR_FILE, "utf8"));
      unlinkSync(LAST_ERROR_FILE);
    }
  } catch { /* ignore */ }

  // M6e (2순위): 설치 경로 추정. STABLE_DIR 의 marker / npx flag / dmg env.
  // 정확 식별 어려워 best-effort 라벨.
  let installMethod = "unknown";
  if (process.env.Z21_DMG === "1" || process.env.ELECTRON_RUN_AS_NODE) installMethod = "dmg";
  else if (process.env.npm_lifecycle_event || process.env.npm_command) installMethod = "npx";
  else if (existsSync(join(homedir(), ".z21labs", "usage-tracker", "submit.mjs"))) installMethod = "install.sh";

  return {
    // 기존
    platform: process.platform,
    nodeVersion,
    nodeMajor,
    nodeManager: detectManager(nodePath),
    npmRoot,
    npmRootWritable,
    codeburnVersion: safeExec("codeburn --version"),
    ccusageVersion: safeExec("ccusage --version"),
    // M6e 추가
    osRelease: osRelease(),
    osArch: osArch(),
    cliVersion: CLI_VERSION,
    claudeCodeVersion: claudeVersion,
    hookEnabled,
    installMethod,
    lastError,
    collectedAt: new Date().toISOString(),
  };
}

function spawnCcusageBlocks(provider) {
  return new Promise((resolve) => {
    const stdoutChunks = [];
    const proc = spawn("ccusage", [provider, "blocks", "--json"], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: childEnv,
    });
    proc.stdout.on("data", (d) => stdoutChunks.push(d));
    proc.on("close", (code) => {
      if (code !== 0) return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(stdoutChunks).toString("utf8").trim()));
      } catch { resolve(null); }
    });
    proc.on("error", () => resolve(null));
    setTimeout(() => { proc.kill(); resolve(null); }, 600_000);
  });
}

// provider 1개 분량 — codeburn × PERIODS + ccusage daily + ccusage blocks.
// 빈 환경 (~/.codex/sessions/ 없는 사용자) 도 안전 — overview 0 + 빈 배열 응답이라 그대로 박아 보냄.
async function collectForProvider(provider) {
  const settled = await Promise.allSettled([
    ...PERIODS.map((p) => spawnCodeburn(provider, p)),
    spawnCcusageDaily(provider),
    spawnCcusageBlocks(provider),
  ]);
  const cbResults = settled.slice(0, PERIODS.length);
  const ccResult = settled[PERIODS.length];
  const blocksResult = settled[PERIODS.length + 1];

  const okPeriods = [];
  const failPeriods = [];
  const providerReport = {};
  for (let i = 0; i < PERIODS.length; i++) {
    const r = cbResults[i];
    if (r.status === "fulfilled" && r.value) {
      providerReport[PERIODS[i]] = r.value;
      okPeriods.push(PERIODS[i]);
    } else {
      failPeriods.push(`${provider}/${PERIODS[i]}:${r.status === "rejected" ? r.reason?.message ?? r.reason : "empty"}`);
    }
  }
  const ccusageDaily = ccResult.status === "fulfilled" ? ccResult.value : null;
  if (ccusageDaily) providerReport.ccusageDaily = ccusageDaily;
  const ccusageBlocks = blocksResult.status === "fulfilled" ? blocksResult.value : null;
  if (ccusageBlocks) {
    providerReport.ccusageBlocks = ccusageBlocks;
    const cnt = Array.isArray(ccusageBlocks?.blocks) ? ccusageBlocks.blocks.length : 0;
    log(`${provider}: ccusage blocks ok — ${cnt} blocks`);
  }
  return { providerReport, okPeriods, failPeriods };
}

async function main() {
  if (!acquireLock()) {
    log("lock skip — another instance running");
    process.exit(0);
  }
  log("lock acquired");

  try {
    const apiKey = await loadApiKey();
    if (!apiKey) {
      log("ERROR: API key not found");
      return;
    }
    log("API key loaded");

    let report = {};
    try {
      const PROVIDERS = ["claude", "codex"];
      log(`spawning ${PROVIDERS.length} providers × (codeburn x${PERIODS.length} + ccusage daily + ccusage blocks)...`);
      const providerResults = await Promise.all(PROVIDERS.map((p) => collectForProvider(p)));
      const claudeResult = providerResults[0];
      const codexResult = providerResults[1];

      const allOk = [
        ...claudeResult.okPeriods.map((p) => `claude/${p}`),
        ...codexResult.okPeriods.map((p) => `codex/${p}`),
      ];
      const allFail = [...claudeResult.failPeriods, ...codexResult.failPeriods];

      // 양쪽 다 빈 결과면 진짜 실패 — 그 외엔 (Codex 빈 환경 정상) 정상 진행.
      const hasAnyClaude = claudeResult.okPeriods.length > 0 || claudeResult.providerReport.ccusageDaily;
      const hasAnyCodex = codexResult.okPeriods.length > 0 || codexResult.providerReport.ccusageDaily;
      if (!hasAnyClaude && !hasAnyCodex) {
        log(`ERROR: all spawns failed — ${allFail.join(", ")}`);
        return;
      }
      log(`spawn done — ok=[${allOk.join(",")}]${allFail.length ? ` fail=[${allFail.join(",")}]` : ""}, ccusage claude=${ccusageStatus.claude} codex=${ccusageStatus.codex}`);

      // body schema (신): { claude: { today, week, month, 30days, all, ccusageDaily, ccusageBlocks },
      //                    codex: { ... }, envInfo, ccusageMissing? }
      // 서버 run-ingest 가 양쪽 분기 처리. 옛 형태 (provider key 없음) 도 backward compat 으로 claude 처리.
      //
      // 2026-05-30 (oreo 회귀 대응, C): codeburn PERIODS 5 개 중 1+ 실패한 provider 는
      // body 에서 통째로 제외 (key 자체 생략). 서버는 그 provider 의 raw_json 을 안 받아
      // 기존 풀데이터 유지 (다음 풀 ingest 까지 partial overwrite 차단). 양쪽 모두
      // partial fail 면 ingest 자체 skip (위 hasAnyClaude/hasAnyCodex 가드 외 추가 가드).
      report = {};
      if (claudeResult.failPeriods.length === 0) {
        report.claude = claudeResult.providerReport;
      } else {
        log(`SKIP claude submit — partial codeburn fail: ${claudeResult.failPeriods.join(", ")}`);
      }
      if (codexResult.failPeriods.length === 0) {
        report.codex = codexResult.providerReport;
      } else {
        log(`SKIP codex submit — partial codeburn fail: ${codexResult.failPeriods.join(", ")}`);
      }
      if (!report.claude && !report.codex) {
        log(`ERROR: both providers partial fail — nothing to submit`);
        return;
      }
      // 양쪽 모두 missing 일 때만 ccusageMissing 플래그 — 한쪽만 missing 은 정상 (Codex 안 쓰는 사용자).
      if (ccusageStatus.claude === "missing" && ccusageStatus.codex === "missing") {
        report.ccusageMissing = true;
      }

      try {
        report.envInfo = collectEnvInfo();
        log(`envInfo: node=${report.envInfo.nodeVersion} mgr=${report.envInfo.nodeManager} npm_writable=${report.envInfo.npmRootWritable}`);
      } catch (e) {
        log(`WARN: envInfo collect failed — ${e?.message ?? e}`);
      }
    } catch (e) {
      log(`ERROR: spawn block — ${e?.message ?? e}`);
      return;
    }

    try {
      log(`POST ${SERVER_URL}/api/ingest ...`);
      const resp = await fetch(`${SERVER_URL}/api/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify(report),
      });
      log(`ingest response: ${resp.status} ${resp.statusText}`);
      if (!resp.ok) {
        process.stderr.write(`[usage-tracker] ingest failed: ${resp.status}\n`);
        // M6e: 실패 marker — 다음 sync 의 envInfo 에 함께 전달되어 web 에 표시.
        try {
          writeFileSync(
            LAST_ERROR_FILE,
            JSON.stringify({ kind: "http", status: resp.status, statusText: resp.statusText, at: new Date().toISOString() }),
          );
        } catch { /* ignore */ }
      }
    } catch (e) {
      log(`ERROR: ingest network — ${e?.message ?? e}`);
      // Network error — silent + lastError marker
      try {
        writeFileSync(
          LAST_ERROR_FILE,
          JSON.stringify({ kind: "network", message: String(e?.message ?? e), at: new Date().toISOString() }),
        );
      } catch { /* ignore */ }
    }
  } finally {
    releaseLock();
    log("=== submit.mjs end ===");
  }

  process.exit(0);
}

main();
