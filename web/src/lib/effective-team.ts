// Phase 4.2 (M6c) — multi-tenant 격리 + platform owner view-as.
//
// 두 가지 헬퍼:
//   - getEffectiveTeamId(): 격리 *조회* 쿼리에 쓴다. platform owner 가 view-as
//     cookie 를 박은 경우 그 team id, 아니면 session.user.currentTeamId.
//   - getCurrentTeamId(): 자기 데이터 *쓰기/조회* 에 쓴다. 항상 currentTeamId.
//     viewAs cookie 영향 받지 않음 — eugene 이 다른 회사 보는 중에 자기 ingest
//     가 그 회사로 INSERT 되는 사고 방지.
//
// 호출 원칙:
//   - admin route GET (users / audit / inactive / invitations / settings 멤버 리스트):
//     getEffectiveTeamId. owner 가 다른 회사 화면 볼 때 그 회사 데이터 반환.
//   - admin route 쓰기 (suspend / delete / invite): getEffectiveTeamId 로 target
//     팀 결정 + audit metadata 에 effective vs current 차이 기록 (Phase C).
//   - 일반 user route (dashboard / team / ingest): getCurrentTeamId. viewAs 무관.
//
// viewAs 검증:
//   cookie 값이 숫자가 아니거나 존재하지 않는 team id 면 무시 (currentTeamId fallback).
//   owner 가 아닌 user 가 cookie 박아도 무시 (isPlatformAdmin 체크 선행).

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { db, teams } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";

export const PLATFORM_VIEW_AS_COOKIE = "platform-view-as";

interface SessionLike {
  user?: {
    id?: number;
    isPlatformAdmin?: boolean;
    currentTeamId?: number | null;
  };
}

function readCookie(req?: NextRequest): string | undefined {
  if (req) return req.cookies.get(PLATFORM_VIEW_AS_COOKIE)?.value;
  return cookies().get(PLATFORM_VIEW_AS_COOKIE)?.value;
}

export async function getEffectiveTeamId(
  session: SessionLike | null | undefined,
  req?: NextRequest
): Promise<number | null> {
  const currentTeamId = session?.user?.currentTeamId ?? null;
  if (!session?.user?.isPlatformAdmin) return currentTeamId;

  const cookieValue = readCookie(req);
  if (!cookieValue) return currentTeamId;

  const teamId = parseInt(cookieValue, 10);
  if (!teamId || Number.isNaN(teamId)) return currentTeamId;
  if (teamId === currentTeamId) return currentTeamId;

  const row = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.id, teamId), isNull(teams.deletedAt)))
    .limit(1);
  if (!row[0]) return currentTeamId;
  return teamId;
}

export function getCurrentTeamId(
  session: SessionLike | null | undefined
): number | null {
  return session?.user?.currentTeamId ?? null;
}

/**
 * effective 이 current 와 다른지 (= platform owner 가 view-as 모드인지) 빠른 판정.
 * audit 의 actor_is_platform_owner flag 자동 설정 등에서 사용.
 */
export function isPlatformViewAs(
  session: SessionLike | null | undefined,
  effectiveTeamId: number | null
): boolean {
  return (
    !!session?.user?.isPlatformAdmin &&
    effectiveTeamId != null &&
    effectiveTeamId !== (session?.user?.currentTeamId ?? null)
  );
}
