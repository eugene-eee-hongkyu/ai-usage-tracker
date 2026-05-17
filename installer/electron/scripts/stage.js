// staging — Next.js standalone build + static + public + cli/sync.mjs + Node
// runtime + codeburn/ccusage tarball 을 installer/electron/staged/{web,cli,runtime}/
// 로 모음. electron-builder 의 extraResources 가 이 staged 디렉토리를
// .app/Contents/Resources/{web,cli,runtime} 로 복사.
//
// runtime/ 동봉 정책 (.dmg 자족화):
//   - Node 22 darwin-arm64 — better-sqlite3 ABI 127 prebuilt 와 일치, standalone
//     server child 와 sync 가 시스템 Node 없이 동작.
//   - codeburn / ccusage tarball — 첫 실행 시 ~/.usage-tracker/runtime/ 으로
//     `npm install` 되어 codeburn·ccusage 글로벌 설치 없이 동작.

const { execSync } = require("child_process");
const { cpSync, existsSync, mkdirSync, rmSync, readdirSync, statSync, chmodSync } = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const ELECTRON_DIR = path.resolve(__dirname, "..");
const STAGED = path.join(ELECTRON_DIR, "staged");
const WEB_OUT = path.join(STAGED, "web");
const CLI_OUT = path.join(STAGED, "cli");
const RUNTIME_OUT = path.join(STAGED, "runtime");

