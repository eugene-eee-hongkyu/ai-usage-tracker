// GET /api/admin/team/ranking — 30일 윈도우, 전체 팀 비교 랭킹.
//
// 권한: requireBillingAdmin (admin/team 진입 가능자: Billing-Admin / Team Owner / Platform Admin).
//
// 응답:
//   {
//     myTeamId,
//     teams: [{ id, displayName, isMyTeam, powerIndex, unitCostUsdPerMTok }],
//     members: [{ userId, displayName, teamDisplayName, isMyTeam, totalTokens, totalCostUsd }]
//   }
//
// 익명화: 다른 팀의 팀명·멤버명은 server 측에서 마스킹 후 응답.
//
// 정의 (사용자 결정 2026-05-20):
//   - 30일 = rolling now - 30d
//   - 팀 활용지수 = Power Index (활성 멤버 평균, lib/rules computePowerIndex)
//   - 팀 토큰 단가 = (Σ plan_price) / (Σ tokens) × 1M USD/MTok (cache 포함)
//   - tier 미입력 멤버는 monthlyCost 로 추정 (estimateTierFromMonthlyCost)

import { NextResponse } from "next/server";
import { db, teams, teamMembers, users, userBlocks } from "@/lib/db";
import { requireBillingAdmin } from "@/lib/auth-guards";
import { eq, and, isNull, gte, inArray } from "drizzle-orm";
import { computePowerIndex } from "@/lib/rules";
import { getPlanLimits, estimateTierFromMonthlyCost, type PlanTier } from "@/lib/plan-health";
import { anonymizeName } from "@/lib/anonymize";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;

