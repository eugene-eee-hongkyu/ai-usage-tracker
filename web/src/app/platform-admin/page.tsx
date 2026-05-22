// /platform-admin — Audit 첫 화면으로 redirect.

import { redirect } from "next/navigation";

export default function PlatformAdminRoot() {
  redirect("/platform-admin/audit");
}
