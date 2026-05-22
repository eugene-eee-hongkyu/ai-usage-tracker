// 핀 정책 단일 출처. install.sh / cli/src/init.ts 와 동기화 유지.
// /api/about + /api/platform-admin/all-users 등 여러 곳에서 참조.

export const PINNED = {
  CODEBURN: "0.9.7",
  CCUSAGE: "19.0.2",
  NODE_RECOMMENDED: "22",
} as const;
