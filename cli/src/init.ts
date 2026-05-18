import { execSync, spawn, spawnSync } from "child_process";
import * as fs from "fs";
import * as http from "http";
import * as os from "os";
import * as path from "path";
import * as readline from "readline";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SERVER_URL = process.env.USAGE_TRACKER_URL ?? "https://aiusage.z21labs.world";
export const CLI_VERSION = "0.2.0";

// === 새 (z21labs) ===
const KEYTAR_SERVICE = "z21labs-usage-tracker";
const KEYTAR_ACCOUNT = "api-key";
const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
const STABLE_DIR = path.join(os.homedir(), ".z21labs", "usage-tracker");
const STABLE_SUBMIT = path.join(STABLE_DIR, "submit.mjs");
const STABLE_HISTORICAL = path.join(STABLE_DIR, "historical.mjs");
const API_KEY_FALLBACK = path.join(os.homedir(), ".z21labs", "usage-key");
const CLI_PORT = 9988;

const LAUNCHD_LABEL = "world.z21labs.ai-usage-tracker.sync";
const LAUNCHD_PLIST = process.platform === "darwin"
  ? path.join(os.homedir(), "Library", "LaunchAgents", `${LAUNCHD_LABEL}.plist`)
  : null;

// === 옛 (primus) — read fallback 전용 ===
const LEGACY_KEYTAR_SERVICE = "primus-usage-tracker";
const LEGACY_STABLE_DIR = path.join(os.homedir(), ".primus-usage-tracker");
const LEGACY_API_KEY_FALLBACK = path.join(os.homedir(), ".primus-usage-key");
const LEGACY_LAUNCHD_LABEL = "com.primus.usage-tracker.daily";
const LEGACY_LAUNCHD_PLIST = process.platform === "darwin"
  ? path.join(os.homedir(), "Library", "LaunchAgents", `${LEGACY_LAUNCHD_LABEL}.plist`)
  : null;

// Refuse to install/repair if (a) we're running as root or (b) any of our
// files already exist with a different owner. Both cases produce a broken
// install where launchd later runs as the user but can't write to its log /
// lock files (last exit code 78 EX_CONFIG, daily.log never created).
function preflightOwnership(): void {
  if (process.platform === "win32" || !process.getuid) return;

  const myUid = process.getuid();
  const bar = "═".repeat(60);

  // (a) Refuse root execution outright.
  if (myUid === 0) {
    console.error("\n" + bar);
    console.error("❌ root 권한으로 실행되었습니다");
    console.error("   설치/수리는 일반 사용자 권한으로만 실행하세요.");
    console.error("   sudo 없이 다시 시도하세요.");
    console.error(bar + "\n");
    process.exit(1);
  }

  // (b) Refuse if existing files belong to another user (typically root from
  // a prior elevated install attempt). 옛 경로도 같이 체크 (마이그 안 된 환경 대응).
  const targets: Array<{ path: string; label: string }> = [
    { path: STABLE_DIR, label: STABLE_DIR },
    { path: API_KEY_FALLBACK, label: API_KEY_FALLBACK },
    { path: LEGACY_STABLE_DIR, label: LEGACY_STABLE_DIR },
    { path: LEGACY_API_KEY_FALLBACK, label: LEGACY_API_KEY_FALLBACK },
  ];
  if (LAUNCHD_PLIST) targets.push({ path: LAUNCHD_PLIST, label: LAUNCHD_PLIST });
  if (LEGACY_LAUNCHD_PLIST) targets.push({ path: LEGACY_LAUNCHD_PLIST, label: LEGACY_LAUNCHD_PLIST });

  const wrong: Array<{ path: string; label: string; uid: number; isDir: boolean }> = [];
  for (const t of targets) {
    if (!fs.existsSync(t.path)) continue;
    const stat = fs.statSync(t.path);
    if (stat.uid !== myUid) wrong.push({ ...t, uid: stat.uid, isDir: stat.isDirectory() });
  }
  if (wrong.length === 0) return;

  console.error("\n" + bar);
  console.error("❌ 다른 사용자 소유의 파일이 있습니다 (보통 root)");
  console.error("   원인: 과거 설치가 elevated 권한으로 실행됨.");
  console.error("   현 상태에선 launchd 가 daily.log / submit.lock 을 못 만들어");
  console.error("   매 실행이 EX_CONFIG (78) 으로 떨어집니다.");
  console.error("");
  for (const w of wrong) console.error(`   uid=${w.uid}  ${w.label}`);
  console.error("");
  console.error("   다음 명령으로 소유권 복구 후 다시 실행하세요:");
  for (const w of wrong) {
    const flag = w.isDir ? "-R " : "";
    console.error(`     sudo chown ${flag}"$(whoami):staff" "${w.path}"`);
  }
  console.error(bar + "\n");
  process.exit(1);
}

