"use client";

// /admin 진입 시 마지막으로 본 탭으로 client-side replace. nav 의 "Admin" 링크가
// 여기로 와서, 사용자가 직전에 머물던 탭 (팀원/팀/랭킹/사용자/세팅) 으로 즉시 복귀.
// localStorage 에 없거나 화이트리스트 밖이면 기본값 /admin/members.
// 화이트리스트 가드: 외부 조작 / 옛 path 잔재 / 권한 사라진 탭 보호. 권한은
// 각 페이지/layout 가드가 별도로 처리하므로 여기서는 path 유효성만.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ALLOWED_TABS = [
  "/admin/members",
  "/admin/team",
  "/admin/team/ranking",
  "/admin/users",
  "/admin/settings",
] as const;
const DEFAULT_TAB = "/admin/members";

export default function AdminRedirect() {
  const router = useRouter();
  useEffect(() => {
    let target: string = DEFAULT_TAB;
    try {
      const saved = localStorage.getItem("admin_last_tab");
      if (saved && (ALLOWED_TABS as readonly string[]).includes(saved)) {
        target = saved;
      }
    } catch { /* localStorage 접근 실패 (sandbox 등) — 기본값 유지 */ }
    router.replace(target);
  }, [router]);
  return null;
}
