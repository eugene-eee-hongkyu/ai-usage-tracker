"use client";

// 통합(Unified) 탭 — 개인 상단(요약/일별) + plan 절감 + 24주 히트맵 + 팀(활동/비용) 을
// 한 화면에. 추출한 공유 카드(src/components/cards/*)를 재사용하고, 두 API(/api/dashboard,
// /api/team)를 단일 period 토글로 함께 구동한다. 팀 없는 personal 사용자는 팀 영역 숨김.

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { useMessages } from "@/lib/use-i18n";
import { useProviderPreference } from "@/lib/use-provider-preference";
import { ProviderSegmentedControl } from "@/components/provider-segmented-control";
import { OverviewBar } from "@/components/cards/overview-bar";
import { DailyTokensCard } from "@/components/cards/daily-tokens-card";
import { DailyCostCard } from "@/components/cards/daily-cost-card";
import { PlanSavingsCard } from "@/components/cards/plan-savings-card";
import { ActivityHeatmapCard } from "@/components/cards/activity-heatmap-card";
import { TeamActivityCard } from "@/components/cards/team-activity-card";
import { TeamCostCard } from "@/components/cards/team-cost-card";
import { TeamByMemberCard } from "@/components/cards/team-by-member-card";
import { TeamTotalCard } from "@/components/cards/team-total-card";
import { type DashboardData, type Period, expectedDateRange } from "@/components/dashboard-view";
import { type TeamData, MEMBER_COLORS, dedupMembersByUserId } from "@/components/team-view";

const PERIODS: Period[] = ["today", "8days", "month", "30days", "all"];
function periodLabel(p: Period, locale: string): string {
  const ko: Record<Period, string> = { today: "오늘", "8days": "8일", month: "이번달", "30days": "30일", all: "전체" };
  const en: Record<Period, string> = { today: "Today", "8days": "8d", month: "Month", "30days": "30d", all: "All" };
  return (locale === "ko" ? ko : en)[p];
}

