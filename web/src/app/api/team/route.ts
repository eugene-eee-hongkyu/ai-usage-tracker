export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, userSnapshots, users, dailyVisits, userBlocks, teamMembers, IS_LOCAL_MODE } from "@/lib/db";
import { getAuthedEmail } from "@/lib/local-user";
import { getEffectiveTeamId } from "@/lib/effective-team";
import {
  analyzePlanHealth,
  summarizeTeamPlans,
  getPlanLimits,
  estimateTierFromMonthlyCost,
  type PlanTier,
} from "@/lib/plan-health";
import { computeEfficiencyScore, computeDailyEfficiencyScore, computePowerIndex } from "@/lib/rules";
import { isAdmin } from "@/lib/admin";
import { and, eq, gte, isNull, inArray } from "drizzle-orm";

type Period = "today" | "month" | "8days" | "30days" | "all";

interface RawOverview {
  cost?: number;
  sessions?: number;
  calls?: number;
  totalCost?: number;
  totalSessions?: number;
  tokens?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
}

interface RawActivity {
  name?: string;
  category?: string;
  sessions?: number;
  turns?: number;
  cost?: number;
  oneShotRate?: number | null;
}

interface RawProject {
  name?: string;
  path?: string;
  cost?: number;
}

interface RawTopSession {
  id?: string;
  sessionId?: string;
  date?: string;
  project?: string;
  cost?: number;
  calls?: number;
  turns?: number;
}

