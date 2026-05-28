// GET /api/about — 동봉 / 권장 의존성 버전을 반환.
//
// .dmg (Local) 모드: main.js 가 spawn 시 env 로 동봉 버전 주입
//   - APP_VERSION                = installer/electron/package.json
//   - RUNTIME_NODE_VERSION       = staged/runtime/manifest.json 의 node 버전
//   - RUNTIME_CODEBURN_VERSION   = staged manifest packages[].version
//   - RUNTIME_CCUSAGE_VERSION    = 동
//
// 클라우드 (Vercel) 모드: env 미설정 → install.sh / cli/src/init.ts 핀 정책과 동일한
// 권장 버전을 보여준다. 핀 변경 시 PINNED 상수만 갱신.
//
// nav 의 AboutPopover 가 클라이언트 fetch 로 호출.

import { NextResponse } from "next/server";

import { PINNED } from "@/lib/pinned-versions";
import pkg from "../../../../package.json";

export async function GET() {
  const isLocal = process.env.LOCAL_MODE === "1" || process.env.NEXT_PUBLIC_LOCAL_MODE === "1";

  // 클라우드: NEXT_PUBLIC_BUILD_VERSION (= "major.minor.commit-count", next.config.mjs
  // 에서 빌드 시 박힘) 우선. 매 push 마다 patch 자동 +1. 로컬 (.dmg): installer 의
  // APP_VERSION env 우선. fallback: package.json static version.
  const appVersion =
    process.env.APP_VERSION ??
    (isLocal ? null : process.env.NEXT_PUBLIC_BUILD_VERSION ?? pkg.version);

  return NextResponse.json({
    mode: isLocal ? "local" : "cloud",
    app: appVersion,
    node: process.env.RUNTIME_NODE_VERSION ?? PINNED.NODE_RECOMMENDED,
    codeburn: process.env.RUNTIME_CODEBURN_VERSION ?? PINNED.CODEBURN,
    ccusage: process.env.RUNTIME_CCUSAGE_VERSION ?? PINNED.CCUSAGE,
    // 빌드 시점 SHA — popover 가 client 번들에 박힌 NEXT_PUBLIC_BUILD_SHA 와
    // 비교해 stale page 감지. next.config.mjs 의 env 매핑과 동일 출처.
    buildSha: process.env.NEXT_PUBLIC_BUILD_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
    buildRef: process.env.NEXT_PUBLIC_BUILD_REF ?? process.env.VERCEL_GIT_COMMIT_REF ?? "local",
  });
}
