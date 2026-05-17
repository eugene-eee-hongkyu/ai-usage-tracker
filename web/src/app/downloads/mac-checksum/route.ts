// /downloads/mac-checksum → 동봉된 SHA-256 체크섬 파일 redirect.
// 외부 회사 데모 시 신뢰감 + 사용자가 직접 검증 가능:
//   shasum -a 256 -c ai-usage-tracker-arm64.dmg.sha256

export const dynamic = "force-static";

const CHECKSUM_URL =
  "https://github.com/eugene-eee-hongkyu/ai-usage-tracker/releases/latest/download/ai-usage-tracker-arm64.dmg.sha256";

export function GET() {
  return Response.redirect(CHECKSUM_URL, 302);
}
