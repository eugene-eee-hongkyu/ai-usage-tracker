// 핀 정책 단일 출처. install.sh / cli/src/init.ts 와 동기화 유지.
// /api/about + /api/platform-admin/all-users 등 여러 곳에서 참조.
//
// USAGE_TRACKER_RECOMMENDED — ai-usage-tracker CLI 자체 (`@z21labs/usage-tracker`)
// 최소 권장 버전. 매 CLI 릴리즈 시 cli/package.json 의 version 과 같이 bump.
// device.metadata.cliVersion 이 이 값 미만이면 dashboard 상단에 CLI 업데이트 배너.

export const PINNED = {
  CODEBURN: "0.9.11",
  CCUSAGE: "20.0.6",
  NODE_RECOMMENDED: "22",
  USAGE_TRACKER_RECOMMENDED: "0.3.4",
} as const;
