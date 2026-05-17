// /downloads/mac → GitHub Releases latest .dmg redirect.
// 도메인은 ai.z21labs.world 유지, 실제 파일은 GitHub CDN (2GB 한도, 코드 수정 없이 새 버전 반영).
// `latest/download/<asset-name>` 패턴 — release tag 만 새로 만들고 asset 이름 유지하면 자동 latest.

export const dynamic = "force-static";

const RELEASE_URL =
  "https://github.com/eugene-eee-hongkyu/ai-usage-tracker/releases/latest/download/ai-usage-tracker-arm64.dmg";

export function GET() {
  return Response.redirect(RELEASE_URL, 302);
}
