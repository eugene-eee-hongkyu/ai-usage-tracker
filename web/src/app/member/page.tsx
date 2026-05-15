"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MemberRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/members");
  }, [router]);
  return null;
}
