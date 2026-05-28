// 서버 세션 분기 — 이미 로그인되어 있으면 /dashboard 직행.
// 옛 동작: client component 가 mount 후 LOCAL_MODE 만 redirect 처리해서,
// 세션 있는 사용자가 /login 직접 열면 로그인 화면이 그대로 보임. 사용자
// 피드백 (2026-05-28) 으로 root / 와 동일하게 서버 단에서 redirect.

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { IS_LOCAL_MODE } from "@/lib/db";
import { LoginContent } from "./login-content";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (IS_LOCAL_MODE) {
    redirect("/dashboard");
  }
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    redirect("/dashboard");
  }
  return <LoginContent />;
}
