// /me/devices — /setup-status 로 통합됨 (M6e, 2026-05-21).
// 옛 안내 메일·문서의 URL 호환 위해 redirect 라우트 유지.

import { redirect } from "next/navigation";

export default function MyDevicesRedirect() {
  redirect("/setup-status");
}
