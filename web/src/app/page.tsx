// 미인증 첫 방문자에게는 랜딩, 인증된 사용자는 즉시 /dashboard.
// LOCAL_MODE 는 single-user .dmg 라 로그인 개념 없음 — 항상 /dashboard.
//
// 옛 동작 (단순 redirect("/dashboard")) 은 첫 방문자가 즉시 /login 으로 떠밀려
// "이게 뭐 하는 서비스인지" 모르는 상태. ai.z21labs.world 의 핵심 5섹션 슬림본을
// 본인 도메인 안에서 첫인상으로 제공 — 30초 이해 후 OAuth 진행 흐름.

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { IS_LOCAL_MODE } from "@/lib/db";
import { Landing } from "@/components/landing";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (IS_LOCAL_MODE) {
    redirect("/dashboard");
  }
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    redirect("/dashboard");
  }
  return <Landing />;
}
