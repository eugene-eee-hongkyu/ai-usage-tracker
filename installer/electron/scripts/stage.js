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

console.log("==> cli/src/*.mjs → staged/cli");
for (const file of ["sync.mjs", "index.mjs", "init.mjs"]) {
  const src = path.join(CLI_SRC, file);
  if (existsSync(src)) cpSync(src, path.join(CLI_OUT, file));
}

// better-sqlite3 는 native binary. Next.js standalone 이 자체 node_modules 를
// 생성하면서 빌드 시점 Node ABI 의 binary 를 가져옴 (예: v20 = ABI 115). 사용자
// 시스템 Node ABI 와 다르면 실행 시 mismatch 에러.
//
// 해결: web/node_modules/better-sqlite3 의 binary (사전에 prebuild-install 로
// 시스템 brew node ABI 에 맞춰둠) 를 staged 의 standalone node_modules 로 복사.
//
// 사전 준비 (한 번):
//   cd web/node_modules/better-sqlite3
//   /opt/homebrew/bin/node $(npm root -g)/npm/bin/npx-cli.js --yes \
//     prebuild-install --runtime=node --target=25.0.0
const SQLITE_REL = path.join("better-sqlite3", "build", "Release", "better_sqlite3.node");
const sourceBin = path.join(WEB_ROOT, "node_modules", SQLITE_REL);
const targetBin = path.join(WEB_OUT, "node_modules", SQLITE_REL);
if (existsSync(sourceBin) && existsSync(path.dirname(targetBin))) {
  cpSync(sourceBin, targetBin);
  console.log("==> better-sqlite3 binary 교체 (web/node_modules → staged standalone)");
} else if (!existsSync(sourceBin)) {
  console.warn(
    "  ⚠️  web/node_modules/better-sqlite3 binary 없음. " +
      "prebuild-install 먼저 실행 필요."
  );
}

console.log(`✅ staged: ${STAGED}`);