// /dev/tty 에서 한 줄 읽기. `curl|bash`·`npx` 환경에서 stdin 이 pipe 여도
// user 터미널의 키 입력을 직접 받음. TTY 없으면 (CI 등) false 반환.
// 응답 없이 Enter → 빈 문자열 → default Y (호출자가 처리).
function promptYn(question: string, defaultYes = true): boolean {
  let ttyFd: number;
  try {
    ttyFd = fs.openSync("/dev/tty", "r");
  } catch {
    return false; // TTY 없음 → 자동 진행 안 함
  }
  process.stdout.write(question);
  const chunks: number[] = [];
  const single = Buffer.alloc(1);
  try {
    // 라인 단위 read. \n 만나면 종료.
    while (true) {
      const n = fs.readSync(ttyFd, single, 0, 1, null);
      if (n === 0) break;
      const c = single[0];
      if (c === 0x0a) break;          // LF
      if (c === 0x0d) continue;        // CR (Windows-style line ending)
      chunks.push(c);
    }
  } finally {
    fs.closeSync(ttyFd);
  }
  const ans = Buffer.from(chunks).toString("utf8").trim();
  if (!ans) return defaultYes; // Enter → 호출자가 지정한 default
  const lower = ans.toLowerCase();
  return lower === "y" || lower === "yes";
}

// install.sh 자동 실행 helper. nvm + Node 22 설치 + ~/.zshrc 갱신 + npx init 까지
// 한 번에. preflightGlobalPackages 와 preflightNodeVersion 둘 다 같은 흐름 호출.
function runInstallShAndExit(): never {
  const bar = "═".repeat(60);
  console.log("");
  console.log("📦 install.sh 자동 실행 중 (nvm + Node 22 + 자동 init)...");
  console.log("");
  try {
    execSync(`curl -fsSL ${SERVER_URL}/install.sh | bash`, { stdio: "inherit" });
  } catch {
    console.error("");
    console.error("❌ 자동 복구 실패. 수동 절차:");
    console.error(`   curl -fsSL ${SERVER_URL}/install.sh | bash`);
    console.error(`   npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair`);
    process.exit(1);
  }
  console.log("");
  console.log(bar);
  console.log("✅ 환경 설정 완료");
  console.log("");
  console.log("   현재 셸은 아직 옛 PATH 를 보고 있습니다. 새 Node 적용:");
  console.log("     1. 터미널 새 창 (⌘N) 열고 repair 재실행 — 권장");
  console.log("     2. 또는 현재 셸에서: exec $SHELL -l");
  console.log("        그 다음: npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair");
  console.log(bar);
  console.log("");
  process.exit(0);
}

// Node 22 미만이면 codeburn (engines >=22) / ccusage (engines >=22.0.0) 가
// EBADENGINE 경고만 띄우고 설치는 되지만 런타임 깨질 수 있다. 사용자 머신에서
// launchd 가 매 2시간마다 silent 실패하는 만성 문제의 흔한 원인.
// 흐름: [자동 복구 (default)] → 거부 시 [강행] → 거부 시 [중단]
function preflightNodeVersion(): void {
  const major = parseInt((process.versions.node ?? "0").split(".")[0], 10);
  if (!Number.isFinite(major) || major >= 22) return;

  const bar = "═".repeat(60);

  // 무한 루프 가드: install.sh 가 nvm install 22 한 후 npx init 을 호출할 때
  // AIUSAGE_FROM_INSTALL_SH=1 박는다. 그런데도 여기 도달했다는 건 install.sh
  // 의 nvm use 가 같은 process 의 PATH 에 안 묻은 케이스 — 자동 복구 prompt
  // 재호출 시 무한 루프. 안전장치로 즉시 명확한 에러 출력 후 종료.
  if (process.env.AIUSAGE_FROM_INSTALL_SH === "1") {
    console.error("\n" + bar);
    console.error(`❌ install.sh 의 nvm install 22 후에도 Node ${process.versions.node} 로 실행됨`);
    console.error("");
    console.error("   원인: nvm use 22 가 npx 의 PATH 에 적용되지 않았음.");
    console.error("   수동 복구:");
    console.error("     1. 터미널 새 창 (⌘N) 열기");
    console.error("     2. node -v  ← v22.x.x 확인");
    console.error("     3. npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair");
    console.error(bar + "\n");
    process.exit(1);
  }
  console.error("\n" + bar);
  console.error(`⚠️  Node ${process.versions.node} 감지 — codeburn / ccusage 는 Node 22 이상 필요`);
  console.error("");
  console.error("   이대로 install 하면:");
  console.error("     - npm EBADENGINE 경고 (install 자체는 됨)");
  console.error("     - codeburn / ccusage 런타임 오작동 위험");
  console.error("     - launchd 가 매 2시간마다 silent 실패 가능");
  console.error("");
  console.error("   자동 복구 가능:");
  console.error("     - nvm 설치 (~/.nvm/ 안에만, 시스템 Node 그대로 보존)");
  console.error("     - Node 22 설치 + 기본값으로 설정");
  console.error("     - ~/.zshrc 자동 백업 후 nvm 라인 추가");
  console.error("");
  console.error("   롤백 방법:");
  console.error("     nvm use system          # 셸 1개만 옛 Node 로");
  console.error(`     nvm alias default ${major}    # 기본을 다시 옛 버전으로`);
  console.error(bar);

  const autoFix = promptYn("\n   지금 자동 복구할까요? [Y/n]: ", true);
  if (autoFix) {
    runInstallShAndExit();
  }

  const forceProceed = promptYn(`\n   자동 복구 건너뜀. 그래도 Node ${major} 로 강행할까요? [y/N]: `, false);
  if (!forceProceed) {
    console.error("\n   중단됨. 수동 복구:");
    console.error("     nvm install 22 && nvm use 22 && nvm alias default 22");
    console.error("     npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair");
    process.exit(1);
  }
  console.warn(`\n   ⚠️  Node ${major} 로 강행. 깨질 위험 인지함.\n`);
}

