// /platform-admin — All Users 첫 화면으로 redirect.

import { redirect } from "next/navigation";

export default function PlatformAdminRoot() {
  redirect("/platform-admin/all-users");
}