export async function GET() {
  const guard = await requireBillingAdmin();
  if (guard.error) return guard.error;
  const myTeamId = guard.user.currentTeamId;

  const windowStart = new Date(Date.now() - WINDOW_DAYS * 86_400_000);

  // 1) 모든 활성 팀 (name_pending=false 인 팀만 — 이름 정해진 회사끼리 비교)
  const teamRows = await db
    .select({
      id: teams.id,
      name: teams.name,
      namePending: teams.namePending,
    })
    .from(teams)
    .where(and(isNull(teams.deletedAt), eq(teams.namePending, false)));
  if (teamRows.length === 0) {
    return NextResponse.json({ myTeamId, teams: [], members: [] });
  }
  const teamIds = teamRows.map((t) => t.id);
  const teamNameById = new Map(teamRows.map((t) => [t.id, t.name]));

  // 2) 활성 멤버 (team_members JOIN users) — suspended/deleted 제외
  const memberRows = await db
    .select({
      teamId: teamMembers.teamId,
      userId: users.id,
      userName: users.name,
      planTier: users.planTier,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(
      and(
        inArray(teamMembers.teamId, teamIds),
        isNull(teamMembers.deletedAt),
        isNull(users.deletedAt),
        isNull(users.suspendedAt)
      )
    );

  if (memberRows.length === 0) {
    return NextResponse.json({ myTeamId, teams: [], members: [] });
  }

  // 3) 30일 윈도우 user_blocks SUM by (team_id, user_id)
  //   - totalTokens: 토큰 합 (cache 포함)
  //   - costUsd: 비용 합
  //   - activeDays: distinct date 카운트는 별도 — startedAt 의 YYYY-MM-DD set
  const blockRows = await db
    .select({
      teamId: userBlocks.teamId,
      userId: userBlocks.userId,
      totalTokens: userBlocks.totalTokens,
      costUsd: userBlocks.costUsd,
      startedAt: userBlocks.startedAt,
    })
    .from(userBlocks)
    .where(and(inArray(userBlocks.teamId, teamIds), gte(userBlocks.startedAt, windowStart)));

  // (teamId, userId) → { tokens, cost, activeDates: Set<string> }
  type MemberAgg = { tokens: number; cost: number; activeDates: Set<string> };
  const memberAgg = new Map<string, MemberAgg>();
  for (const b of blockRows) {
    const key = `${b.teamId}__${b.userId}`;
    const agg = memberAgg.get(key) ?? { tokens: 0, cost: 0, activeDates: new Set<string>() };
    agg.tokens += Number(b.totalTokens ?? 0);
    agg.cost += Number(b.costUsd ?? 0);
    agg.activeDates.add(b.startedAt.toISOString().slice(0, 10));
    memberAgg.set(key, agg);
  }

  // 4) 팀별 / 멤버별 합산
  type TeamAgg = {
    id: number;
    powerSum: number;
    powerCount: number;
    priceForPeriodSum: number;
    tokensSum: number;
  };
  const teamAgg = new Map<number, TeamAgg>();
  for (const t of teamIds) {
    teamAgg.set(t, { id: t, powerSum: 0, powerCount: 0, priceForPeriodSum: 0, tokensSum: 0 });
  }

  type MemberOut = {
    userId: number;
    teamId: number;
    userName: string;
    totalTokens: number;
    totalCost: number;
  };
  const membersFlat: MemberOut[] = [];

  for (const m of memberRows) {
    const key = `${m.teamId}__${m.userId}`;
    const agg = memberAgg.get(key);
    const tokens = agg?.tokens ?? 0;
    const cost = agg?.cost ?? 0;
    const activeDays = agg?.activeDates.size ?? 0;

    // 활용지수 — 활성 멤버 (activeDays > 0 && tokens > 0) 만 평균에 포함
    if (activeDays > 0 && tokens > 0) {
      const avgDailyTokens = tokens / activeDays;
      const score = computePowerIndex(activeDays, avgDailyTokens, WINDOW_DAYS);
      const ta = teamAgg.get(m.teamId)!;
      ta.powerSum += score;
      ta.powerCount += 1;
    }

    // tier 결정 — declared 우선, 없으면 30일 monthlyCost 로 추정
    const declared = (m.planTier ?? null) as PlanTier;
    const estimated = declared === null ? estimateTierFromMonthlyCost(cost) : null;
    const effective: PlanTier =
      declared ?? (estimated && estimated !== "unknown" ? estimated : null);
    const monthlyPriceUsd =
      effective !== null ? (getPlanLimits(effective).monthlyPriceUsd ?? 0) : 0;

    // 토큰 단가 — tier 파악된 멤버만 합산 (price × 30/30 = price 그대로)
    if (monthlyPriceUsd > 0 && tokens > 0) {
      const ta = teamAgg.get(m.teamId)!;
      ta.priceForPeriodSum += monthlyPriceUsd;
      ta.tokensSum += tokens;
    }

    membersFlat.push({
      userId: m.userId,
      teamId: m.teamId,
      userName: m.userName,
      totalTokens: tokens,
      totalCost: cost,
    });
  }

  // 5) 응답 직렬화 + 익명화
  const teamsOut = Array.from(teamAgg.values()).map((ta) => {
    const isMyTeam = ta.id === myTeamId;
    const rawName = teamNameById.get(ta.id) ?? "(unknown)";
    return {
      id: ta.id,
      displayName: isMyTeam ? rawName : anonymizeName(rawName),
      isMyTeam,
      powerIndex: ta.powerCount > 0 ? Math.round(ta.powerSum / ta.powerCount) : 0,
      activeMembers: ta.powerCount,
      unitCostUsdPerMTok:
        ta.priceForPeriodSum > 0 && ta.tokensSum > 0
          ? (ta.priceForPeriodSum / ta.tokensSum) * 1_000_000
          : null,
    };
  });

  const membersOut = membersFlat.map((m) => {
    const isMyTeam = m.teamId === myTeamId;
    const rawTeamName = teamNameById.get(m.teamId) ?? "(unknown)";
    return {
      userId: m.userId,
      teamId: m.teamId,
      displayName: isMyTeam ? m.userName : anonymizeName(m.userName),
      teamDisplayName: isMyTeam ? rawTeamName : anonymizeName(rawTeamName),
      isMyTeam,
      totalTokens: m.totalTokens,
      totalCostUsd: m.totalCost,
    };
  });

  return NextResponse.json({
    myTeamId,
    windowDays: WINDOW_DAYS,
    teams: teamsOut,
    members: membersOut,
  });
}
