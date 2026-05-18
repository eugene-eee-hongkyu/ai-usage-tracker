import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
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
