// migrate.ts — primus → z21labs 마이그레이션 (run: 2026-05-17-primus-to-z21labs-rename, stage 3)
//
// 옛 위치를 새 위치로 mv + keytar 서비스명 transfer + launchd plist 옛 unload → 새 load.
// 멱등 — 이미 새 위치에 있으면 noop. 옛 위치 없으면 noop.
//
// 호출 진입점:
//   - `usage-tracker repair --migrate`
//   - `usage-tracker migrate`
//   - init 명령 entry 에서 자동 호출 (다음 stage)

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";

// === 새 (z21labs) ===
const NEW_DATA_ROOT = path.join(os.homedir(), ".z21labs");
const NEW_STABLE_DIR = path.join(NEW_DATA_ROOT, "usage-tracker");
const NEW_API_KEY_FILE = path.join(NEW_DATA_ROOT, "usage-key");
const NEW_KEYTAR_SERVICE = "z21labs-usage-tracker";
const NEW_LAUNCHD_LABEL = "world.z21labs.ai-usage-tracker.sync";
const NEW_LAUNCHD_PLIST =
  process.platform === "darwin"
    ? path.join(os.homedir(), "Library", "LaunchAgents", `${NEW_LAUNCHD_LABEL}.plist`)
    : null;

// === 옛 (primus) ===
const LEGACY_STABLE_DIR = path.join(os.homedir(), ".primus-usage-tracker");
const LEGACY_API_KEY_FILE = path.join(os.homedir(), ".primus-usage-key");
const LEGACY_KEYTAR_SERVICE = "primus-usage-tracker";
const LEGACY_KEYTAR_ACCOUNT = "api-key";
const LEGACY_LAUNCHD_LABEL = "com.primus.usage-tracker.daily";
const LEGACY_LAUNCHD_PLIST =
  process.platform === "darwin"
    ? path.join(os.homedir(), "Library", "LaunchAgents", `${LEGACY_LAUNCHD_LABEL}.plist`)
    : null;

export interface MigrateReport {
  dataDir: "migrated" | "already-new" | "no-legacy" | "skipped-both-exist";
  apiKeyFile: "migrated" | "already-new" | "no-legacy" | "skipped-both-exist";
  keytar: "migrated" | "already-new" | "no-legacy" | "unavailable" | "error";
  launchd: "migrated" | "already-new" | "no-legacy" | "n/a";
  errors: string[];
  notes: string[];
}

function safeMv(src: string, dst: string): "moved" | "no-src" | "both-exist" {
  if (!fs.existsSync(src)) return "no-src";
  if (fs.existsSync(dst)) return "both-exist";
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.renameSync(src, dst);
  return "moved";
}

function migrateDataDir(report: MigrateReport, dryRun: boolean): void {
  if (!fs.existsSync(LEGACY_STABLE_DIR)) {
    report.dataDir = fs.existsSync(NEW_STABLE_DIR) ? "already-new" : "no-legacy";
    return;
  }
  if (fs.existsSync(NEW_STABLE_DIR)) {
    report.dataDir = "skipped-both-exist";
    report.notes.push(
      `옛 ${LEGACY_STABLE_DIR} 와 새 ${NEW_STABLE_DIR} 모두 존재. 데이터 손실 우려로 자동 mv 건너뜀. 수동 정리 필요.`
    );
    return;
  }
  if (dryRun) {
    report.dataDir = "migrated";
    report.notes.push(`[dry-run] mv ${LEGACY_STABLE_DIR} → ${NEW_STABLE_DIR}`);
    return;
  }
  try {
    fs.mkdirSync(NEW_DATA_ROOT, { recursive: true });
    fs.renameSync(LEGACY_STABLE_DIR, NEW_STABLE_DIR);
    report.dataDir = "migrated";
  } catch (e) {
    report.dataDir = "skipped-both-exist";
    report.errors.push(`데이터 디렉토리 mv 실패: ${(e as Error).message}`);
  }
}