interface RawModel {
  name?: string;
  cost?: number;
  calls?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

interface RawNameCalls { name?: string; calls?: number }

interface RawPeriodData {
  overview?: RawOverview;
  summary?: RawOverview;
  activities?: RawActivity[];
  projects?: RawProject[];
  topSessions?: RawTopSession[];
  daily?: Array<{ date: string; cost: number; sessions?: number; calls?: number }>;
  models?: RawModel[];
  tools?: RawNameCalls[];
  shellCommands?: RawNameCalls[];
}

function getPeriodData(raw: unknown, period: string): RawPeriodData {
  if (typeof raw !== "object" || raw === null) return {};
  const r = raw as Record<string, unknown>;
  // 8days uses codeburn's rolling-week storage key (rawJson.week).
  if (period === "8days") {
    return ((r.week as RawPeriodData | undefined) ?? {}) as RawPeriodData;
  }
  if ("all" in r || "today" in r) {
    return (r[period] ?? r.all ?? {}) as RawPeriodData;
  }
  return r as RawPeriodData;
}

function computeOneShotRate(activities: RawActivity[]): number {
  const withRate = activities.filter((a) => a.oneShotRate != null);
  const totalTurns = withRate.reduce((s, a) => s + (a.turns ?? a.sessions ?? 1), 0);
  const weighted = withRate.reduce(
    (s, a) => s + ((a.oneShotRate! / 100) * (a.turns ?? a.sessions ?? 1)),
    0
  );
  return totalTurns > 0 ? weighted / totalTurns : 0;
}

function computePrevCostPerSession(
  allDaily: Array<{ date: string; cost: number; sessions?: number }>,
  period: Period
): number | null {
  if (period === "all") return null;
  const n = period === "today" ? 1 : period === "8days" ? 8 : 30;
  const sorted = [...allDaily].sort((a, b) => b.date.localeCompare(a.date));
  const prev = sorted.slice(n, n * 2);
  const cost = prev.reduce((s, d) => s + d.cost, 0);
  const sessions = prev.reduce((s, d) => s + (d.sessions ?? 0), 0);
  return sessions > 0 ? cost / sessions : null;
}

export async function GET(req: NextRequest) {
  const session = IS_LOCAL_MODE ? null : await getServerSession(authOptions);
  const authedEmail = await getAuthedEmail(session?.user?.email);
  if (!authedEmail)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // team 격리. owner 면 viewAs cookie, 일반 user 는 currentTeamId. LOCAL_MODE 는 null.
  const effectiveTeamId = IS_LOCAL_MODE
    ? null
    : await getEffectiveTeamId(session, req);
  if (!IS_LOCAL_MODE && !effectiveTeamId) {
    return NextResponse.json({ error: "no_team" }, { status: 403 });
  }

  const period = (req.nextUrl.searchParams.get("period") ?? "all") as Period;

  // 멤버 list — effectiveTeam 의 멤버만. user_snapshots / user_blocks / daily_visits
  // 도 모두 team-scoped (team_id 컬럼 NOT NULL).
  const teamMemberIdRows = IS_LOCAL_MODE
    ? []
    : await db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, effectiveTeamId!), isNull(teamMembers.deletedAt)));
  const teamMemberIds = teamMemberIdRows.map((r) => r.userId);
  const allUsers = IS_LOCAL_MODE
    ? await db.select().from(users)
    : teamMemberIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, teamMemberIds))
      : [];
  const userSnapTeamScope = IS_LOCAL_MODE ? undefined : eq(userSnapshots.teamId, effectiveTeamId!);
  const dailyVisitsTeamScope = IS_LOCAL_MODE ? undefined : eq(dailyVisits.teamId, effectiveTeamId!);
  const userBlocksTeamScope = IS_LOCAL_MODE ? undefined : eq(userBlocks.teamId, effectiveTeamId!);

  const allSnaps = IS_LOCAL_MODE
    ? await db.select().from(userSnapshots)
    : teamMemberIds.length > 0
      ? await db
          .select()
          .from(userSnapshots)
          .where(and(inArray(userSnapshots.userId, teamMemberIds), userSnapTeamScope))
      : [];

  const snapMap = new Map(allSnaps.map((s) => [s.userId, s]));

  // 이번 달 visit/dwell 집계 (UTC 기준 YYYY-MM-01 부터). engagement 카드의
  // monthVisits/avgDwellSec 표시용.
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;
  const visitsThisMonth = await db
    .select({
      userId: dailyVisits.userId,
      count: dailyVisits.count,
      dwell: dailyVisits.totalDwellSeconds,
    })
    .from(dailyVisits)
    .where(and(gte(dailyVisits.date, monthStart), dailyVisitsTeamScope));
  const visitAgg = new Map<number, { count: number; dwell: number }>();
  for (const r of visitsThisMonth) {
    const cur = visitAgg.get(r.userId) ?? { count: 0, dwell: 0 };
    cur.count += r.count;
    cur.dwell += r.dwell;
    visitAgg.set(r.userId, cur);
  }

  // 30일 일별 방문 매트릭스 — ENGAGEMENT 카드 일별 그리드용.
  // (멤버 × 날짜) count. 0 인 셀은 응답에 0 으로 채움 (UI 에서 dot 표시).
  const visit30Start = new Date(Date.now() - 30 * 86_400_000);
  const visit30StartYmd = visit30Start.toISOString().slice(0, 10);
  const visits30d = await db
    .select({ userId: dailyVisits.userId, date: dailyVisits.date, count: dailyVisits.count })
    .from(dailyVisits)
    .where(and(gte(dailyVisits.date, visit30StartYmd), dailyVisitsTeamScope));
  const visit30AggByUser = new Map<number, Record<string, number>>();
  for (const r of visits30d) {
    if (!visit30AggByUser.has(r.userId)) visit30AggByUser.set(r.userId, {});
    visit30AggByUser.get(r.userId)![r.date] = r.count;
  }
  // 30일치 날짜 라벨 (오늘부터 거꾸로 30일).
  const visit30Dates: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    visit30Dates.push(d.toISOString().slice(0, 10));
  }

  // user_blocks 기반 멤버별 분당 토큰 집계. period 별 윈도우는 dashboard 와 동일.
  // today 면 빈 Map (효율성 테이블에 0 표시되거나 ─ 으로 표기).
  const blocksWindowStart = (() => {
    const now = new Date();
    switch (period) {
      case "today": return null;
      case "month": return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      case "8days": return new Date(now.getTime() - 8 * 86_400_000);
      case "30days": return new Date(now.getTime() - 30 * 86_400_000);
      case "all": return new Date(now.getTime() - 90 * 86_400_000);
      default: return new Date(now.getTime() - 30 * 86_400_000);
    }
  })();
  const blockRows = blocksWindowStart
    ? await db
        .select({
          userId: userBlocks.userId,
          minutes: userBlocks.minutes,
          totalTokens: userBlocks.totalTokens,
        })
        .from(userBlocks)
        .where(and(gte(userBlocks.startedAt, blocksWindowStart), userBlocksTeamScope))
    : [];
  const blocksAgg = new Map<number, { totalMinutes: number; totalTokens: number; count: number }>();
  for (const r of blockRows) {
    const cur = blocksAgg.get(r.userId) ?? { totalMinutes: 0, totalTokens: 0, count: 0 };
    cur.totalMinutes += r.minutes;
    cur.totalTokens += Number(r.totalTokens ?? 0);
    cur.count += 1;
    blocksAgg.set(r.userId, cur);
  }

  // Accumulators for team-level aggregations
  const activityAgg = new Map<string, { totalCost: number; totalTurns: number; members: Set<number> }>();
  const dailyMemberMap = new Map<string, Record<string, number>>();
  // 멤버별 일별 토큰 — 토큰 단가 그래프 (가격 / 일별 토큰) 분모용.
  const dailyTokensMemberMap = new Map<string, Record<string, number>>();
  const allTopSessions: Array<{ userId: number; userName: string; id: string; date: string; project: string; cost: number; calls: number }> = [];
  const modelAgg = new Map<string, { cost: number; calls: number; cacheRead: number; cacheWrite: number; input: number }>();
  const toolAgg = new Map<string, number>();
  const shellAgg = new Map<string, number>();

  const memberStats = allUsers
    .map((u) => {
      const snap = snapMap.get(u.id);
      if (!snap) return null;

      let totalCost: number;
      let sessionsCount: number;
      let cacheHitPct: number;
      let overallOneShot: number;
      let callsCount: number;
      let outputInputRatio: number;
      let topProject: string;

      const d = getPeriodData(snap.rawJson, period);
      const dAll = getPeriodData(snap.rawJson, "all");

      // ccusage daily extraction — stale check / token 합산 / 오늘 보정 모두에서 사용.
      // ccusage 19.x 에서 row 키가 'date' → 'period' 로 breaking change. 한 팀 안에
      // 옛/새 형식 사용자 섞일 수 있으므로 normalize. (dashboard route 와 동일 패턴)
      const ccusageDaily = (
        ((snap.rawJson as Record<string, unknown>).ccusageDaily as
          | { daily?: Array<{ date?: string; period?: string; totalTokens?: number; totalCost?: number }> }
          | undefined)?.daily ?? []
      ).map((r) => ({ ...r, date: r.date ?? r.period }));

      // "오늘" 보정 — codeburn 은 UTC 기준이라 KST/SGT 사용자에서 UTC 자정 ~ 사용자
      // 자정 사이엔 today.daily 가 비어있거나 어제 (UTC) 날짜로 들어옴. ccusage 의
      // 최신 날짜가 더 미래면 그 행을 사용자 로컬 today 로 채택. (dashboard route 의
      // line 301-317 과 동일 로직 — Junghwan 같은 KST 사용자가 0 으로 표시되던 버그.)
      let rawDaily = d.daily ?? [];
      let todayOverrideCost: number | null = null;
      if (period === "today" && ccusageDaily.length > 0) {
        const sortedCc = [...ccusageDaily]
          .filter((r) => !!r.date)
          .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
        const latestCc = sortedCc[sortedCc.length - 1];
        const latestCb = rawDaily[rawDaily.length - 1]?.date;
        if (latestCc?.date && (!latestCb || latestCc.date > latestCb)) {
          const ccCost = (latestCc as { totalCost?: number }).totalCost ?? 0;
          rawDaily = [{ date: latestCc.date, cost: ccCost, sessions: 0 }];
          todayOverrideCost = ccCost;
        }
      }

      // Stale month/day check — codeburn 에서 옛 달/날짜 데이터만 가진 멤버를 0 으로
      // 처리. 원래는 firstDailyDate (배열 [0] element) 만 봤지만, codeburn 의 daily
      // 는 오래된 날짜가 앞 (ascending) 이라 KST/SGT 사용자처럼 어제 + 오늘 두 날짜를
      // 모두 가진 정상 멤버를 stale 로 오탐 (firstDailyDate=어제, currentDayKey=오늘 UTC).
      // 가장 최근 (latest) 날짜로 판단해야 정확.
      const dailyDates = rawDaily
        .map((day) => day.date)
        .filter((s): s is string => !!s);
      const latestDailyDate = dailyDates.length > 0
        ? dailyDates.reduce((a, b) => (a > b ? a : b))
        : undefined;
      const nowUtc = new Date().toISOString();
      const currentMonthKey = nowUtc.slice(0, 7);   // "YYYY-MM"
      const currentDayKey = nowUtc.slice(0, 10);    // "YYYY-MM-DD"
      const isStale = (() => {
        if (!latestDailyDate) return false;
        if (period === "month") return !latestDailyDate.startsWith(currentMonthKey);
        if (period === "today") {
          // 오늘 보정 적용된 경우 ccusage 의 future UTC 날짜일 수 있어 검사 건너뜀.
          if (todayOverrideCost !== null) return false;
          // 가장 최근 날짜가 오늘 UTC 이전이면 stale (어제+오늘 정상 케이스는 not stale).
          return latestDailyDate < currentDayKey;
        }
        return false;
      })();

      const ccusageMissing =
        (snap.rawJson as Record<string, unknown> | null)?.ccusageMissing === true;

      const v = visitAgg.get(u.id) ?? { count: 0, dwell: 0 };
      const monthVisits = v.count;
      const avgDwellSec = v.count > 0 ? Math.round(v.dwell / v.count) : 0;

      if (isStale) {
        return {
          userId: u.id,
          name: u.name,
          avatarUrl: u.avatarUrl,
          lastSyncedAt: u.lastSyncedAt?.toISOString() ?? null,
          totalCost: 0,
          totalTokens: 0,
          sessionsCount: 0,
          cacheHitPct: 0,
          overallOneShot: 0,
          efficiencyScore: 0,
          topProject: "",
          callsCount: 0,
          outputInputRatio: 0,
          prevCostPerSession: null,
          avgDailyTokens: 0,
          memberActiveDays: 0,
          ccusageMissing,
          monthVisits,
          avgDwellSec,
          tokensPerMinute: null,
        };
      }

      // period="today" 면 사용자 timezone 기준 strict today 의 ccusage 행 1개만 사용.
      // codeburn today period 가 UTC 기준이라 KST/SGT 사용자에서 어제 + 오늘 두 날짜를
      // spillover 로 포함하는 문제 회피 (사용자 직관 "오늘 = 오늘 하루" 일치).
      const strictToday = (() => {
        if (period !== "today") return null;
        const tz = u.timezone ?? "UTC";
        let todayDate: string;
        try {
          todayDate = new Date().toLocaleDateString("en-CA", { timeZone: tz });
        } catch {
          todayDate = new Date().toISOString().slice(0, 10);
        }
        const row = ccusageDaily.find((r) => r.date === todayDate);
        return {
          date: todayDate,
          tokens: row?.totalTokens ?? 0,
          cost: (row as { totalCost?: number } | undefined)?.totalCost ?? 0,
        };
      })();

      // tokens — period="today" 면 strict today, 그 외엔 periodDates filter.
      const periodDates = new Set(rawDaily.map((day) => day.date));
      const totalTokens = strictToday
        ? strictToday.tokens
        : ccusageDaily
            .filter((row) => row.date && periodDates.has(row.date))
            .reduce((s, row) => s + (row.totalTokens ?? 0), 0);

      if (period === "all") {
        totalCost = snap.totalCost;
        sessionsCount = snap.sessionsCount;
        overallOneShot = snap.overallOneShot;
        const ov = d.overview ?? d.summary ?? {};
        callsCount = ov.calls ?? snap.callsCount;
        const tIn = ov.tokens?.input ?? 0;
        const tOut = ov.tokens?.output ?? 0;
        const tRead = ov.tokens?.cacheRead ?? 0;
        const tWrite = ov.tokens?.cacheWrite ?? 0;
        cacheHitPct = (tRead + tWrite + tIn) > 0
          ? (tRead / (tRead + tWrite + tIn)) * 100
          : snap.cacheHitPct;
        outputInputRatio = tIn > 0 ? tOut / tIn : 1;
        topProject = (d.projects ?? []).sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0]?.name ?? "unknown";
      } else {
        const ov = d.overview ?? d.summary ?? {};
        // cost 우선순위:
        //   1) period="today" → strict today ccusage cost (사용자 timezone 기준 오늘 행)
        //   2) "오늘 보정" override 적용된 경우 → ccusage 의 latest 행 cost
        //   3) 8days/month/30days → period 안의 ccusage daily cost 합산.
        //      ccusage 가 있는 날짜는 ccusage cost, 없는 날짜는 codeburn day.cost
        //      (dashboard route 의 correctedTotalCost 패턴과 동일).
        //   4) ccusage 가 한 행도 없으면 codeburn overview cost.
        const ccusageCostMap = new Map<string, number>();
        for (const row of ccusageDaily) {
          if (row.date) {
            ccusageCostMap.set(row.date, (row as { totalCost?: number }).totalCost ?? 0);
          }
        }
        const periodCostFromDaily = rawDaily.reduce(
          (s, day) => s + (ccusageCostMap.get(day.date) ?? day.cost ?? 0),
          0
        );
        totalCost = strictToday
          ? strictToday.cost
          : (todayOverrideCost !== null
            ? todayOverrideCost
            : (ccusageDaily.length > 0
              ? periodCostFromDaily
              : (ov.cost ?? ov.totalCost ?? 0)));
        sessionsCount = ov.sessions ?? ov.totalSessions ?? 0;
        overallOneShot = computeOneShotRate(d.activities ?? []);
        callsCount = ov.calls ?? 0;
        const tIn = ov.tokens?.input ?? 0;
        const tOut = ov.tokens?.output ?? 0;
        const tRead = ov.tokens?.cacheRead ?? 0;
        const tWrite = ov.tokens?.cacheWrite ?? 0;
        cacheHitPct = (tRead + tWrite + tIn) > 0
          ? (tRead / (tRead + tWrite + tIn)) * 100
          : 0;
        outputInputRatio = tIn > 0 ? tOut / tIn : 1;
        topProject = (d.projects ?? []).sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0]?.name ?? "unknown";
      }

      // Trend: prev period $/session from all-time daily data
      const allDailyData = dAll.daily ?? [];
      const prevCostPerSession = computePrevCostPerSession(allDailyData, period);

      // Aggregate activities for team view
      for (const a of d.activities ?? []) {
        const name = a.name ?? a.category ?? "Unknown";
        const cost = a.cost ?? 0;
        const turns = a.turns ?? a.sessions ?? 0;
        if (!activityAgg.has(name)) {
          activityAgg.set(name, { totalCost: 0, totalTurns: 0, members: new Set() });
        }
        const entry = activityAgg.get(name)!;
        entry.totalCost += cost;
        entry.totalTurns += turns;
        entry.members.add(u.id);
      }

      // Aggregate daily by member — key by id to handle duplicate names.
      // rawDaily 는 오늘 보정이 적용된 daily (period=today + KST/SGT 사용자).
      const memberKey = `${u.name}__${u.id}`;
      for (const day of rawDaily) {
        if (!dailyMemberMap.has(day.date)) {
          dailyMemberMap.set(day.date, {});
        }
        const existing = dailyMemberMap.get(day.date)!;
        existing[memberKey] = (existing[memberKey] ?? 0) + day.cost;
      }

      // 멤버별 일별 토큰 — ccusageDaily 우선, 없으면 codeburn d.daily.tokens.
      const dailyTokensSource: Array<{ date?: string; totalTokens?: number; tokens?: number }> =
        ccusageDaily.length > 0
          ? ccusageDaily
          : ((d.daily ?? []) as Array<{ date?: string; tokens?: number }>);
      for (const row of dailyTokensSource) {
        if (!row.date) continue;
        const tk = (row.totalTokens ?? row.tokens ?? 0);
        if (tk <= 0) continue;
        if (!dailyTokensMemberMap.has(row.date)) {
          dailyTokensMemberMap.set(row.date, {});
        }
        dailyTokensMemberMap.get(row.date)![memberKey] = tk;
      }

      // Aggregate by model
      for (const m of d.models ?? []) {
        const name = m.name ?? "unknown";
        const entry = modelAgg.get(name) ?? { cost: 0, calls: 0, cacheRead: 0, cacheWrite: 0, input: 0 };
        entry.cost += m.cost ?? 0;
        entry.calls += m.calls ?? 0;
        entry.cacheRead += m.cacheReadTokens ?? 0;
        entry.cacheWrite += m.cacheWriteTokens ?? 0;
        entry.input += m.inputTokens ?? 0;
        modelAgg.set(name, entry);
      }

      // Aggregate tools and shell commands
      for (const t of d.tools ?? []) {
        if (t.name) toolAgg.set(t.name, (toolAgg.get(t.name) ?? 0) + (t.calls ?? 0));
      }
      for (const s of d.shellCommands ?? []) {
        if (s.name) shellAgg.set(s.name, (shellAgg.get(s.name) ?? 0) + (s.calls ?? 0));
      }

      const efficiencyScore = computeEfficiencyScore(overallOneShot, cacheHitPct, totalCost, sessionsCount, callsCount, outputInputRatio);

      for (const s of d.topSessions ?? []) {
        allTopSessions.push({
          userId: u.id,
          userName: u.name,
          id: s.id ?? s.sessionId ?? "",
          date: s.date ?? "",
          project: s.project ?? "",
          cost: s.cost ?? 0,
          calls: s.calls ?? s.turns ?? 0,
        });
      }

      const blocksOfUser = blocksAgg.get(u.id);
      const tokensPerMinute = blocksOfUser && blocksOfUser.totalMinutes > 0
        ? Math.round(blocksOfUser.totalTokens / blocksOfUser.totalMinutes)
        : null;

      // 사용량 (token volume) — 개인 EFFICIENCY 카드의 "사용량" 과 동일 정의.
      // period 내 활성일 = d.daily 중 cost > 0 인 날. totalTokens / activeDays.
      const memberActiveDays = (d.daily ?? []).filter((day) => (day.cost ?? 0) > 0).length;
      const avgDailyTokens = memberActiveDays > 0 ? totalTokens / memberActiveDays : 0;

      return {
        userId: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        lastSyncedAt: u.lastSyncedAt?.toISOString() ?? null,
        totalCost,
        sessionsCount,
        cacheHitPct,
        overallOneShot,
        efficiencyScore,
        topProject,
        callsCount,
        outputInputRatio,
        prevCostPerSession,
        totalTokens,
        avgDailyTokens,
        memberActiveDays,   // ov 기반 활성일 (fallback 용)
        ccusageMissing,
        monthVisits,
        avgDwellSec,
        tokensPerMinute,
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  const byEfficiency = [...memberStats].sort((a, b) => b.efficiencyScore - a.efficiencyScore);

  // period → days 환산. all 은 retention 한계 (90일) 로 cap.
  const periodDays = (() => {
    const now = new Date();
    switch (period) {
      case "today": return 1;
      case "8days": return 8;
      case "month": {
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        return Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 86_400_000));
      }
      case "30days": return 30;
      case "all": return 90;
      default: return 30;
    }
  })();

  // Team Plan Health — 멤버별 plan 적정성. period 비례 정규화.
  const planBlocksWindowStart = (() => {
    const now = new Date();
    switch (period) {
      case "today": return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      case "month": return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      case "8days": return new Date(now.getTime() - 8 * 86_400_000);
      case "30days": return new Date(now.getTime() - 30 * 86_400_000);
      case "all": return new Date(now.getTime() - 90 * 86_400_000);
      default: return new Date(now.getTime() - 30 * 86_400_000);
    }
  })();
  const planBlockRows = await db
    .select({
      userId: userBlocks.userId,
      totalTokens: userBlocks.totalTokens,
      startedAt: userBlocks.startedAt,
    })
    .from(userBlocks)
    .where(and(gte(userBlocks.startedAt, planBlocksWindowStart), userBlocksTeamScope));
  const planBlocksByUser = new Map<number, Array<{ totalTokens: number; startedAt: Date }>>();
  for (const r of planBlockRows) {
    const arr = planBlocksByUser.get(r.userId) ?? [];
    arr.push({ totalTokens: Number(r.totalTokens ?? 0), startedAt: r.startedAt });
    planBlocksByUser.set(r.userId, arr);
  }

  // 30일 cost (period 무관) — tier 추정의 보조 신호. user_blocks 의 cost_usd
  // 30일 합. period 가 today 라도 추정은 항상 30일 anchor 로 안정적.
  const cost30dWindowStart = new Date(Date.now() - 30 * 86_400_000);
  const cost30dRows = await db
    .select({ userId: userBlocks.userId, costUsd: userBlocks.costUsd })
    .from(userBlocks)
    .where(and(gte(userBlocks.startedAt, cost30dWindowStart), userBlocksTeamScope));
  const monthlyCostByUser = new Map<number, number>();
  for (const r of cost30dRows) {
    monthlyCostByUser.set(r.userId, (monthlyCostByUser.get(r.userId) ?? 0) + Number(r.costUsd ?? 0));
  }
  const memberHealthList: Array<{
    userId: number;
    name: string;
    health: ReturnType<typeof analyzePlanHealth>;
    isEstimated: boolean;
  }> = [];
  // memberStats lookup — today/8days fallback 에 ov 기반 totalTokens 사용.
  const memberStatsById = new Map(memberStats.map((m) => [m.userId, m]));

  // 멤버별 활용지수 + tier (declared 또는 추정) — 새 카드 (활용지수 순위, 일별
  // 토큰 단가) 응답 데이터.
  type MemberUsageRow = {
    userId: number;
    name: string;
    memberKey: string;
    powerIndex: number;
    declaredTier: string | null;
    estimatedTier: string | null;
    effectiveTier: string | null;     // declared > estimated
    monthlyPriceUsd: number | null;   // effectiveTier 의 plan price
    isEstimated: boolean;             // true 면 추정 (UI 에서 점선 / "(추정)" 표시)
    activeDays: number;
    totalTokens: number;
  };
  const memberUsage: MemberUsageRow[] = [];

  // 팀 합산 활용지수 + 토큰 단가 — period 비례 정규화 + today fallback.
  //   teamPowerIndex = 멤버 power score 평균 (활성 멤버만)
  //   teamUnitCost = sum(priceForPeriod) / sum(totalWindowTokens) × 1M
  let teamPowerSum = 0;
  let teamPowerCount = 0;
  let teamPriceForPeriodSum = 0;
  let teamTokensSum = 0;
  let teamActiveDaysSum = 0;
  let teamAvgDailyTokensSum = 0;
  for (const u of allUsers) {
    const snap = snapMap.get(u.id);
    const blocks = planBlocksByUser.get(u.id) ?? [];
    const declared = (u.planTier ?? null) as PlanTier;

    // 추정 tier — 30일 cost 만 사용. P90 token 신호는 cache_read 포함이라
    // 한도 (220k non-cache 기준) 와 단위 불일치 → 거의 항상 max20 분류되어
    // cost 신호를 묻어버림 → 폐기. cost 단독 + 보수적 임계 (Pro $176 케이스
    // 보호) 로 정확도 ↑.
    const monthlyCost30d = monthlyCostByUser.get(u.id) ?? 0;
    const combinedEstimateTier = estimateTierFromMonthlyCost(monthlyCost30d);
    const isEstimatedMember = declared === null && combinedEstimateTier !== "unknown";
    const effectiveDeclared: PlanTier = declared ?? (isEstimatedMember ? (combinedEstimateTier as Exclude<PlanTier, null>) : null);

    const health = analyzePlanHealth({
      blocks,
      declaredTier: effectiveDeclared,
      cacheHitPct: snap?.cacheHitPct ?? undefined,
      oneShotRate: snap?.overallOneShot != null ? snap.overallOneShot * 100 : undefined,
      windowDays: periodDays,
      // cost-based verdict 신호 — 멤버의 최근 30일 API 환산 비용.
      monthlyCostUsd: monthlyCost30d,
    });
    memberHealthList.push({ userId: u.id, name: u.name, health, isEstimated: isEstimatedMember });

    // user_blocks 기반 1차 집계
    const memActiveDates = new Set(blocks.map((b) => b.startedAt.toISOString().slice(0, 10)));
    const blockActiveDays = memActiveDates.size;
    const blockTotalTokens = blocks.reduce((s, b) => s + b.totalTokens, 0);

    // today/8days fallback — user_blocks 가 5h 종료 후 저장이라 진행 중 블록은
    // 미포함. overview 가 명백히 크면 ov 값 사용 (개인 dashboard 와 동일 패턴).
    const member = memberStatsById.get(u.id);
    const ovTokens = member?.totalTokens ?? 0;
    const ovActiveDays = member?.memberActiveDays ?? 0;
    const useOvFallback = ovTokens > blockTotalTokens * 1.5;
    const effectiveTokens = useOvFallback ? ovTokens : blockTotalTokens;
    // periodDays 로 cap — codeburn/ccusage merge 가 boundary day 포함해
    // 9/8일 같은 비정상 값 방어.
    const effectiveActiveDays = Math.min(
      periodDays,
      useOvFallback ? Math.max(blockActiveDays, ovActiveDays) : blockActiveDays
    );

    // 활용지수 — 활성 멤버만 (effectiveActiveDays > 0).
    let memScore = 0;
    if (effectiveActiveDays > 0 && effectiveTokens > 0) {
      const memAvgDailyTokens = effectiveTokens / effectiveActiveDays;
      memScore = computePowerIndex(effectiveActiveDays, memAvgDailyTokens, periodDays);
      teamPowerSum += memScore;
      teamPowerCount += 1;
      teamActiveDaysSum += effectiveActiveDays;
      teamAvgDailyTokensSum += memAvgDailyTokens;
    }

    // Effective tier 는 위에서 health 계산 시 결정함 (effectiveDeclared).
    // memberUsage 응답엔 declared / estimated / effective 모두 노출.
    const estimatedTierForUsage = isEstimatedMember
      ? (combinedEstimateTier as Exclude<PlanTier, null>)
      : null;
    const effectiveLimits = effectiveDeclared
      ? getPlanLimits(effectiveDeclared as Exclude<PlanTier, null>)
      : null;
    const monthlyPriceUsd = effectiveLimits?.monthlyPriceUsd ?? null;

    memberUsage.push({
      userId: u.id,
      name: u.name,
      memberKey: `${u.name}__${u.id}`,
      powerIndex: memScore,
      declaredTier: declared ?? null,
      estimatedTier: estimatedTierForUsage,
      effectiveTier: effectiveDeclared ?? null,
      monthlyPriceUsd,
      isEstimated: isEstimatedMember,
      activeDays: effectiveActiveDays,
      totalTokens: effectiveTokens,
    });

    // 토큰 단가 — 팀 합산 price / 합산 tokens. 추정 tier 도 포함 (UI 에서 명시).
    if (monthlyPriceUsd !== null && monthlyPriceUsd > 0 && effectiveTokens > 0) {
      teamPriceForPeriodSum += (monthlyPriceUsd * periodDays) / 30;
      teamTokensSum += effectiveTokens;
    }
  }
  const teamPlanHealth = summarizeTeamPlans(memberHealthList);

  const teamUsage = {
    periodDays,
    // 팀 활용지수 — 활성 멤버 평균. 활성 멤버 없으면 0.
    powerIndex: teamPowerCount > 0 ? Math.round(teamPowerSum / teamPowerCount) : 0,
    activeMembers: teamPowerCount,
    avgActiveDays: teamPowerCount > 0 ? teamActiveDaysSum / teamPowerCount : 0,
    avgDailyTokens: teamPowerCount > 0 ? teamAvgDailyTokensSum / teamPowerCount : 0,
    // 팀 토큰 단가 — 팀 합산 priceForPeriod / 합산 토큰. tier 입력 멤버 없으면 null.
    priceForPeriodSum: teamPriceForPeriodSum > 0 ? teamPriceForPeriodSum : null,
    totalWindowTokensSum: teamTokensSum,
  };

  const bySessions = [...memberStats].sort((a, b) => b.sessionsCount - a.sessionsCount);

  const teamSummary = {
    totalCost: memberStats.reduce((s, m) => s + m.totalCost, 0),
    totalSessions: memberStats.reduce((s, m) => s + m.sessionsCount, 0),
    activeMemberCount: memberStats.length,
    avgCacheHitPct: memberStats.length > 0
      ? memberStats.reduce((s, m) => s + m.cacheHitPct, 0) / memberStats.length
      : 0,
    avgOneShotRate: memberStats.length > 0
      ? memberStats.reduce((s, m) => s + m.overallOneShot, 0) / memberStats.length
      : 0,
  };

  // Team daily (sum across all members)
  const dailyMap = new Map<string, number>();
  for (const [date, memberCosts] of dailyMemberMap.entries()) {
    dailyMap.set(date, Object.values(memberCosts).reduce((s, v) => s + v, 0));
  }
  const daily = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cost]) => ({ date, cost }));

  // 일별 토큰 단가 멤버별 — 각 멤버 monthlyPrice/30 / 일별 토큰 × 1M.
  // 활동 없는 날은 null (line 끊김). declared+estimated 모두 포함, UI 에서 시각 구분.
  // period 와 무관하게 전체 보유 일자 표시 (30일 추세 의도 — 사용자 결정 2026-05-21).
  const allTokenDates = [...dailyTokensMemberMap.keys()].sort();
  const dailyUnitCostByMember = allTokenDates.map((date) => {
    const row: Record<string, number | string | null> = { date };
    const tokensMap = dailyTokensMemberMap.get(date) ?? {};
    for (const m of memberUsage) {
      const dailyTokens = tokensMap[m.memberKey] ?? 0;
      if (m.monthlyPriceUsd && m.monthlyPriceUsd > 0 && dailyTokens > 0) {
        const usdPerDay = m.monthlyPriceUsd / 30;
        row[m.memberKey] = (usdPerDay / dailyTokens) * 1_000_000;
      } else {
        row[m.memberKey] = null;
      }
    }
    return row;
  });

  // Team activities (top 10 by turns)
  // memberKeys are "name__userId" to handle duplicate display names
  const memberNames = byEfficiency.map((m) => `${m.name}__${m.userId}`);
  const teamActivities = [...activityAgg.entries()]
    .map(([name, { totalCost, totalTurns, members }]) => ({
      name,
      totalCost,
      totalTurns,
      memberCount: members.size,
    }))
    .sort((a, b) => b.totalTurns - a.totalTurns)
    .slice(0, 10);

  // Daily by member (for stacked area).
  // period="today" 면 가장 최근 1일 (latest date) 만 — codeburn 의 today bucket 이
  // KST/SGT 사용자에서 어제+오늘 spillover 되는 케이스 제거. 사용자 직관 "오늘 = 1일" 일치.
  const allDates = [...dailyMemberMap.keys()].sort();
  const dailyDates = period === "today" && allDates.length > 0
    ? [allDates[allDates.length - 1]]
    : allDates;
  const dailyByMember = dailyDates.map((date) => {
    const row: Record<string, number | string> = { date };
    for (const name of memberNames) {
      row[name] = dailyMemberMap.get(date)?.[name] ?? 0;
    }
    return row;
  });

  const topSessions = allTopSessions
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 15);

  const teamModels = [...modelAgg.entries()]
    .map(([name, agg]) => {
      const denom = agg.input + agg.cacheRead + agg.cacheWrite;
      const cacheHitPct = denom > 0 ? (agg.cacheRead / denom) * 100 : 0;
      return { name, cost: agg.cost, calls: agg.calls, cacheHitPct };
    })
    .sort((a, b) => b.cost - a.cost);

  const teamTools = [...toolAgg.entries()]
    .map(([name, calls]) => ({ name, calls }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 10);

  const teamShellCommands = [...shellAgg.entries()]
    .map(([name, calls]) => ({ name, calls }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 10);

  // Industry comparison (최근 30일).
  // 외부 (Anthropic/엔터/ccusage) 와 비교할 우리 팀 통계:
  //  - active day cost: 각 (멤버, 활성일) 의 cost 분포 → avg, p50/75/90, max
  //  - per-dev monthly: 각 멤버의 최근 30일 합 → avg, max
  // 데이터 source: ccusage daily 우선, 없으면 codeburn all.daily (heatmap 과 동일).
  const today30 = new Date();
  const thirtyAgo = new Date(today30);
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const thirtyAgoYmd = thirtyAgo.toISOString().slice(0, 10);

  const teamActiveDayCosts: number[] = [];
  const perDevMonthly: number[] = [];
  for (const u of allUsers) {
    const snap = snapMap.get(u.id);
    if (!snap) continue;
    const raw = snap.rawJson as Record<string, unknown>;
    const ccusage = (raw.ccusageDaily as { daily?: Array<{ date?: string; totalCost?: number }> } | undefined)?.daily ?? [];
    const codeburn = ((raw.all as { daily?: Array<{ date?: string; cost?: number }> } | undefined)?.daily) ?? [];
    const source: Array<{ date?: string; totalCost?: number; cost?: number }> =
      ccusage.length > 0 ? ccusage : codeburn;
    let userMonthSum = 0;
    for (const row of source) {
      if (!row.date || row.date < thirtyAgoYmd) continue;
      const cost = row.totalCost ?? row.cost ?? 0;
      if (cost > 0) {
        teamActiveDayCosts.push(cost);
        userMonthSum += cost;
      }
    }
    if (userMonthSum > 0) perDevMonthly.push(userMonthSum);
  }
  teamActiveDayCosts.sort((a, b) => a - b);
  const pct = (arr: number[], p: number) =>
    arr.length === 0 ? 0 : arr[Math.floor((arr.length - 1) * p)];
  const sum = (arr: number[]) => arr.reduce((s, c) => s + c, 0);
  const industryComparison = {
    windowDays: 30,
    activeDayCount: teamActiveDayCosts.length,
    activeDayAvg: teamActiveDayCosts.length > 0
      ? sum(teamActiveDayCosts) / teamActiveDayCosts.length
      : 0,
    activeDayP50: pct(teamActiveDayCosts, 0.5),
    activeDayP75: pct(teamActiveDayCosts, 0.75),
    activeDayP90: pct(teamActiveDayCosts, 0.9),
    activeDayMax: teamActiveDayCosts.length > 0
      ? teamActiveDayCosts[teamActiveDayCosts.length - 1]
      : 0,
    perDevMonthAvg: perDevMonthly.length > 0
      ? sum(perDevMonthly) / perDevMonthly.length
      : 0,
    perDevMonthMax: perDevMonthly.length > 0 ? Math.max(...perDevMonthly) : 0,
  };

  // ─── 팀 효율 점수 (개인 점수 시스템과 동일 공식, 30일 풀링 집계) ───
  // 모든 멤버의 ccusage 토큰 + codeburn cost/calls/edit·oneShotTurns 를 합쳐
  // 단일 cache hit / cost-per-call / oneShotRate 산출 → computeDailyEfficiencyScore.
  // 개인 점수는 self-motivation, 팀 점수는 team identity. 같은 공식 다른 의미.
  let teamCacheRead = 0, teamCacheWrite = 0, teamInput = 0, teamOutput = 0;
  let teamCost30 = 0, teamCalls30 = 0;
  let teamEditTurns = 0, teamOneShotTurns = 0;
  const teamActiveMembers = new Set<number>();
  for (const u of allUsers) {
    const snap = snapMap.get(u.id);
    if (!snap) continue;
    const raw = snap.rawJson as Record<string, unknown>;
    const ccu = (raw.ccusageDaily as { daily?: Array<{ date?: string; inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheCreationTokens?: number }> } | undefined)?.daily ?? [];
    const cb = ((raw.all as { daily?: Array<{ date?: string; cost?: number; calls?: number; editTurns?: number; oneShotTurns?: number }> } | undefined)?.daily) ?? [];
    let userHadActivity = false;
    for (const r of ccu) {
      if (!r.date || r.date < thirtyAgoYmd) continue;
      teamCacheRead += r.cacheReadTokens ?? 0;
      teamCacheWrite += r.cacheCreationTokens ?? 0;
      teamInput += r.inputTokens ?? 0;
      teamOutput += r.outputTokens ?? 0;
      userHadActivity = true;
    }
    for (const r of cb) {
      if (!r.date || r.date < thirtyAgoYmd) continue;
      teamCost30 += r.cost ?? 0;
      teamCalls30 += r.calls ?? 0;
      teamEditTurns += r.editTurns ?? 0;
      teamOneShotTurns += r.oneShotTurns ?? 0;
    }
    if (userHadActivity) teamActiveMembers.add(u.id);
  }
  const teamCacheDenom = teamCacheRead + teamCacheWrite + teamInput;
  const teamCacheHitPct = teamCacheDenom > 0 ? (teamCacheRead / teamCacheDenom) * 100 : 0;
  const teamCostPerCall = teamCalls30 > 0 ? teamCost30 / teamCalls30 : 0;
  // codeburn 0.9.7 ↓ 또는 모든 멤버가 chat-only → null. computeDailyEfficiencyScore
  // 가 cache 85 + cost 15 fallback 으로 자동 처리.
  const teamOneShotRate = teamEditTurns > 0 ? (teamOneShotTurns / teamEditTurns) * 100 : null;
  // 팀 토큰 평균 — 활성 멤버당 일평균 (활성 멤버 × 30일 윈도우 기준).
  // 개인 점수와 동일 scale 로 비교 가능. 0 = 팀 전체 안 씀, 10/10 = 평균 멤버가 heavy day.
  const teamTokensTotal = teamCacheRead + teamCacheWrite + teamInput + teamOutput;
  const teamAvgDailyTokens = teamActiveMembers.size > 0
    ? teamTokensTotal / (teamActiveMembers.size * 30)
    : 0;
  const teamScoreValue = teamCacheDenom > 0
    ? computeDailyEfficiencyScore(teamCacheHitPct, teamCostPerCall, teamOneShotRate, teamAvgDailyTokens)
    : null;

  const teamScore = {
    score: teamScoreValue,
    cacheHitPct: teamCacheHitPct,
    costPerCall: teamCostPerCall,
    memberCount: byEfficiency.length,
    windowDays: 30,
  };

  return NextResponse.json({
    byEfficiency,
    bySessions,
    teamSummary,
    daily,
    teamActivities,
    dailyByMember,
    memberNames,
    topSessions,
    teamModels,
    teamTools,
    teamShellCommands,
    industryComparison,
    teamScore,
    teamPlanHealth,
    teamUsage,
    memberUsage,
    dailyUnitCostByMember,
    // 30일 일별 방문 매트릭스 — ENGAGEMENT 카드용
    dailyVisits30d: {
      dates: visit30Dates,
      byUser: Object.fromEntries(
        memberStats.map((m) => [
          m.userId,
          {
            name: m.name,
            counts: visit30Dates.map((d) => visit30AggByUser.get(m.userId)?.[d] ?? 0),
          },
        ])
      ),
    },
    isAdminUser: IS_LOCAL_MODE ? false : isAdmin(authedEmail),
  });
}