// npm 전역 prefix 가 root 소유 등으로 쓰기 불가일 때 사전 차단 + 자동 복구 권유.
// 이전 sudo 설치 흔적이 남아있거나 macOS 시스템 Node 사용 시 codeburn/ccusage
// @latest 업그레이드가 EACCES (npm 의 rename 원자성 패턴) 로 실패하는 케이스.
// 그냥 진행하면 cli 의 fallback 메시지("기존 버전으로 계속 진행") 에 묻혀
// 사용자는 "복구 완료" 만 보고 outdated 버전을 계속 쓰게 됨. 사전 차단 + Y/n.
function preflightGlobalPackages(): void {
  if (process.platform === "win32" || !process.getuid) return;

  let npmRoot: string;
  try {
    npmRoot = execSync("npm root -g", { stdio: ["ignore", "pipe", "ignore"] })
      .toString().trim();
  } catch {
    return; // npm 자체가 없거나 호출 실패면 다른 단계에서 잡힘
  }
  if (!npmRoot || !fs.existsSync(npmRoot)) return;

  try {
    fs.accessSync(npmRoot, fs.constants.W_OK);
    return; // 쓰기 가능 — 정상
  } catch {
    // 쓰기 불가 — 안내 + 자동 복구 prompt
  }

  const myUid = process.getuid();
  const parentStat = fs.statSync(npmRoot);
  const installed: string[] = [];
  for (const p of ["codeburn", "ccusage"]) {
    if (fs.existsSync(path.join(npmRoot, p))) installed.push(p);
  }

  const bar = "═".repeat(60);
  console.error("\n" + bar);
  console.error("❌ npm 전역 디렉토리에 쓰기 권한이 없습니다");
  console.error(`   ${npmRoot}`);
  console.error(`   소유자 uid=${parentStat.uid}, 현재 uid=${myUid}`);
  console.error("");
  console.error("   원인: 시스템 Node 사용 중이거나 과거 sudo 로 설치됨.");
  console.error("   이 상태에선 codeburn/ccusage @latest 업그레이드가 EACCES");
  console.error("   (npm rename 단계) 로 실패합니다.");
  if (installed.length > 0) {
    console.error("");
    console.error(`   현재 막혀있는 패키지: ${installed.join(", ")}`);
  }
  console.error("");
  console.error("   자동 복구 가능:");
  console.error("     1. nvm 설치 (~/.nvm/ 안에만, 시스템 Node 그대로 보존)");
  console.error("     2. Node 22 설치 + 기본값으로 설정");
  console.error("     3. ~/.zshrc 자동 백업 후 nvm 라인 추가");
  console.error("");
  console.error("   변경되는 것:");
  console.error("     - ~/.zshrc 끝에 nvm 활성화 라인 추가 (백업본 자동 생성)");
  console.error("     - 기본 Node 가 ~/.nvm/.../v22.x.x 로 변경");
  console.error("     - 글로벌 CLI 들이 새 Node 환경에서 안 보일 수 있음 (목록 자동 백업)");
  console.error("");
  console.error("   롤백 방법:");
  console.error("     nvm use system            # 셸 1개만 옛 Node 로");
  console.error("     nvm alias default 20      # 기본을 다시 옛 버전으로");
  console.error("     백업: ~/.z21labs/usage-tracker/zshrc.bak-{timestamp}");
  console.error(bar);

  const accept = promptYn("\n   지금 자동 복구를 진행할까요? [Y/n]: ");

  if (accept) {
    runInstallShAndExit();
  }

  console.error("");
  console.error("   자동 복구를 건너뜁니다. 수동 절차:");
  console.error("");
  console.error("     # 1. root 소유로 박혀있는 옛 글로벌 패키지 제거");
  console.error("     sudo npm uninstall -g codeburn ccusage");
  console.error("");
  console.error("     # 2. nvm + Node 22 로 재설치");
  console.error(`     curl -fsSL ${SERVER_URL}/install.sh | bash`);
  console.error("");
  console.error("     # 3. repair 재실행");
  console.error("     npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair");
  console.error(bar + "\n");
  process.exit(1);
}

