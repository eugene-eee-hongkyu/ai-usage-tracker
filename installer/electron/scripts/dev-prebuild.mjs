// dev electron 실행 전 빌드 산출물이 신선한지 확인 + 누락 시 자동 빌드.
//
// 검사:
//   1) web/.next/standalone/server.js + web/.next/standalone/node_modules/next
//      둘 다 있으면 (정상 standalone) skip. 없으면 web build 트리거.
//   2) cli/src/sync.mjs (bun build 결과) 있으면 skip. 없으면 cli build 트리거.
//   3) better-sqlite3 native binary 가 Electron 의 Node 22 ABI 127 와 일치하는지.
//      아니면 prebuilt swap (stage.js 와 동일 로직).
//
// 매번 build 하면 dev 사이클 느려져 — 산출물 없거나 ABI 안 맞을 때만 동작.

import { existsSync, mkdirSync, cpSync, rmSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ELECTRON_DIR = path.resolve(__dirname, "..");
const ROOT = path.resolve(ELECTRON_DIR, "..", "..");
const WEB = path.join(ROOT, "web");
const CLI = path.join(ROOT, "cli");
const STANDALONE = path.join(WEB, ".next", "standalone");

const standaloneOk =
  existsSync(path.join(STANDALONE, "server.js")) &&
  existsSync(path.join(STANDALONE, "node_modules", "next"));

if (!standaloneOk) {
  console.log("[dev-prebuild] web/.next/standalone 미존재 또는 손상 — npm run build:web 실행");
  execSync("npm run build:web", { stdio: "inherit", cwd: ELECTRON_DIR });
} else {
  console.log("[dev-prebuild] web standalone OK — skip");
}

const cliOk = existsSync(path.join(CLI, "src", "sync.mjs"));
if (!cliOk) {
  console.log("[dev-prebuild] cli/src/sync.mjs 미존재 — npm run build:cli 실행");
  execSync("npm run build:cli", { stdio: "inherit", cwd: ELECTRON_DIR });
} else {
  console.log("[dev-prebuild] cli build OK — skip");
}

// ── better-sqlite3 ABI swap (Node 22 = ABI 127) ─────────────────────────────
// Electron 33 의 Node 가 22.x (ABI 127). 시스템 Node 가 20 인 머신에서 npm install
// 하면 root node_modules 의 prebuild 가 ABI 115. standalone 안의 better-sqlite3
// binary 가 그 ABI 115 라면 Electron 실행 시 DLOPEN_FAILED. stage.js 가 production
// 빌드 시 ABI 127 prebuilt 를 build/Release/better_sqlite3.node 에 박는 것과
// 동일하게 dev 에도 적용.
const SQLITE_DIR = path.join(STANDALONE, "node_modules", "better-sqlite3");
if (!existsSync(SQLITE_DIR)) {
  console.log("[dev-prebuild] better-sqlite3 standalone 위치 없음 — skip");
} else {
  const pkg = JSON.parse(readFileSync(path.join(SQLITE_DIR, "package.json"), "utf8"));
  const sqliteVersion = pkg.version;
  const TARGET_ABI = "127";
  const TARGET_PLATFORM = "darwin-arm64";

  const CACHE_DIR = path.join(ELECTRON_DIR, "cache", "abi-binaries", `better-sqlite3-${sqliteVersion}`);
  const cachedBin = path.join(CACHE_DIR, `node-v${TARGET_ABI}-${TARGET_PLATFORM}.node`);
  mkdirSync(CACHE_DIR, { recursive: true });

  if (!existsSync(cachedBin)) {
    console.log(`[dev-prebuild] better-sqlite3 ABI ${TARGET_ABI} prebuilt fetch (v${sqliteVersion})`);
    const url =
      `https://github.com/WiseLibs/better-sqlite3/releases/download/` +
      `v${sqliteVersion}/better-sqlite3-v${sqliteVersion}-node-v${TARGET_ABI}-${TARGET_PLATFORM}.tar.gz`;
    const tmpTar = path.join(CACHE_DIR, `node-v${TARGET_ABI}.tar.gz`);
    const tmpExtract = path.join(CACHE_DIR, `node-v${TARGET_ABI}-extract`);
    try {
      execSync(`curl -fsSL -o "${tmpTar}" "${url}"`, { stdio: "pipe" });
      mkdirSync(tmpExtract, { recursive: true });
      execSync(`tar -xzf "${tmpTar}" -C "${tmpExtract}"`, { stdio: "pipe" });
      const extracted = path.join(tmpExtract, "build", "Release", "better_sqlite3.node");
      if (!existsSync(extracted)) throw new Error(`extracted binary 없음: ${extracted}`);
      cpSync(extracted, cachedBin);
      rmSync(tmpExtract, { recursive: true, force: true });
      rmSync(tmpTar);
      console.log(`[dev-prebuild]   ✓ ABI ${TARGET_ABI} prebuilt fetched`);
    } catch (e) {
      console.warn(`[dev-prebuild]   ⚠️  ABI ${TARGET_ABI} fetch 실패 — ${(e instanceof Error ? e.message : "unknown").split("\n")[0]}`);
      console.warn(`[dev-prebuild]   Electron 실행 시 better-sqlite3 DLOPEN_FAILED 가능`);
    }
  }

  if (existsSync(cachedBin)) {
    const buildReleaseDir = path.join(SQLITE_DIR, "build", "Release");
    mkdirSync(buildReleaseDir, { recursive: true });
    cpSync(cachedBin, path.join(buildReleaseDir, "better_sqlite3.node"));
    console.log(`[dev-prebuild] better-sqlite3 build/Release ← ABI ${TARGET_ABI} (Electron Node 22)`);
  }
}
