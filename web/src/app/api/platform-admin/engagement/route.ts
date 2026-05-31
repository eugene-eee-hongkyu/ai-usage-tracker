// GET /api/platform-admin/engagement — 전체 사용자 사이트 방문 / 체류 매트릭스.
// Platform Admin (ADMIN_EMAIL) 만 접근. /platform-admin/engagement 화면의 데이터 소스.
//
// admin > 팀 의 ENGAGEMENT 카드 (dailyVisitsBlock) 를 전체 user 로 확장한 버전.
// daily_visits scope: 팀 필터 제거 → 모든 팀의 모든 사용자.
// user 가 N 팀 가입이면 visits 는 team 별로 분리 저장되어 있으나 응답은 userId 로 합산.
// 팀 컬럼은 user 가 속한 팀 이름들을 (콤마) 로 표시 (informational).
//
// 응답 요약:
//   - users[]: userId / name / email / teamNames / lastSyncedAt / monthVisits / avgDwellSec
//   - dailyVisits30d: { dates: [30일 YYYY-MM-DD 역순 → 정순], byUser: { userId: { name, teamNames, counts[30] } } }
//
// 정렬: lastSyncedAt asc (오래 sync 안 한 / never sync 한 user 우선 — admin actionable).

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { db, users, teamMembers, teams, dailyVisits, IS_LOCAL_MODE } from "@/lib/db";
import { eq, and, gte, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface EngagementUser {
  userId: number;
  name: string;
  email: string;
  teamNames: string[];
  lastSyncedAt: string | null;
  monthVisits: number;
  avgDwellSec: number;
}

interface DailyVisits30d {
  dates: string[];
  byUser: Record<string, { name: string; teamNames: string[]; counts: number[] }>;
}

export async function GET() {
  if (IS_LOCAL_MODE) {
    return NextResponse.json({ error: "not_available_local" }, { status: 501 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 모든 (deleted/suspended 제외) 사용자 + 팀 멤버십. user 가 N 팀이면 N row.
  const userTeamRows = await db
    .select({
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      lastSyncedAt: users.lastSyncedAt,
      personal: users.personal,
      teamName: teams.name,
      teamType: teams.type,
    })
    .from(users)
    .leftJoin(teamMembers, and(eq(teamMembers.userId, users.id), isNull(teamMembers.deletedAt)))
    .leftJoin(teams, and(eq(teams.id, teamMembers.teamId), isNull(teams.deletedAt)))
    .where(and(
      isNull(users.deletedAt),
      isNull(users.suspendedAt),
    ));

  // userId 기준 그룹화 — name / email / lastSyncedAt 은 단일, teamNames 만 배열.
  // personal 팀은 라벨에서 제외 (UI noise).
  const byUserId = new Map<number, EngagementUser>();
  for (const r of userTeamRows) {
    const existing = byUserId.get(r.userId);
    if (existing) {
      if (r.teamName && r.teamType === "normal" && !existing.teamNames.includes(r.teamName)) {
        existing.teamNames.push(r.teamName);
      }
    } else {
      byUserId.set(r.userId, {
        userId: r.userId,
        name: r.userName,
        email: r.userEmail,
        teamNames: r.teamName && r.teamType === "normal" ? [r.teamName] : [],
        lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
        monthVisits: 0,
        avgDwellSec: 0,
      });
    }
  }

  // 이번 달 visit/dwell — userId 단위 합산 (team 무관).
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;
  const visitsThisMonth = await db
    .select({
      userId: dailyVisits.userId,
      count: dailyVisits.count,
      dwell: dailyVisits.totalDwellSeconds,
    })
    .from(dailyVisits)
    .where(gte(dailyVisits.date, monthStart));
  const visitAgg = new Map<number, { count: number; dwell: number }>();
  for (const r of visitsThisMonth) {
    const cur = visitAgg.get(r.userId) ?? { count: 0, dwell: 0 };
    cur.count += r.count;
    cur.dwell += r.dwell;
    visitAgg.set(r.userId, cur);
  }
  for (const [uid, agg] of visitAgg) {
    const u = byUserId.get(uid);
    if (u) {
      u.monthVisits = agg.count;
      u.avgDwellSec = agg.count > 0 ? Math.round(agg.dwell / agg.count) : 0;
    }
  }

  // 30일 일별 방문 매트릭스 — team 무관, userId 단위 합산.
  const visit30StartYmd = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const visits30d = await db
    .select({ userId: dailyVisits.userId, date: dailyVisits.date, count: dailyVisits.count })
    .from(dailyVisits)
    .where(gte(dailyVisits.date, visit30StartYmd));
  const visit30AggByUser = new Map<number, Record<string, number>>();
  for (const r of visits30d) {
    if (!visit30AggByUser.has(r.userId)) visit30AggByUser.set(r.userId, {});
    const map = visit30AggByUser.get(r.userId)!;
    map[r.date] = (map[r.date] ?? 0) + r.count;  // 같은 user 의 N 팀 행 합산
  }
  const visit30Dates: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    visit30Dates.push(d.toISOString().slice(0, 10));
  }

  // 정렬: lastSyncedAt asc, null 우선 (= 한 번도 sync 안 함, admin actionable).
  const sortedUsers = Array.from(byUserId.values()).sort((a, b) => {
    if (!a.lastSyncedAt && !b.lastSyncedAt) return a.name.localeCompare(b.name, "ko");
    if (!a.lastSyncedAt) return -1;
    if (!b.lastSyncedAt) return 1;
    return new Date(a.lastSyncedAt).getTime() - new Date(b.lastSyncedAt).getTime();
  });

  const dailyVisits30d: DailyVisits30d = {
    dates: visit30Dates,
    byUser: Object.fromEntries(
      sortedUsers.map((u) => [
        String(u.userId),
        {
          name: u.name,
          teamNames: u.teamNames,
          counts: visit30Dates.map((d) => visit30AggByUser.get(u.userId)?.[d] ?? 0),
        },
      ])
    ),
  };

  return NextResponse.json({
    users: sortedUsers,
    dailyVisits30d,
    totals: {
      userCount: sortedUsers.length,
      activeMonthCount: sortedUsers.filter((u) => u.monthVisits > 0).length,
      noSyncCount: sortedUsers.filter((u) => !u.lastSyncedAt).length,
    },
  });
}