async function getKeytar() {
  try {
    const kt = await import("keytar");
    return (kt as { default?: unknown }).default ?? kt;
  } catch {
    return null;
  }
}

async function saveApiKey(apiKey: string) {
  const keytar = await getKeytar() as { setPassword: (s: string, a: string, p: string) => Promise<void> } | null;
  if (keytar) {
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, apiKey);
  }
  // submit.mjs는 standalone 실행 시 keytar node_modules가 없으므로 항상 파일에도 저장
  fs.mkdirSync(path.dirname(API_KEY_FALLBACK), { recursive: true });
  fs.writeFileSync(API_KEY_FALLBACK, apiKey, { mode: 0o600 });
}

export async function loadApiKey(): Promise<string | null> {
  const keytar = await getKeytar() as { getPassword: (s: string, a: string) => Promise<string | null> } | null;
  if (keytar) {
    const key = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    if (key) return key;
    // 옛 keytar service fallback (마이그레이션 안 된 머신 대응)
    const legacyKey = await keytar.getPassword(LEGACY_KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    if (legacyKey) return legacyKey;
  }
  if (fs.existsSync(API_KEY_FALLBACK)) {
    return fs.readFileSync(API_KEY_FALLBACK, "utf8").trim();
  }
  // 옛 파일 fallback
  if (fs.existsSync(LEGACY_API_KEY_FALLBACK)) {
    return fs.readFileSync(LEGACY_API_KEY_FALLBACK, "utf8").trim();
  }
  return null;
}

export async function deleteApiKey() {
  const keytar = await getKeytar() as { deletePassword: (s: string, a: string) => Promise<boolean> } | null;
  if (keytar) {
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    // 옛 keytar 잔재도 같이 정리
    try { await keytar.deletePassword(LEGACY_KEYTAR_SERVICE, KEYTAR_ACCOUNT); } catch { /* ignore */ }
  }
  if (fs.existsSync(API_KEY_FALLBACK)) fs.unlinkSync(API_KEY_FALLBACK);
  if (fs.existsSync(LEGACY_API_KEY_FALLBACK)) fs.unlinkSync(LEGACY_API_KEY_FALLBACK);
}

function openBrowser(url: string) {
  try {
    const platform = process.platform;
    if (platform === "darwin") execSync(`open "${url}"`);
    else if (platform === "win32") execSync(`start "" "${url}"`);
    else execSync(`xdg-open "${url}"`);
  } catch {
    // ignore
  }
}

function getApiKeyViaLocalServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${CLI_PORT}`);
      const apiKey = url.searchParams.get("apiKey");

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (apiKey) {
        res.end(
          "<html><body style='font-family:sans-serif;padding:2em'>" +
          "<h2>&#x2705; Authentication Complete</h2><p>You can close this window.</p></body></html>"
        );
        server.close();
        resolve(apiKey);
      } else {
        res.end("<html><body><h2>Waiting...</h2></body></html>");
      }
    });

    server.listen(CLI_PORT, "127.0.0.1", () => {
      const authUrl = `${SERVER_URL}/api/cli-auth?port=${CLI_PORT}`;
      console.log("\n브라우저에서 GitHub 계정으로 로그인하세요...");
      console.log(`URL: ${authUrl}\n`);
      openBrowser(authUrl);
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error(`포트 ${CLI_PORT}가 이미 사용 중입니다. 잠시 후 다시 시도하세요.`));
      } else {
        reject(err);
      }
    });

    setTimeout(() => {
      server.close();
      reject(new Error("인증 시간 초과 (5분)"));
    }, 5 * 60 * 1000);
  });
}

// plist 의 ProgramArguments 에 박을 node 경로 선택.
// nvm 내부 (~/.nvm/versions/node/vX/bin/node) 는 사용자가 node 버전 바꾸거나 nvm
// 끄면 깨지므로, 시스템 영구 경로 우선. 없으면 process.execPath fallback.
//   priority: homebrew (arm/intel) → system → npm prefix → process.execPath
function findStableNodePath(): string {
  const candidates = [
    "/opt/homebrew/bin/node",  // Apple Silicon Homebrew
    "/usr/local/bin/node",     // Intel Homebrew / 시스템 install
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // npm prefix bin 도 후보 — codeburn/ccusage 가 이미 설치된 prefix 라 안정적
  try {
    const npmPrefix = execSync("npm config get prefix", { encoding: "utf8" }).trim();
    const npmNode = path.join(npmPrefix, "bin", "node");
    if (fs.existsSync(npmNode)) return npmNode;
  } catch { /* ignore */ }
  // 마지막: 지금 실행 중인 node (nvm 일 수 있음 — 깨질 위험 있지만 fallback)
  return process.execPath;
}

function registerLaunchd(submitPath: string): void {
  const label = LAUNCHD_LABEL;
  const plistDir = path.join(os.homedir(), "Library", "LaunchAgents");
  const plistPath = path.join(plistDir, `${label}.plist`);

  // 옛 plist 잔재가 있으면 unload + 제거 (멱등)
  if (LEGACY_LAUNCHD_PLIST && fs.existsSync(LEGACY_LAUNCHD_PLIST)) {
    try {
      execSync(`launchctl unload "${LEGACY_LAUNCHD_PLIST}"`, { stdio: "ignore" });
    } catch { /* 이미 unload 됐을 수도 */ }
    try { fs.unlinkSync(LEGACY_LAUNCHD_PLIST); } catch { /* ignore */ }
  }

  const nodePath = findStableNodePath();
  if (nodePath !== process.execPath) {
    console.log("📍 plist node 경로: " + nodePath + " (nvm 의존성 회피)");
  }

  const envPath = process.env.PATH ?? "/usr/bin:/bin:/usr/sbin:/sbin";
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${submitPath}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${envPath}</string>
  </dict>
  <key>StartInterval</key>
  <integer>7200</integer>
  <key>StandardOutPath</key>
  <string>${path.join(STABLE_DIR, "daily.log")}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(STABLE_DIR, "daily-error.log")}</string>
</dict>
</plist>`;

  const uid = (() => {
    try {
      return execSync("id -u", { encoding: "utf8" }).trim();
    } catch (e) {
      console.log("⚠️  uid 조회 실패 — launchd 등록 건너뜀:", (e as Error).message);
      return null;
    }
  })();
  if (!uid) return;
  const gui = `gui/${uid}`;

  try {
    fs.mkdirSync(plistDir, { recursive: true });
  } catch (e) {
    console.log("⚠️  LaunchAgents 디렉토리 생성 실패:", (e as Error).message);
    return;
  }

  // 멱등 등록: 이미 로드된 service 가 있으면 명시적 bootout 후 새 plist 로 bootstrap.
  // macOS Tahoe (26.x) 부터 중복 bootstrap 시 `5: Input/output error` 응답 — 사용자
  // 머신에서 실재 확인. bootout stderr 도 캡쳐해서 진짜 실패 시 노출.
  const alreadyLoaded = spawnSync("launchctl", ["print", `${gui}/${label}`], { stdio: "ignore" }).status === 0;
  if (alreadyLoaded) {
    const out = spawnSync("launchctl", ["bootout", `${gui}/${label}`], { encoding: "utf8" });
    if (out.status !== 0) {
      const errMsg = ((out.stderr ?? "") + (out.stdout ?? "")).trim();
      console.log("⚠️  기존 service bootout 실패 (exit " + out.status + ")");
      if (errMsg) console.log("    stderr:", errMsg);
      console.log("    수동 처리: launchctl bootout " + gui + "/" + label);
      return;
    }
  }

  try {
    fs.writeFileSync(plistPath, plist);
  } catch (e) {
    console.log(`⚠️  plist 파일 작성 실패 (${plistPath}):`, (e as Error).message);
    return;
  }

  const bootstrap = spawnSync("launchctl", ["bootstrap", gui, plistPath], { encoding: "utf8" });
  const bootstrapStderr = ((bootstrap.stderr ?? "") + (bootstrap.stdout ?? "")).trim();
  if (bootstrap.status !== 0) {
    console.log("⚠️  launchctl bootstrap 실패 (exit " + bootstrap.status + ")");
    if (bootstrapStderr) console.log("    stderr:", bootstrapStderr);
    console.log("    plist 파일은 생성됨:", plistPath);
    console.log("    수동 시도: launchctl bootstrap " + gui + " \"" + plistPath + "\"");
    return;
  }

  // bootstrap 종료코드 0 이어도 실제 load 검증.
  const verify = spawnSync("launchctl", ["print", `${gui}/${label}`], { encoding: "utf8" });
  if (verify.status !== 0) {
    console.log("⚠️  bootstrap 종료코드 0 인데 service 가 launchd 에 안 보임");
    console.log("    launchctl print stderr:", ((verify.stderr ?? "") + (verify.stdout ?? "")).trim());
    console.log("    plist 파일은 생성됨:", plistPath);
    console.log("    수동 검증: launchctl list | grep " + label);
    return;
  }

  // 첫 실행 즉시 트리거 — daily.log 한 줄 박혀 사용자가 등록 정상을 즉시 확인 가능.
  // -p 는 path 도메인 이름으로 service 지정. exit code 무시 (service 가 곧장 실행 안 돼도
  // 다음 StartInterval 에서 도므로 치명적 아님).
  spawnSync("launchctl", ["kickstart", "-p", `${gui}/${label}`], { stdio: "ignore" });

  console.log("✅ 자동 동기화 등록 완료 (2시간마다, launchd. sleep 시 wake 즉시 catch-up)");
}

