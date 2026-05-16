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

// better-sqlite3 는 native binary. staged 의 빌드본 ABI 가 사용자 시스템 Node ABI 와
// 다르면 실행 시 NODE_MODULE_VERSION mismatch 발생. 시도 순서:
//   1. prebuild-install — GitHub release 의 prebuilt binary fetch (가장 안정)
//   2. npm rebuild — node-gyp 로 직접 컴파일 (Xcode/Python 필요)
// 둘 다 실패하면 silent — 빌드 자체는 통과시키고, 실행 시점에 발견되도록.
const sqliteDir = path.join(WEB_OUT, "node_modules", "better-sqlite3");
if (existsSync(sqliteDir)) {
  console.log("==> better-sqlite3 prebuild fetch 시도");
  try {
    execSync("npx --yes prebuild-install --runtime=node --target=$(node -p process.versions.node)", {
      cwd: sqliteDir,
      stdio: "inherit",
      shell: "/bin/bash",
    });
    console.log("  ✓ prebuild binary 적용");
  } catch {
    try {
      console.log("  prebuild 실패 → npm rebuild fallback");
      execSync("npm rebuild --update-binary", { cwd: sqliteDir, stdio: "inherit" });
      console.log("  ✓ rebuild 완료");
    } catch {
      console.warn(
        "  ⚠️  better-sqlite3 ABI 정렬 실패. 실행 시점에 ABI mismatch 가능. " +
          "사용자 시스템 Node 가 빌드 시 사용한 Node 버전과 같아야 함."
      );
    }
  }
}

console.log(`✅ staged: ${STAGED}`);
