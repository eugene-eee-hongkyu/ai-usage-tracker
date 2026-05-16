// 클라이언트가 현재 서버가 로컬 모드인지 확인 — useSession 우회 결정용.
// (NEXT_PUBLIC_* 환경변수는 build-time inline 이라 runtime 분기 불가능 → API 로)

import { NextResponse } from "next/server";
import { IS_LOCAL_MODE } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ isLocalMode: IS_LOCAL_MODE });
}