function registerWindowsTask(submitPath: string): void {
  const taskName = "Z21labsUsageTracker";
  const wrapperPath = path.join(STABLE_DIR, "daily-sync.cmd");
  const xmlPath = path.join(STABLE_DIR, "task.xml");

  fs.writeFileSync(wrapperPath, `@echo off\r\n"${process.execPath}" "${submitPath}"\r\n`);

  // XML 등록: StartWhenAvailable=true → 꺼져 있다가 켜지면 즉시 실행
  const xml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <CalendarTrigger><StartBoundary>2000-01-01T00:00:00</StartBoundary><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger>
    <CalendarTrigger><StartBoundary>2000-01-01T06:00:00</StartBoundary><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger>
    <CalendarTrigger><StartBoundary>2000-01-01T12:00:00</StartBoundary><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger>
    <CalendarTrigger><StartBoundary>2000-01-01T18:00:00</StartBoundary><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger>
  </Triggers>
  <Settings>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT2H</ExecutionTimeLimit>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
  </Settings>
  <Actions>
    <Exec><Command>${wrapperPath}</Command></Exec>
  </Actions>
</Task>`;

  // Task Scheduler XML은 UTF-16LE로 저장해야 인식됨
  fs.writeFileSync(xmlPath, Buffer.from("﻿" + xml, "utf16le"));

  const result = spawnSync("schtasks", [
    "/Create", "/TN", taskName, "/XML", xmlPath, "/F",
  ], { stdio: "ignore" });

  if (result.status === 0) {
    console.log("✅ 자동 동기화 등록 완료 (0/6/12/18시, Task Scheduler)");
  } else {
    console.log("⚠️  일간 자동 동기화 등록 실패 (선택 사항, 수동으로 등록 가능)");
  }
}

function registerDailySchedule(submitPath: string): void {
  if (process.platform === "darwin") {
    registerLaunchd(submitPath);
  } else if (process.platform === "win32") {
    registerWindowsTask(submitPath);
  }
}

function removeHook() {
  if (!fs.existsSync(CLAUDE_SETTINGS_PATH)) return;
  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS_PATH, "utf8"));
  } catch {
    return;
  }

  type HookEntry = { matcher: string; hooks: Array<{ type: string; command: string }> };
  const hooks = (settings.hooks as Record<string, HookEntry[]>) ?? {};
  let changed = false;

  for (const event of ["SessionStart", "SessionEnd"] as const) {
    const existing: HookEntry[] = (hooks[event] as HookEntry[]) ?? [];
    const cleaned = existing.filter(
      (group) => !group.hooks?.some((h) => h.command.includes("submit.mjs"))
    );
    if (cleaned.length !== existing.length) {
      hooks[event] = cleaned;
      changed = true;
    }
  }

  if (changed) {
    settings.hooks = hooks;
    fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
    console.log("✅ 기존 세션 hook 제거 완료");
  }
}

function runBackfill(apiKey: string) {
  const syncScript = path.join(__dirname, "sync.mjs");
  const syncTs = path.join(__dirname, "sync.js");
  const scriptPath = fs.existsSync(syncScript) ? syncScript : fs.existsSync(syncTs) ? syncTs : null;
  if (!scriptPath) return;

  const child = spawn(process.execPath, [scriptPath], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      USAGE_TRACKER_API_KEY: apiKey,
      USAGE_TRACKER_URL: SERVER_URL,
      USAGE_TRACKER_DAYS: "90",
    },
  });
  child.unref();
  console.log("📦 과거 데이터 백그라운드 수집 시작 (최대 90일)");
}

function runImmediateSync(apiKey: string) {
  if (!fs.existsSync(STABLE_SUBMIT)) return;
  const child = spawn(process.execPath, [STABLE_SUBMIT], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      USAGE_TRACKER_API_KEY: apiKey,
      USAGE_TRACKER_URL: SERVER_URL,
      _USAGE_TRACKER_DETACHED: "1",
    },
  });
  child.unref();
  console.log("📤 현재 데이터 즉시 수집 시작 (백그라운드)");
}

// codeburn `--from`/`--to` 로 last 8 weeks + last 12 months 의 historical
// snapshot 을 backfill. 서버 측 onConflictDoNothing → 매 실행마다 비어있던
// 슬롯만 채움 (idempotent). background spawn — 사용자 터미널 차단 안 함.
function runHistoricalBackfill(apiKey: string) {
  if (!fs.existsSync(STABLE_HISTORICAL)) return;
  const child = spawn(process.execPath, [STABLE_HISTORICAL], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      USAGE_TRACKER_API_KEY: apiKey,
      USAGE_TRACKER_URL: SERVER_URL,
    },
  });
  child.unref();
  console.log("📚 과거 8주 + 12개월 historical backfill 시작 (백그라운드)");
}

function checkCodeburn(): boolean {
  try {
    const cmd = process.platform === "win32" ? "where codeburn" : "which codeburn";
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// codeburn @latest 강제 설치/업그레이드.
// 이미 설치돼 있어도 매번 latest 로 교체 — repair/init 시점에 항상 최신.
// (#184 같은 fix 가 사용자 PC 에 자동 반영되도록.)
async function installCodeburn(): Promise<boolean> {
  console.log("📦 codeburn 0.9.7 (핀 버전) 설치 중...");
  try {
    execSync("npm install -g codeburn@0.9.7", { stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}

function checkCcusage(): boolean {
  try {
    const cmd = process.platform === "win32" ? "where ccusage" : "which ccusage";
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function installCcusage(): Promise<boolean> {
  console.log("📦 ccusage 19.0.2 (핀 버전) 설치 중...");
  try {
    execSync("npm install -g ccusage@19.0.2", { stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}

// repair/init 마다 항상 @latest 강제. 이미 설치돼 있어도 재설치 → 항상 최신
// (codeburn fix 가 사용자 PC 에 자동 반영). 업그레이드 실패해도 기존 설치 있으면 진행.
async function ensureCcusage(): Promise<boolean> {
  const hadBefore = checkCcusage();
  console.log(hadBefore
    ? "📦 ccusage 19.0.2 (핀 버전) 강제 설치 시도..."
    : "⚠️  ccusage 미설치 — 최신 설치 시도..."
  );
  const installed = await installCcusage();
  if (installed && checkCcusage()) {
    console.log("✅ ccusage 19.0.2 확인됨\n");
    return true;
  }
  if (hadBefore) {
    console.log("⚠️  ccusage 업그레이드 실패 — 기존 버전으로 계속 진행\n");
    return true;
  }
  const bar = "═".repeat(60);
  console.log("\n" + bar);
  console.log("❌ ccusage 설치 실패");
  console.log("   → 토큰/비용 데이터가 수집되지 않습니다.");
  console.log("   → 수동 설치 후 repair 를 다시 실행하세요:");
  console.log("       npm install -g ccusage@19.0.2");
  console.log("       npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair");
  console.log(bar + "\n");
  return false;
}

// codeburn 도 동일 패턴. 기존 설치 있어도 @latest 시도.
async function ensureCodeburn(): Promise<boolean> {
  const hadBefore = checkCodeburn();
  console.log(hadBefore
    ? "📦 codeburn 0.9.7 (핀 버전) 강제 설치 시도..."
    : "⚠️  codeburn 미설치 — 최신 설치 시도..."
  );
  const installed = await installCodeburn();
  if (installed && checkCodeburn()) {
    console.log("✅ codeburn 0.9.7 확인됨\n");
    return true;
  }
  if (hadBefore) {
    console.log("⚠️  codeburn 업그레이드 실패 — 기존 버전으로 계속 진행\n");
    return true;
  }
  return false;
}

export async function runRepair() {
  console.log(`🔧 Usage Tracker v${CLI_VERSION} 복구 시작\n`);
  preflightOwnership();
  preflightGlobalPackages();
  preflightNodeVersion();

  const apiKey = await loadApiKey();
  if (!apiKey) {
    console.error("❌ 설치된 API 키가 없습니다. 먼저 init을 실행하세요:");
    console.error("   npx --yes github:eugene-eee-hongkyu/ai-usage-tracker init");
    process.exit(1);
  }
  console.log("✅ API 키 확인됨\n");

  // repair 시 codeburn / ccusage 항상 @latest 로 강제 업그레이드.
  // codeburn fix (#184 timezone 등) 가 사용자 PC 에 자동 반영되도록.
  const codeburnOk = await ensureCodeburn();
  if (!codeburnOk) {
    console.error("❌ codeburn 사용 불가 상태. 수동 설치 후 다시 시도하세요:");
    console.error("   npm install -g codeburn@0.9.7");
    process.exit(1);
  }
  const ccusageOk = await ensureCcusage();

  // submit.mjs는 standalone 실행이라 keytar 없음 → 항상 파일에도 보장
  fs.mkdirSync(path.dirname(API_KEY_FALLBACK), { recursive: true });
  fs.writeFileSync(API_KEY_FALLBACK, apiKey, { mode: 0o600 });

  fs.mkdirSync(STABLE_DIR, { recursive: true });
  fs.copyFileSync(path.join(__dirname, "submit.mjs"), STABLE_SUBMIT);
  fs.copyFileSync(path.join(__dirname, "historical.mjs"), STABLE_HISTORICAL);
  removeHook();
  registerDailySchedule(STABLE_SUBMIT);
  runImmediateSync(apiKey);
  runHistoricalBackfill(apiKey);

  console.log("\n✨ 복구 완료!");
  console.log("   백그라운드에서 자동으로 사용량이 수집됩니다.");
  console.log(`   대시보드: ${SERVER_URL}/dashboard\n`);
  if (!ccusageOk) {
    console.log("⚠️  주의: ccusage 미설치 상태로 저장되어 토큰/비용은 비어 있습니다.\n");
  }
  process.exit(0);
}

export async function runInit() {
  console.log(`🚀 Usage Tracker v${CLI_VERSION} 설치 시작\n`);
  preflightOwnership();
  preflightGlobalPackages();
  preflightNodeVersion();

  // init 시에도 항상 @latest 시도. 기존 사용자도 install.sh 재실행만으로
  // codeburn/ccusage 최신 fix 자동 반영.
  const codeburnOk = await ensureCodeburn();
  if (!codeburnOk) {
    console.error("❌ codeburn 설치 실패. 수동으로 설치 후 다시 시도하세요:");
    console.error("   npm install -g codeburn@0.9.7");
    process.exit(1);
  }
  const ccusageOk = await ensureCcusage();

  const existingKey = await loadApiKey();
  if (existingKey) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((res) =>
      rl.question("이미 설치되어 있습니다. 재설치할까요? (y/N) ", res)
    );
    rl.close();
    if (answer.toLowerCase() !== "y") {
      console.log("설치 취소됨.");
      return;
    }
    await deleteApiKey();
  }

  let apiKey: string;
  try {
    apiKey = await getApiKeyViaLocalServer();
  } catch (err) {
    console.error("❌ 인증 실패:", (err as Error).message);
    process.exit(1);
  }

  await saveApiKey(apiKey);
  console.log("🔑 API 키 저장 완료");

  // submit.mjs / historical.mjs 를 안정적인 경로에 복사 (npx 캐시 경로는 갱신 시 깨짐)
  fs.mkdirSync(STABLE_DIR, { recursive: true });
  fs.copyFileSync(path.join(__dirname, "submit.mjs"), STABLE_SUBMIT);
  fs.copyFileSync(path.join(__dirname, "historical.mjs"), STABLE_HISTORICAL);
  removeHook();
  registerDailySchedule(STABLE_SUBMIT);
  runBackfill(apiKey);
  runHistoricalBackfill(apiKey);

  console.log("\n✨ 설치 완료!");
  console.log("   백그라운드에서 자동으로 사용량이 수집됩니다.");
  console.log(`   대시보드: ${SERVER_URL}/dashboard\n`);
  if (!ccusageOk) {
    console.log("⚠️  주의: ccusage 미설치 상태로 저장되어 토큰/비용은 비어 있습니다.\n");
  }
  process.exit(0);
}
