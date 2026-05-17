// staging — Next.js standalone build + static + public + cli/sync.mjs 를
// installer/electron/staged/{web,cli}/ 로 모음. electron-builder 의 extraResources
// 가 이 staged 디렉토리를 .app/Contents/Resources/{web,cli} 로 복사.

const { execSync } = require("child_process");
const { cpSync, existsSync, mkdirSync, rmSync } = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const ELECTRON_DIR = path.resolve(__dirname, "..");
const STAGED = path.join(ELECTRON_DIR, "staged");
const WEB_OUT = path.join(STAGED, "web");
const CLI_OUT = path.join(STAGED, "cli");

const WEB_ROOT = path.join(ROOT, "web");
const STANDALONE = path.join(WEB_ROOT, ".next", "standalone");
const STATIC_SRC = path.join(WEB_ROOT, ".next", "static");
const PUBLIC_SRC = path.join(WEB_ROOT, "public");
const MIGRATIONS_SRC = path.join(WEB_ROOT, "drizzle-sqlite");
const CLI_SRC = path.join(ROOT, "cli", "src");

if (!existsSync(STANDALONE)) {
  console.error(`standalone 없음: ${STANDALONE}\n먼저 'npm --prefix ../../web run build' 를 실행하세요.`);
  process.exit(1);
}

console.log(`==> staging 디렉토리 초기화: ${STAGED}`);
if (existsSync(STAGED)) rmSync(STAGED, { recursive: true, force: true });
mkdirSync(WEB_OUT, { recursive: true });
mkdirSync(CLI_OUT, { recursive: true });

console.log("==> standalone → staged/web");
cpSync(STANDALONE, WEB_OUT, { recursive: true });

console.log("==> .next/static → staged/web/.next/static");
mkdirSync(path.join(WEB_OUT, ".next"), { recursive: true });
cpSync(STATIC_SRC, path.join(WEB_OUT, ".next", "static"), { recursive: true });

console.log("==> public → staged/web/public");
cpSync(PUBLIC_SRC, path.join(WEB_OUT, "public"), { recursive: true });

console.log("==> drizzle-sqlite → staged/web/drizzle-sqlite");
cpSync(MIGRATIONS_SRC, path.join(WEB_OUT, "drizzle-sqlite"), { recursive: true });

// Vercel CLI 가 web/.env.production 에 빈 시크릿 placeholder 를 만들어 두는데,
// standalone build 가 이걸 자동 포함시키면 dotenv 가 우리 spawn 환경변수와 충돌
// (특히 DATABASE_URL="" 빈 값 등). Electron 환경에서는 main.js 가 모든 env 책임.
for (const f of [".env.production", ".env.local"]) {
  const p = path.join(WEB_OUT, f);
  if (existsSync(p)) {
    rmSync(p);
    console.log(`==> ${f} 제거 (Electron 환경에서는 main.js 의 spawn env 가 우선)`);
  }
}

console.log("==> cli/src/*.mjs → staged/cli");
for (const file of ["sync.mjs", "index.mjs", "init.mjs"]) {
  const src = path.join(CLI_SRC, file);
  if (existsSync(src)) cpSync(src, path.join(CLI_OUT, file));
}

// better-sqlite3 다중 ABI prebuilt binary 자동 fetch.
//
// Node 버전마다 NODE_MODULE_VERSION (ABI) 가 달라 native binary 호환 안 됨:
//   Node 20 → 115,  22 → 127,  23 → 131,  24 → 137,  25 → 141
//
// 사용자 시스템 Node 가 어느 버전이든 즉시 작동하도록 여러 ABI 의 prebuilt
// binary 를 .app 안에 동봉. better-sqlite3 의 bindings 모듈이 자동으로 현재
// 프로세스의 ABI 에 맞는 binary 를 lib/binding/node-v{ABI}-darwin-arm64/ 에서 찾음.
//
// 캐시: installer/electron/cache/abi-binaries/ 에 ABI 별 binary 보관. 다음 빌드
// 부터는 fetch 안 함.
const SQLITE_DIR = path.join(WEB_OUT, "node_modules", "better-sqlite3");
if (!existsSync(SQLITE_DIR)) {
  console.warn("  ⚠️  staged better-sqlite3 디렉토리 없음 — ABI binary 동봉 skip");
} else {
  // better-sqlite3 의 release tag 확인 — staged 의 package.json 사용.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlitePkg = require(path.join(SQLITE_DIR, "package.json"));
  const sqliteVersion = sqlitePkg.version;
  console.log(`==> better-sqlite3 v${sqliteVersion} — 다중 ABI prebuilt fetch`);

  const ABI_TARGETS = [
    { abi: "115", node: "20" },
    { abi: "127", node: "22" },
    { abi: "131", node: "23" },
    { abi: "137", node: "24" },
    { abi: "141", node: "25" },
  ];

  const CACHE_DIR = path.join(ELECTRON_DIR, "cache", "abi-binaries", `better-sqlite3-${sqliteVersion}`);
  mkdirSync(CACHE_DIR, { recursive: true });

  for (const t of ABI_TARGETS) {
    const cachedBin = path.join(CACHE_DIR, `node-v${t.abi}-darwin-arm64.node`);
    const targetDir = path.join(SQLITE_DIR, "lib", "binding", `node-v${t.abi}-darwin-arm64`);
    const targetBin = path.join(targetDir, "better_sqlite3.node");

    if (!existsSync(cachedBin)) {
      const url =
        `https://github.com/WiseLibs/better-sqlite3/releases/download/` +
        `v${sqliteVersion}/better-sqlite3-v${sqliteVersion}-node-v${t.abi}-darwin-arm64.tar.gz`;
      const tmpTar = path.join(CACHE_DIR, `node-v${t.abi}.tar.gz`);
      const tmpExtract = path.join(CACHE_DIR, `node-v${t.abi}-extract`);
      try {
        execSync(`curl -fsSL -o "${tmpTar}" "${url}"`, { stdio: "pipe" });
        mkdirSync(tmpExtract, { recursive: true });
        execSync(`tar -xzf "${tmpTar}" -C "${tmpExtract}"`, { stdio: "pipe" });
        const extracted = path.join(tmpExtract, "build", "Release", "better_sqlite3.node");
        if (!existsSync(extracted)) {
          throw new Error(`extracted binary 없음: ${extracted}`);
        }
        cpSync(extracted, cachedBin);
        rmSync(tmpExtract, { recursive: true, force: true });
        rmSync(tmpTar);
        console.log(`  ✓ Node ${t.node} (ABI ${t.abi}) prebuilt fetched`);
      } catch (e) {
        console.warn(`  ⚠️  Node ${t.node} (ABI ${t.abi}) fetch 실패 — ${(e instanceof Error ? e.message : "unknown").split("\n")[0]}`);
        continue;
      }
    }

    mkdirSync(targetDir, { recursive: true });
    cpSync(cachedBin, targetBin);
  }

  // 기본 fallback (build/Release) 도 가장 최신 ABI 로 채워둠 — bindings 가
  // lib/binding 못 찾을 경우 폴백 경로.
  const fallbackBin = path.join(CACHE_DIR, "node-v141-darwin-arm64.node");
  if (existsSync(fallbackBin)) {
    const buildReleaseDir = path.join(SQLITE_DIR, "build", "Release");
    mkdirSync(buildReleaseDir, { recursive: true });
    cpSync(fallbackBin, path.join(buildReleaseDir, "better_sqlite3.node"));
  }
}

console.log(`✅ staged: ${STAGED}`);