function migrateApiKeyFile(report: MigrateReport, dryRun: boolean): void {
  if (!fs.existsSync(LEGACY_API_KEY_FILE)) {
    report.apiKeyFile = fs.existsSync(NEW_API_KEY_FILE) ? "already-new" : "no-legacy";
    return;
  }
  if (fs.existsSync(NEW_API_KEY_FILE)) {
    report.apiKeyFile = "skipped-both-exist";
    report.notes.push(
      `옛 ${LEGACY_API_KEY_FILE} 와 새 ${NEW_API_KEY_FILE} 모두 존재. 수동 정리 필요.`
    );
    return;
  }
  if (dryRun) {
    report.apiKeyFile = "migrated";
    report.notes.push(`[dry-run] mv ${LEGACY_API_KEY_FILE} → ${NEW_API_KEY_FILE}`);
    return;
  }
  try {
    const result = safeMv(LEGACY_API_KEY_FILE, NEW_API_KEY_FILE);
    if (result === "moved") {
      report.apiKeyFile = "migrated";
      // 새 위치 권한 0600 보장
      fs.chmodSync(NEW_API_KEY_FILE, 0o600);
    }
  } catch (e) {
    report.errors.push(`API key 파일 mv 실패: ${(e as Error).message}`);
  }
}

async function migrateKeytar(report: MigrateReport, dryRun: boolean): Promise<void> {
  // ESM/CommonJS 호환 unwrap — init.ts 의 getKeytar() 와 동일 패턴.
  // keytar 7.x 는 CommonJS 라 `await import("keytar")` 가 namespace wrapper 반환.
  // setPassword 등 메서드는 .default 에 있을 수도 있고 namespace 자체에 있을 수도.
  let keytar: {
    getPassword: (s: string, a: string) => Promise<string | null>;
    setPassword: (s: string, a: string, p: string) => Promise<void>;
    deletePassword: (s: string, a: string) => Promise<boolean>;
  } | null = null;
  try {
    const kt = await import("keytar");
    const resolved = (kt as { default?: unknown }).default ?? kt;
    keytar = resolved as typeof keytar;
    if (typeof keytar?.setPassword !== "function") {
      report.keytar = "unavailable";
      report.notes.push("keytar import 했지만 setPassword 없음 — native module 호환 이슈로 keytar 단계 skip.");
      return;
    }
  } catch {
    report.keytar = "unavailable";
    return;
  }
  try {
    const legacyKey = await keytar.getPassword(LEGACY_KEYTAR_SERVICE, LEGACY_KEYTAR_ACCOUNT);
    if (!legacyKey) {
      const newKey = await keytar.getPassword(NEW_KEYTAR_SERVICE, LEGACY_KEYTAR_ACCOUNT);
      report.keytar = newKey ? "already-new" : "no-legacy";
      return;
    }
    const existingNew = await keytar.getPassword(NEW_KEYTAR_SERVICE, LEGACY_KEYTAR_ACCOUNT);
    if (existingNew && existingNew !== legacyKey) {
      report.notes.push(
        `keytar 옛 서비스(${LEGACY_KEYTAR_SERVICE})와 새 서비스(${NEW_KEYTAR_SERVICE}) 키 값이 다름. 수동 검토 필요.`
      );
      report.keytar = "error";
      return;
    }
    if (dryRun) {
      report.keytar = "migrated";
      report.notes.push(`[dry-run] keytar ${LEGACY_KEYTAR_SERVICE} → ${NEW_KEYTAR_SERVICE} transfer`);
      return;
    }
    await keytar.setPassword(NEW_KEYTAR_SERVICE, LEGACY_KEYTAR_ACCOUNT, legacyKey);
    await keytar.deletePassword(LEGACY_KEYTAR_SERVICE, LEGACY_KEYTAR_ACCOUNT);
    report.keytar = "migrated";
  } catch (e) {
    report.keytar = "error";
    report.errors.push(`keytar transfer 실패: ${(e as Error).message}`);
  }
}