// dmg 동봉 버전 — better-sqlite3 ABI 127 (=Node 22) 과 일치.
// codeburn/ccusage 는 install.sh 와 동일한 핀 (be26780).
const NODE_VERSION = "22.11.0";
const CODEBURN_VERSION = "0.9.7";
const CCUSAGE_VERSION = "19.0.2";

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

  // `bindings` 라이브러리 (better-sqlite3 가 사용) 는 build/Release/<name>.node
  // 를 가장 먼저 시도 → lib/binding/node-v<ABI>-... 하위 트리는 자동 탐색되지
  // 않는다. 즉 실효는 build/Release 단일 binary 이며, 동봉 Node 22 (ABI 127) 와
  // 일치해야 함. ABI 141 등 다른 binary 를 넣으면 ERR_DLOPEN_FAILED.
  const fallbackBin = path.join(CACHE_DIR, "node-v127-darwin-arm64.node");
  if (existsSync(fallbackBin)) {
    const buildReleaseDir = path.join(SQLITE_DIR, "build", "Release");
    mkdirSync(buildReleaseDir, { recursive: true });
    cpSync(fallbackBin, path.join(buildReleaseDir, "better_sqlite3.node"));
    console.log(`  ✓ build/Release/better_sqlite3.node ← ABI 127 (Node 22, 동봉 Node 와 일치)`);
  } else {
    console.warn(`  ⚠️  ABI 127 prebuilt cache 없음 (${fallbackBin}) — bundled Node 22 가 load 실패할 것`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Node 22 darwin-arm64 + codeburn/ccusage prebuilt node_modules 동봉
//
// 빌드 머신에서 미리 `npm install` 해 node_modules 트리를 만들어두고, 첫 실행 시
// main.js 가 그대로 ~/.usage-tracker/runtime/ 으로 cp 한다. 사용자 머신에서는
// 네트워크/npm 없이 즉시 동작.
//
// 캐시: installer/electron/cache/runtime/ 에 Node 압축본 + prebuilt 보관.

const RUNTIME_CACHE = path.join(ELECTRON_DIR, "cache", "runtime");
mkdirSync(RUNTIME_CACHE, { recursive: true });
mkdirSync(RUNTIME_OUT, { recursive: true });

// ---- Node 다운로드 + 추출 (bin/node 만) ----------------------------------
console.log(`==> Node ${NODE_VERSION} darwin-arm64 동봉 (bin/node only)`);
const NODE_TAR_NAME = `node-v${NODE_VERSION}-darwin-arm64.tar.gz`;
const NODE_DIR_NAME = `node-v${NODE_VERSION}-darwin-arm64`;
const NODE_TAR_CACHED = path.join(RUNTIME_CACHE, NODE_TAR_NAME);
const NODE_EXTRACTED_CACHED = path.join(RUNTIME_CACHE, NODE_DIR_NAME);

if (!existsSync(NODE_TAR_CACHED)) {
  const url = `https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TAR_NAME}`;
  console.log(`  ⇣ ${url}`);
  execSync(`curl -fsSL -o "${NODE_TAR_CACHED}" "${url}"`, { stdio: "pipe" });
}
if (!existsSync(NODE_EXTRACTED_CACHED)) {
  console.log(`  ▷ tar xzf ${NODE_TAR_NAME}`);
  execSync(`tar -xzf "${NODE_TAR_CACHED}" -C "${RUNTIME_CACHE}"`, { stdio: "pipe" });
}

const NODE_OUT = path.join(RUNTIME_OUT, "node");
if (existsSync(NODE_OUT)) rmSync(NODE_OUT, { recursive: true, force: true });
mkdirSync(path.join(NODE_OUT, "bin"), { recursive: true });
cpSync(
  path.join(NODE_EXTRACTED_CACHED, "bin", "node"),
  path.join(NODE_OUT, "bin", "node"),
  { dereference: true }
);
chmodSync(path.join(NODE_OUT, "bin", "node"), 0o755);
console.log(`  ✓ staged/runtime/node/bin/node`);

// ---- codeburn / ccusage tarball 다운로드 + prebuilt npm install ----------
const NPM_PACKAGES = [
  { name: "codeburn", version: CODEBURN_VERSION },
  { name: "ccusage", version: CCUSAGE_VERSION },
];

const TARBALLS_CACHED = [];
for (const pkg of NPM_PACKAGES) {
  const tarName = `${pkg.name}-${pkg.version}.tgz`;
  const cached = path.join(RUNTIME_CACHE, tarName);
  if (!existsSync(cached)) {
    const url = `https://registry.npmjs.org/${pkg.name}/-/${tarName}`;
    console.log(`  ⇣ ${url}`);
    execSync(`curl -fsSL -o "${cached}" "${url}"`, { stdio: "pipe" });
  }
  TARBALLS_CACHED.push(cached);
}

// prebuilt/ — node_modules 트리를 빌드 머신 npm 으로 한 번 깐다.
// 캐시 키: 모든 패키지의 name@version 정렬.
const prebuiltKey = NPM_PACKAGES.map((p) => `${p.name}@${p.version}`).sort().join(",");
const PREBUILT_CACHED = path.join(RUNTIME_CACHE, `prebuilt-${require("crypto").createHash("sha1").update(prebuiltKey).digest("hex").slice(0, 12)}`);

if (!existsSync(path.join(PREBUILT_CACHED, "node_modules", ".bin", "codeburn"))) {
  console.log(`==> prebuilt node_modules 생성 (${prebuiltKey})`);
  if (existsSync(PREBUILT_CACHED)) rmSync(PREBUILT_CACHED, { recursive: true, force: true });
  mkdirSync(PREBUILT_CACHED, { recursive: true });
  // npm 이 --prefix 모드에서 package.json 필요
  require("fs").writeFileSync(
    path.join(PREBUILT_CACHED, "package.json"),
    JSON.stringify({ name: "ai-usage-tracker-prebuilt", private: true, version: "1.0.0" }, null, 2)
  );
  execSync(
    `npm install --prefix "${PREBUILT_CACHED}" --no-save --no-audit --no-fund --omit=optional --omit=dev ${TARBALLS_CACHED.map((t) => `"${t}"`).join(" ")}`,
    { stdio: "inherit" }
  );

  // npm 의 --prefix 모드 quirk — .bin/<name> symlink 가 build cache 의 절대
  // 경로로 생성된다 (e.g. /Users/.../cache/runtime/prebuilt-XXX/node_modules/codeburn/dist/cli.js).
  // .app 으로 배포되면 그 절대 경로는 사용자 머신에 없으므로 broken link.
  // node_modules 기준 상대 경로로 재작성.
  const fs = require("fs");
  const binDir = path.join(PREBUILT_CACHED, "node_modules", ".bin");
  if (existsSync(binDir)) {
    for (const entry of readdirSync(binDir)) {
      const linkPath = path.join(binDir, entry);
      let st;
      try {
        st = fs.lstatSync(linkPath);
      } catch {
        continue;
      }
      if (!st.isSymbolicLink()) continue;
      const target = fs.readlinkSync(linkPath);
      if (!path.isAbsolute(target)) continue;
      const relTarget = path.relative(binDir, target);
      fs.unlinkSync(linkPath);
      fs.symlinkSync(relTarget, linkPath);
    }
    console.log(`  ✓ .bin/* symlink 를 상대 경로로 재작성`);
  }
} else {
  console.log(`==> prebuilt 캐시 재사용 (${PREBUILT_CACHED})`);
}

// staged/runtime/prebuilt/ 로 복사 — extraResources 가 이걸 .app 에 넣음.
// Node 20 의 cpSync 는 symlink 를 dereference 해버려 .bin/* 의 상대 경로가
// 절대 경로로 깨진다. cp -RP (=preserve symlinks verbatim) 사용.
const PREBUILT_OUT = path.join(RUNTIME_OUT, "prebuilt");
if (existsSync(PREBUILT_OUT)) rmSync(PREBUILT_OUT, { recursive: true, force: true });
mkdirSync(PREBUILT_OUT, { recursive: true });
execSync(`cp -RP "${PREBUILT_CACHED}/." "${PREBUILT_OUT}/"`, { stdio: "inherit" });
console.log(`  ✓ staged/runtime/prebuilt/node_modules`);

// 매니페스트 — main.js 가 사용자 머신의 installed.json 과 비교해 cp 여부 결정.
require("fs").writeFileSync(
  path.join(RUNTIME_OUT, "manifest.json"),
  JSON.stringify(
    {
      node: NODE_VERSION,
      packages: NPM_PACKAGES.map((p) => ({ name: p.name, version: p.version })),
    },
    null,
    2
  )
);

console.log(`✅ staged: ${STAGED}`);
