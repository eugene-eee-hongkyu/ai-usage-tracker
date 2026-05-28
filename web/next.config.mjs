import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 빌드 시점 version = ${package.json major.minor}.${git 누적 commit count}.
// 매 push 마다 commit count +1 자동. count 는 scripts/fetch-build-version.mjs 가
// GitHub API 로 가져와 .build-version 에 저장 (Vercel 의 shallow clone 우회).
// minor 는 의미 있는 변경 시 사람이 의식적으로 package.json 의 version 을
// 0.X.0 형태로 bump.
let buildVersion = "0.0.dev";
try {
  const pkg = JSON.parse(readFileSync(path.join(__dirname, "package.json"), "utf-8"));
  const [major, minor] = (pkg.version ?? "0.0.0").split(".");
  let count = "0";
  try {
    count = readFileSync(path.join(__dirname, ".build-version"), "utf-8").trim();
  } catch {
    // .build-version 없음 (prebuild script 가 안 돌았거나 fetch 실패). git rev-list fallback.
    try {
      count = execSync("git rev-list --count HEAD", { cwd: __dirname }).toString().trim();
    } catch {
      count = "0";
    }
  }
  buildVersion = `${major}.${minor}.${count}`;
} catch (e) {
  console.warn("[next.config] build version derivation failed, falling back:", e);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 빌드 시점 git SHA + branch 를 client 번들에 inline. AboutPopover 가 이 값을
  // 서버 /api/about 의 최신 SHA 와 비교해 "옛 페이지 캐시" 감지.
  // Vercel 빌드 시 VERCEL_GIT_COMMIT_SHA 자동 설정. 로컬 빌드는 'dev' fallback.
  env: {
    NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
    NEXT_PUBLIC_BUILD_REF: process.env.VERCEL_GIT_COMMIT_REF ?? "local",
    NEXT_PUBLIC_BUILD_VERSION: buildVersion,
  },

  // .pkg/.msi 인스톨러용 standalone 빌드 — node embedded 형태로 패키징 가능.
  // .next/standalone/server.js 가 entry point. Vercel 배포에는 영향 없음
  // (Vercel 도 standalone 권장). NEXT_BUILD_STANDALONE 환경변수로 끄고 싶으면 분기.
  output: process.env.NEXT_BUILD_STANDALONE === "0" ? undefined : "standalone",

  experimental: {
    // better-sqlite3 는 native binary 라 Vercel 빌드 시 webpack 에 잡히면 안 된다.
    // 로컬 단독 모드 (DATABASE_KIND=sqlite) 에서만 동적 require 로 로드.
    // Next 14: experimental.serverComponentsExternalPackages (Next 15+ 는 top-level).
    serverComponentsExternalPackages: ["better-sqlite3"],

    // monorepo 의존성 트리 추적 root — npm workspace 의 hoisted 의존성이 root
    // node_modules 에 있어, web 안만 추적하면 next-server runtime 모듈
    // (node-polyfill-crypto 등) 가 standalone 의 node_modules 에 누락됨.
    // root 로 명시해 standalone 빌드가 hoisted next/* 도 포함하도록.
    // Next 14: experimental.outputFileTracingRoot (Next 15+ 는 top-level).
    outputFileTracingRoot: path.resolve(__dirname, ".."),
  },
};

export default nextConfig;