export function UnifiedView() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { locale } = useMessages();
  const [provider, setProvider] = useProviderPreference();

  const [period, setPeriodState] = useState<Period>("8days");
  const [periodReady, setPeriodReady] = useState(false);
  const [userTz, setUserTz] = useState<string>(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
  });
  const [showTzPicker, setShowTzPicker] = useState(false);

  const [dash, setDash] = useState<DashboardData | null>(null);
  const [team, setTeam] = useState<TeamData | null>(null);
  const [teamHidden, setTeamHidden] = useState(false); // 팀 없음(403) 등 → 팀 영역 숨김
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // period localStorage 초기화 (읽기 완료 후에만 fetch 허용)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("unified_period");
      const upgraded = saved === "week" ? "8days" : saved;
      if (upgraded && PERIODS.includes(upgraded as Period)) setPeriodState(upgraded as Period);
    } catch { /* ignore */ }
    setPeriodReady(true);
  }, []);

  const setPeriod = (p: Period) => {
    setPeriodState(p);
    try { localStorage.setItem("unified_period", p); } catch { /* ignore */ }
  };

  // 미인증 → 로그인
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  // dash.user.timezone 반영
  useEffect(() => {
    if (dash?.user?.timezone) setUserTz(dash.user.timezone);
  }, [dash?.user?.timezone]);

  // 두 API 동시 fetch
  useEffect(() => {
    if (!periodReady || status !== "authenticated") return;
    const ctrl = new AbortController();
    setLoading(true);
    setFetchError(false);
    const pq = `period=${period}${provider === "codex" ? "&provider=codex" : ""}`;

    const dashP = fetch(`/api/dashboard?${pq}`, { signal: ctrl.signal }).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });
    const teamP = fetch(`/api/team?${pq}`, { signal: ctrl.signal }).then(async (r) => {
      if (r.status === 403) return { __noTeam: true };
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });

    Promise.all([dashP, teamP])
      .then(([d, tm]) => {
        if (d?.error) { setFetchError(true); setLoading(false); return; }
        setDash(d);
        if (tm?.__noTeam || tm?.error) { setTeam(null); setTeamHidden(true); }
        else { setTeam(tm); setTeamHidden(false); }
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setFetchError(true);
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [status, period, provider, periodReady]);

  const saveTz = async (tz: string) => {
    setUserTz(tz);
    setShowTzPicker(false);
    await fetch("/api/user/timezone", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: tz }),
    });
  };

  const isShortPeriod = period === "today" || period === "8days" || period === "month";

  const shell = (inner: React.ReactNode) => (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <Nav />
      <div className="max-w-6xl mx-auto px-4 pt-3 pb-2">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <ProviderSegmentedControl
            value={provider}
            onChange={(p) => { if (p !== provider) { setDash(null); setTeam(null); } setProvider(p); }}
            hasClaudeData={true}
            hasCodexData={true}
            testIdPrefix="unified-provider"
          />
          <div className="flex gap-1" data-testid="unified-period-toggle">
            {PERIODS.map((p) => (
              <button
                key={p}
                data-testid={`unified-period-${p}`}
                onClick={() => setPeriod(p)}
                className={`text-xs font-mono px-2.5 py-1 rounded transition-colors ${
                  period === p ? "bg-indigo-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                }`}
              >{periodLabel(p, locale)}</button>
            ))}
          </div>
        </div>
      </div>
      {inner}
    </div>
  );

  if (status === "loading" || (loading && !dash && !fetchError)) {
    return shell(
      <div className="flex items-center justify-center h-64">
        <span data-testid="unified-loading" className="font-mono text-neutral-500 animate-pulse">loading...</span>
      </div>
    );
  }
  if (fetchError || !dash) {
    return shell(
      <div data-testid="unified-fetch-error" className="flex items-center justify-center h-64">
        <p className="text-neutral-400 font-mono text-sm">데이터를 불러오지 못했습니다</p>
      </div>
    );
  }

  // ── 개인 파생 ──
  const ov = dash.overview;
  const expectedDates = expectedDateRange(period, userTz, dash.snapshot);
  const dailyCostByFull: Record<string, { cost: number; sessions: number }> = {};
  for (const d of dash.daily) dailyCostByFull[d.date] = { cost: d.cost, sessions: d.sessions };
  const tokenByFull: Record<string, number> = {};
  for (const t of dash.dailyTokens ?? []) tokenByFull[t.date] = t.totalTokens;
  const sourceFullDates: string[] = expectedDates ?? dash.daily.map((d) => d.date);
  const chartData = sourceFullDates.map((fullDate) => {
    const row = dailyCostByFull[fullDate];
    return { date: fullDate.slice(5), cost: row?.cost ?? 0, sessions: row?.sessions ?? 0, empty: !row };
  });
  const chartTokenData = sourceFullDates.map((fullDate) => {
    const tokens = tokenByFull[fullDate] ?? 0;
    return { date: fullDate.slice(5), tokens, empty: tokens === 0 };
  });

  // ── 팀 파생 ──
  const teamBlocks = (() => {
    if (teamHidden || !team) return null;
    const members = dedupMembersByUserId(team.byEfficiency);
    const byCost = [...members].sort((a, b) => b.totalCost - a.totalCost);
    const byTokens = [...members].sort((a, b) => b.totalTokens - a.totalTokens);
    const maxCost = Math.max(...byCost.map((m) => m.totalCost), 0.01);
    const maxTokens = Math.max(...byTokens.map((m) => m.totalTokens), 1);
    const dailyTotal = (team.dailyByMember ?? []).map((row) => ({
      date: String(row.date),
      cost: (team.memberNames ?? []).reduce((s, key) => s + (Number(row[key]) || 0), 0),
    }));
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TeamActivityCard byTokens={byTokens} members={members} maxTokens={maxTokens} memberColors={MEMBER_COLORS} session={session} />
          <TeamCostCard byCost={byCost} members={members} maxCost={maxCost} selfName={session?.user?.name} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TeamByMemberCard dailyByMember={team.dailyByMember} memberNames={team.memberNames} />
          <TeamTotalCard dailyTotal={dailyTotal} />
        </div>
      </>
    );
  })();

  return shell(
    <main className="max-w-6xl mx-auto px-4 py-4 space-y-3">
      {/* 상단: 개인 요약 + 일별 */}
      {ov && (
        <OverviewBar
          viewOnly={false}
          user={dash.user}
          ov={ov}
          chartTokenData={chartTokenData}
          isShortPeriod={isShortPeriod}
          snapshot={dash.snapshot}
          userTz={userTz}
          showTzPicker={showTzPicker}
          setShowTzPicker={setShowTzPicker}
          saveTz={saveTz}
        />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DailyTokensCard chartTokenData={chartTokenData} />
        <DailyCostCard chartData={chartData} />
      </div>

      {/* 중단: plan 절감 + 24주 비용 히트맵 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <PlanSavingsCard planHealth={dash.planHealth} chartData={chartData} period={period} />
        <ActivityHeatmapCard heatmapDaily={dash.heatmapDaily} />
      </div>

      {/* 하단: 팀 (없으면 숨김) */}
      {teamBlocks}
    </main>
  );
}
