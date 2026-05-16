/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 는 native binary 라 Vercel 빌드 시 webpack 에 잡히면 안 된다.
  // 로컬 단독 모드 (DATABASE_KIND=sqlite) 에서만 동적 require 로 로드.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
