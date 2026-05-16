/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 는 native binary 라 Vercel 빌드 시 webpack 에 잡히면 안 된다.
  // 로컬 단독 모드 (DATABASE_KIND=sqlite) 에서만 동적 require 로 로드.
  serverExternalPackages: ["better-sqlite3"],

  // .pkg/.msi 인스톨러용 standalone 빌드 — node embedded 형태로 패키징 가능.
  // .next/standalone/server.js 가 entry point. Vercel 배포에는 영향 없음
  // (Vercel 도 standalone 권장). NEXT_BUILD_STANDALONE 환경변수로 끄고 싶으면 분기.
  output: process.env.NEXT_BUILD_STANDALONE === "0" ? undefined : "standalone",
};

export default nextConfig;
