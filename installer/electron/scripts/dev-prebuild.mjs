// dev electron 실행 전 빌드 산출물이 신선한지 확인 + 누락 시 자동 빌드.
//
// 검사:
//   1) web/.next/standalone/server.js + web/.next/standalone/node_modules/next
//      둘 다 있으면 (정상 standalone) skip. 없으면 web build 트리거.
//   2) cli/src/sync.mjs (bun build 결과) 있으면 skip. 없으면 cli build 트리거.
//
// 매번 build 하면 dev 사이클 느려져 — 산출물 없을 때만 동작. 신선도 (mtime
// vs 소스) 까지는 검사 안 함. 명시적 갱신 필요하면 `cd web && npm run build` /
// `cd cli && bun run build` 수동.

import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
const WEB = path.join(ROOT, "web");
const CLI = path.join(ROOT, "cli");

const standaloneOk =
  existsSync(path.join(WEB, ".next", "standalone", "server.js")) &&
  existsSync(path.join(WEB, ".next", "standalone", "node_modules", "next"));

if (!standaloneOk) {
  console.log("[dev-prebuild] web/.next/standalone 미존재 또는 손상 — npm run build:web 실행");
  execSync("npm run build:web", { stdio: "inherit", cwd: path.join(ROOT, "installer", "electron") });
} else {
  console.log("[dev-prebuild] web standalone OK — skip");
}

const cliOk = existsSync(path.join(CLI, "src", "sync.mjs"));
if (!cliOk) {
  console.log("[dev-prebuild] cli/src/sync.mjs 미존재 — npm run build:cli 실행");
  execSync("npm run build:cli", { stdio: "inherit", cwd: path.join(ROOT, "installer", "electron") });
} else {
  console.log("[dev-prebuild] cli build OK — skip");
}
