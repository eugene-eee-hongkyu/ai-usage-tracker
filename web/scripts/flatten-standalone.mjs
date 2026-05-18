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

import { existsSync, rmSync, renameSync, readdirSync, statSync, cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STANDALONE = path.resolve(__dirname, "..", ".next", "standalone");
const NESTED_WEB = path.join(STANDALONE, "web");

if (!existsSync(STANDALONE)) {
  console.log("[flatten-standalone] .next/standalone 없음 — 빌드 안 됐거나 standalone 미사용. skip.");
  process.exit(0);
}

if (!existsSync(NESTED_WEB)) {
  console.log("[flatten-standalone] standalone/web 없음 — 이미 평탄 구조이거나 monorepo 아님. skip.");
  process.exit(0);
}

console.log(`[flatten-standalone] ${NESTED_WEB} 의 내용을 ${STANDALONE} 으로 이동`);
for (const entry of readdirSync(NESTED_WEB)) {
  const from = path.join(NESTED_WEB, entry);
  const to = path.join(STANDALONE, entry);
  if (existsSync(to)) {
    // 기존 항목 (node_modules, package.json) 과 같은 이름이면 nested 쪽 우선 (web 본체).
    // 다만 node_modules 는 hoisted 가 root 에, web/node_modules 는 web-local. 둘 다 있으면 합쳐야.
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
console.log("[flatten-standalone] 완료 — server.js 가 .next/standalone/ 직속");

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
