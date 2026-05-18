// next build 의 standalone output 평탄화.
//
// 배경:
//   monorepo (npm workspace) 라 next 14 의 standalone 빌드 결과가
//     .next/standalone/
//     ├── node_modules/        ← hoisted 의존성 (root 기준 상대 경로 보존)
//     ├── package.json
//     └── web/
//         ├── server.js
//         ├── .next/server/...
//         └── ...
//   구조로 만들어진다 (outputFileTracingRoot = monorepo root 영향).
//   기존 Electron / stage 흐름은 `.next/standalone/server.js` 를 가정 — 그래서 한
//   단계 안쪽으로 들어가 있으면 server 실행 시 require resolution 깨진다.
//
// 후처리:
//   .next/standalone/web/* 를 .next/standalone/ 으로 이동 후 빈 web/ 디렉토리 삭제.
//   node_modules 와 package.json 은 그대로 두면 node 의 require 가 자연 해석.

import { existsSync, rmSync, renameSync, readdirSync, statSync, cpSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, "..");
const STANDALONE = path.join(WEB_ROOT, ".next", "standalone");
const NESTED_WEB = path.join(STANDALONE, "web");
const STATIC_SRC = path.join(WEB_ROOT, ".next", "static");
const PUBLIC_SRC = path.join(WEB_ROOT, "public");

if (!existsSync(STANDALONE)) {
  console.log("[flatten-standalone] .next/standalone 없음 — 빌드 안 됐거나 standalone 미사용. skip.");
  process.exit(0);
}

// 1) monorepo 평탄화 — standalone/web/* → standalone/
if (existsSync(NESTED_WEB)) {
  console.log(`[flatten-standalone] ${NESTED_WEB} 의 내용을 ${STANDALONE} 으로 이동`);
  for (const entry of readdirSync(NESTED_WEB)) {
    const from = path.join(NESTED_WEB, entry);
    const to = path.join(STANDALONE, entry);
    if (existsSync(to)) {
      if (entry === "node_modules") {
        console.log("[flatten-standalone]   node_modules 병합 (web/node_modules → standalone/node_modules)");
        mergeDir(from, to);
        rmSync(from, { recursive: true, force: true });
        continue;
      }
      console.log(`[flatten-standalone]   기존 ${entry} 덮어쓰기 (web 본체 우선)`);
      rmSync(to, { recursive: true, force: true });
    }
    renameSync(from, to);
  }
  rmSync(NESTED_WEB, { recursive: true, force: true });
}

// 2) static + public 복사 — Next.js standalone 빌드는 .next/static 과 public/ 을
//    자동 복사하지 않음 (docs 명시). standalone 디렉토리 안에 두어 server.js 가
//    /_next/static/* 와 /public/* 요청에 응답할 수 있게.
const STATIC_DST = path.join(STANDALONE, ".next", "static");
if (existsSync(STATIC_SRC)) {
  mkdirSync(path.dirname(STATIC_DST), { recursive: true });
  if (existsSync(STATIC_DST)) rmSync(STATIC_DST, { recursive: true, force: true });
  cpSync(STATIC_SRC, STATIC_DST, { recursive: true });
  console.log(`[flatten-standalone] .next/static → ${STATIC_DST}`);
} else {
  console.log("[flatten-standalone] .next/static 없음 — skip");
}

const PUBLIC_DST = path.join(STANDALONE, "public");
if (existsSync(PUBLIC_SRC)) {
  if (existsSync(PUBLIC_DST)) rmSync(PUBLIC_DST, { recursive: true, force: true });
  cpSync(PUBLIC_SRC, PUBLIC_DST, { recursive: true });
  console.log(`[flatten-standalone] public → ${PUBLIC_DST}`);
} else {
  console.log("[flatten-standalone] public 없음 — skip");
}

console.log("[flatten-standalone] 완료 — server.js + node_modules + .next/static + public 모두 standalone 직속");

function mergeDir(srcDir, dstDir) {
  for (const e of readdirSync(srcDir)) {
    const s = path.join(srcDir, e);
    const d = path.join(dstDir, e);
    if (statSync(s).isDirectory()) {
      if (!existsSync(d)) cpSync(s, d, { recursive: true });
      else mergeDir(s, d);
    } else if (!existsSync(d)) {
      cpSync(s, d);
    }
  }
}
