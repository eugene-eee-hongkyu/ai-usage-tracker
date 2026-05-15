import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const STABLE_DIR = path.join(os.homedir(), ".primus-usage-tracker");
const API_KEY_FALLBACK = path.join(os.homedir(), ".primus-usage-key");
const LAUNCHD_PLIST = process.platform === "darwin"
  ? path.join(os.homedir(), "Library", "LaunchAgents", "com.primus.usage-tracker.daily.plist")
  : null;

export interface DoctorReport {
  cli_version: string;
  platform: NodeJS.Platform;
  node_path: string | null;
  node_version: string | null;
  node_major: number | null;
  node_manager:
    | "pkg_installer"
    | "homebrew"
    | "nvm"
    | "asdf"
    | "volta"
    | "fnm"
    | "system"
    | "unknown"
    | null;
  npm_root: string | null;
  npm_root_owner_uid: number | null;
  npm_root_writable: boolean | null;
  codeburn_version: string | null;
  ccusage_version: string | null;
  launchd_status: "registered" | "not_registered" | "n/a";
  api_key_status: "registered" | "not_registered";
  last_sync_iso: string | null;
  issues: string[];
}

function safeExec(cmd: string): string | null {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function detectNodeManager(nodePath: string | null): DoctorReport["node_manager"] {
  if (!nodePath) return null;
  if (nodePath.includes("/.nvm/")) return "nvm";
  if (nodePath.includes("/.asdf/")) return "asdf";
  if (nodePath.includes("/.volta/")) return "volta";
  if (nodePath.includes("/.fnm/") || process.env.FNM_DIR) return "fnm";
  if (nodePath === "/usr/local/bin/node") return "pkg_installer";
  if (nodePath.startsWith("/opt/homebrew/") || nodePath.includes("/Cellar/node/")) return "homebrew";
  return "unknown";
}

function readLastSync(): string | null {
  // submit.mjs 가 마지막 ingest 시각을 lock 파일에 남기는지 확인.
  // 없으면 stable dir mtime 으로 근사 (최후 수단).
  const lock = path.join(STABLE_DIR, "submit.lock");
  for (const candidate of [lock]) {
    if (fs.existsSync(candidate)) {
      try {
        return fs.statSync(candidate).mtime.toISOString();
      } catch { /* ignore */ }
    }
  }
  return null;
}

export function buildReport(cliVersion: string): DoctorReport {
  const nodePath = safeExec(process.platform === "win32" ? "where node" : "which node");
  const nodeVersion = safeExec("node --version");
  const nodeMajor = nodeVersion
    ? parseInt(nodeVersion.replace(/^v/, "").split(".")[0], 10) || null
    : null;
  const manager = detectNodeManager(nodePath);
  const npmRoot = safeExec("npm root -g");

  let npmRootOwner: number | null = null;
  let npmRootWritable: boolean | null = null;
  if (npmRoot && fs.existsSync(npmRoot)) {
    try {
      npmRootOwner = fs.statSync(npmRoot).uid;
    } catch { /* ignore */ }
    try {
      fs.accessSync(npmRoot, fs.constants.W_OK);
      npmRootWritable = true;
    } catch {
      npmRootWritable = false;
    }
  }

  const codeburnVer = safeExec("codeburn --version");
  const ccusageVer = safeExec("ccusage --version");

  let launchdStatus: DoctorReport["launchd_status"] = "n/a";
  if (LAUNCHD_PLIST) {
    launchdStatus = fs.existsSync(LAUNCHD_PLIST) ? "registered" : "not_registered";
  }

  const apiKeyStatus: DoctorReport["api_key_status"] = fs.existsSync(API_KEY_FALLBACK)
    ? "registered"
    : "not_registered";

  const lastSyncIso = readLastSync();

  const issues: string[] = [];
  if (npmRootWritable === false) {
    issues.push("npm 전역 디렉토리 쓰기 불가 — codeburn/ccusage 업데이트가 EACCES 로 실패합니다");
  }
  if (!codeburnVer) {
    issues.push("codeburn 미설치 — one-shot rate / cost 데이터 수집 안 됨");
  }
  if (!ccusageVer) {
    issues.push("ccusage 미설치 — 토큰/비용 데이터 수집 안 됨");
  }
  if (nodeMajor !== null && nodeMajor < 22) {
    issues.push(`Node ${nodeMajor} 감지 — codeburn 0.9.8+ 는 Node 22 이상 권장`);
  }
  if (manager === "pkg_installer") {
    issues.push("시스템 .pkg Node 사용 중 — nvm 전환 권장 (반복적 sudo 사고 위험)");
  }
  if (apiKeyStatus === "not_registered") {
    issues.push("API 키 미등록 — init 실행 필요");
  }

  return {
    cli_version: cliVersion,
    platform: process.platform,
    node_path: nodePath,
    node_version: nodeVersion,
    node_major: nodeMajor,
    node_manager: manager,
    npm_root: npmRoot,
    npm_root_owner_uid: npmRootOwner,
    npm_root_writable: npmRootWritable,
    codeburn_version: codeburnVer,
    ccusage_version: ccusageVer,
    launchd_status: launchdStatus,
    api_key_status: apiKeyStatus,
    last_sync_iso: lastSyncIso,
    issues,
  };
}

function maskHome(s: string | null): string {
  if (!s) return "—";
  const home = os.homedir();
  return s.startsWith(home) ? s.replace(home, "~") : s;
}

function printHumanReport(r: DoctorReport): void {
  const bar = "━".repeat(60);
  console.log("🔍 Usage Tracker 환경 진단");
  console.log("");
  console.log(bar);
  console.log("Node:");
  console.log(`  ${maskHome(r.node_path)} (${r.node_version ?? "—"})`);
  const managerWarn = r.node_manager === "pkg_installer" ? " ⚠️" : "";
  console.log(`  매니저: ${r.node_manager ?? "—"}${managerWarn}`);
  console.log("");
  console.log("npm 전역:");
  console.log(`  ${maskHome(r.npm_root)}`);
  if (r.npm_root_writable !== null) {
    const writeMark = r.npm_root_writable ? "✓" : "❌";
    const ownerStr = r.npm_root_owner_uid !== null ? `uid=${r.npm_root_owner_uid}` : "—";
    console.log(`  소유자: ${ownerStr}  쓰기: ${writeMark}`);
  }
  console.log("");
  console.log("설치된 패키지:");
  console.log(`  codeburn: ${r.codeburn_version ?? "미설치 ❌"}`);
  console.log(`  ccusage:  ${r.ccusage_version ?? "미설치 ❌"}`);
  console.log("");
  console.log("자동화:");
  console.log(`  launchd: ${r.launchd_status}`);
  console.log(`  API 키:  ${r.api_key_status}`);
  if (r.last_sync_iso) console.log(`  마지막 sync: ${r.last_sync_iso}`);
  console.log(bar);

  if (r.issues.length > 0) {
    console.log("");
    console.log(`발견된 문제 (${r.issues.length}):`);
    r.issues.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
    console.log("");
    console.log("복구하려면:");
    console.log("  npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair");
    console.log("");
    console.log("  → repair 가 권한 문제를 감지하면 자동 복구 prompt 를 띄웁니다.");
  } else {
    console.log("");
    console.log("✅ 발견된 문제 없음 — 환경 정상");
  }

  // 머신 파싱용 라인 (key=value). grep/awk 친화.
  console.log("");
  console.log("진단 데이터:");
  for (const [k, v] of Object.entries(r)) {
    if (k === "issues") continue;
    console.log(`  ${k}=${v === null ? "null" : v}`);
  }
}

export function runDoctor(opts: { json?: boolean; cliVersion: string }): void {
  const r = buildReport(opts.cliVersion);
  if (opts.json) {
    console.log(JSON.stringify(r, null, 2));
    return;
  }
  printHumanReport(r);
}