function migrateLaunchd(report: MigrateReport, dryRun: boolean): void {
  if (process.platform !== "darwin" || !LEGACY_LAUNCHD_PLIST || !NEW_LAUNCHD_PLIST) {
    report.launchd = "n/a";
    return;
  }
  const legacyExists = fs.existsSync(LEGACY_LAUNCHD_PLIST);
  const newExists = fs.existsSync(NEW_LAUNCHD_PLIST);
  if (!legacyExists) {
    report.launchd = newExists ? "already-new" : "no-legacy";
    return;
  }
  if (dryRun) {
    report.launchd = "migrated";
    report.notes.push(
      `[dry-run] launchctl unload ${LEGACY_LAUNCHD_LABEL} + rm ${LEGACY_LAUNCHD_PLIST}` +
        (newExists ? "" : ` (새 plist 는 init/launcher 가 다음 실행 시 생성)`)
    );
    return;
  }
  try {
    // launchctl unload — 옛 daemon 죽이기
    try {
      execSync(`launchctl unload "${LEGACY_LAUNCHD_PLIST}"`, {
        stdio: ["ignore", "ignore", "ignore"],
      });
    } catch {
      // 이미 unload 됐을 수도 — 무시
    }
    // plist 파일 제거
    fs.unlinkSync(LEGACY_LAUNCHD_PLIST);
    report.launchd = "migrated";
    if (!newExists) {
      report.notes.push(
        `옛 plist 제거. 새 plist (${NEW_LAUNCHD_LABEL}) 는 다음 init/launcher 실행 시 자동 생성.`
      );
    }
  } catch (e) {
    report.errors.push(`launchd 마이그레이션 실패: ${(e as Error).message}`);
  }
}

export async function runMigrate(opts: { dryRun?: boolean } = {}): Promise<MigrateReport> {
  const dryRun = !!opts.dryRun;
  const report: MigrateReport = {
    dataDir: "no-legacy",
    apiKeyFile: "no-legacy",
    keytar: "no-legacy",
    launchd: "no-legacy",
    errors: [],
    notes: [],
  };

  migrateDataDir(report, dryRun);
  migrateApiKeyFile(report, dryRun);
  await migrateKeytar(report, dryRun);
  migrateLaunchd(report, dryRun);

  return report;
}

export function printMigrateReport(r: MigrateReport, dryRun: boolean): void {
  // 모두 already-new / no-legacy / n/a 면 사용자에게 의미 없음 — silent.
  // 실제 마이그가 일어났거나 에러가 있을 때만 출력.
  const interestingValues = new Set(["migrated", "error"]);
  const hasInteresting =
    interestingValues.has(r.dataDir) ||
    interestingValues.has(r.apiKeyFile) ||
    interestingValues.has(r.keytar) ||
    interestingValues.has(r.launchd) ||
    r.errors.length > 0 ||
    dryRun;
  if (!hasInteresting) {
    return; // silent — 옛 primus 경로가 없거나 이미 새 경로
  }

  const bar = "━".repeat(60);
  console.log(`🔄 옛 데이터 마이그레이션${dryRun ? " (dry-run)" : ""}`);
  console.log(bar);
  if (interestingValues.has(r.dataDir)) console.log(`  데이터 디렉토리: ${r.dataDir}`);
  if (interestingValues.has(r.apiKeyFile)) console.log(`  API 키 파일:    ${r.apiKeyFile}`);
  if (interestingValues.has(r.keytar)) console.log(`  keytar:        ${r.keytar}`);
  if (interestingValues.has(r.launchd)) console.log(`  launchd plist:  ${r.launchd}`);
  console.log(bar);
  if (r.notes.length > 0) {
    console.log("");
    console.log("메모:");
    r.notes.forEach((n, i) => console.log(`  ${i + 1}. ${n}`));
  }
  if (r.errors.length > 0) {
    console.log("");
    console.log(`⚠ 에러 ${r.errors.length}건:`);
    r.errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  }
  if (dryRun) {
    console.log("");
    console.log("실행하려면 --dry-run 빼고 다시 실행하세요.");
  }
}
