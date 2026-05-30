"use client";

import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useLocalMode } from "@/lib/use-local-mode";
import { useMessages } from "@/lib/use-i18n";
import type { Messages } from "@/lib/i18n";
import { Nav } from "@/components/nav";
// AdminNav 제거 (2026-05-30) — admin layout 의 sub-nav 로 통합. adminMode=true 는
// /admin/members 페이지에서 view-as dashboard 렌더 시 — 이미 admin layout 안.
import { CacheHitModal, OneShotRateModal, CostPerSessionModal, CallsPerSessionModal, CostPerCallModal, TokenVolumeModal } from "@/components/metric-modal";
import { computeTokenLevel } from "@/lib/rules";
import { ActivityCalendar } from "react-activity-calendar";
import { ScoreGauge, scoreLabel } from "@/components/score-gauge";
import dynamic from "next/dynamic";
import type { DrilldownPeriod } from "@/components/score-drilldown";
import { UsageHero } from "@/components/usage-hero";
import { PrivacyBanner } from "@/components/privacy-banner";
import { StaleSyncBanner } from "@/components/stale-sync-banner";
import { track, EVENTS } from "@/lib/analytics/mixpanel";
import { useTrackScrollDepth } from "@/lib/analytics/use-track-scroll-depth";
import { useTrackSectionDwell } from "@/lib/analytics/use-track-section-dwell";

const ScoreDrilldown = dynamic(
  () => import("@/components/score-drilldown").then((m) => m.ScoreDrilldown),
  {
    ssr: false,
    loading: () => (
      <div
        data-testid="score-drilldown-loading"
        className="bg-neutral-950 border-t border-neutral-800/60 px-4 py-4"
      >
        <div className="max-w-6xl mx-auto h-56 flex items-center justify-center">
          <span className="text-xs font-mono text-neutral-600 animate-pulse">Loading chart…</span>
        </div>
      </div>
    ),
  }
);

type Period = "today" | "8days" | "month" | "30days" | "all";

interface Overview {
  cost: number;
  sessions: number;
  calls: number;
  cacheHitPct: number;
  oneShotRate: number;
  activeDays: number;
  costPerCall: number;
  outputInputRatio: number;
  avgDailyTokens: number;
  periodScore: number | null;
  // period="today" 면 strict today (사용자 timezone 기준 오늘 하루) 의 총 tokens.
  // null 이면 fallback (chartTokenData 합산 — codeburn 2일 spillover 가능).
  totalTokensStrictToday: number | null;
}

interface Activity {
  name: string;
  turns: number;
  cost: number;
  oneShotRate: number | null;
}

interface Project {
  name: string;
  path: string;
  cost: number;
  sessions: number;
  avgCost: number;
}

interface TopSession {
  id: string;
  date: string;
  project: string;
  projectPath: string;
  cost: number;
  calls: number;
}

interface DailyRow { date: string; cost: number; sessions: number }
interface DailyTokenRow { date: string; totalTokens: number }
interface Model { name: string; cost: number; calls: number; cacheHitPct: number }
interface NameCalls { name: string; calls: number }

interface SnapshotMeta {
  periodStart: string;
  capturedAt: string;
}

interface SnapshotInfo {
  type: "weekly" | "monthly" | "daily";
  periodStart: string;
  capturedAt: string;
  dataRangeStart: string | null;
  dataRangeEnd: string | null;
}

interface PowerIndexSummary {
  score: number;
  activeDays: number;
  avgDailyTokens: number;
  windowDays: number;
}

// Plan Health 응답 타입 — API route 가 lib/plan-health 의 PlanHealthResult 에 추가 필드
// (nonCacheTotalWindowTokens / cacheHitPctForPeriod / priceForPeriod / periodDays /
// isEstimatedTier / blockCountInPeriod) 를 덧붙여 반환. UI 는 이 확장 타입을 사용.
interface PlanHealthApiResponse {
  declaredTier: "pro" | "max5" | "max20" | "team" | "api" | null;
  declaredLimits: {
    tier: string;
    label: string;
    monthlyPriceUsd: number;
    estimated5hTokenLimit: number;
  } | null;
  totalWindowTokens: number;
  nonCacheTotalWindowTokens: number | null;
  blockCountInPeriod: number;
  cacheHitPctForPeriod: number | null;
  priceForPeriod: number | null;
  periodDays: number;
  isEstimatedTier?: boolean;
  apiRecommendation?: {
    monthlyCost30d: number;
    recommendedTier: "api" | "pro" | "max5" | "max20" | "team_standard" | "team_premium" | "team";
    recommendedTierLabel: string;
    planMonthlyPrice: number;
    savingsAmount: number;
    savingsPct: number;
    edgeCase: "low" | "normal";
  } | null;
  monthRecovery?: {
    monthlyPriceUsd: number;
    monthCostUsd: number;
    recoveryPct: number;
    breakEvenDate: string | null;
    monthDaysElapsed: number;
    monthDaysTotal: number;
    remainingEstimateUsd: number;
  } | null;
}

interface DashboardData {
  user: { name: string; lastSyncedAt: string | null; timezone: string | null; planTier: string | null };
  planHealth?: PlanHealthApiResponse;
  powerIndex?: PowerIndexSummary;
  overview: Overview | null;
  daily: DailyRow[];
  dailyTokens?: DailyTokenRow[];
  dailyPlanUnitCost?: Array<{ date: string; unitCost: number | null }>;
  heatmapDaily?: Array<{ date: string; cost: number }>;
  visitDaily?: Array<{ date: string; visitCount: number; dwellSec: number }>;
  activities: Activity[];
  projects: Project[];
  topSessions: TopSession[];
  models: Model[];
  tools: NameCalls[];
  shellCommands: NameCalls[];
  mcpServers: NameCalls[];
  availableSnapshots?: { weekly: SnapshotMeta[]; monthly: SnapshotMeta[]; daily?: SnapshotMeta[] };
  snapshot?: SnapshotInfo | null;
  // blocks: API 에서 여전히 보내지만 (user_blocks 데이터 누적 유지) UI 에서 안 씀.
  blocks?: unknown;
  efficiencyScore?: EfficiencyScoreSummary | null;
  // M6f (2026-05-25): device-scope. user 가 노트북 N대 쓰면 N entries.
  devices?: DeviceMeta[];
  selectedDeviceId?: number | null;
  // Multi-provider (2026-05-29 M): Codex 탭 분기.
  //   supportsMultiProvider — selectedDeviceId 의 CLI 가 Codex 분리 호출 지원 (>= 0.3.0)
  //   hasCodexData          — user_snapshots 에 provider='codex' row 1+ 존재
  // Tabs 표시 = !supportsMultiProvider || hasCodexData (옛 CLI 업데이트 유도 || Codex 사용자)
  supportsMultiProvider?: boolean;
  hasCodexData?: boolean;
}

interface DeviceMeta {
  tokenId: number;
  name: string;
  platform: string | null;
  osVersion: string | null;
  hostname: string | null;
  cliVersion: string | null;
  lastUsedAt: string | null;
  snapshotUpdatedAt: string | null;
  hasData: boolean;
  totalCost: number;
}

interface EfficiencyScoreSummary {
  today: number | null;
  yesterday: number | null;
  delta: number | null;
  streak: number;
  daily: Array<{
    date: string;
    score: number | null;
    cacheHitPct: number | null;
    oneShotRate: number | null;
    costPerCall: number | null;
    totalTokens: number | null;
  }>;
  teamRank: {
    position: number;
    total: number;
    selfCacheHitPct: number;
    teamAvgCacheHitPct: number;
  } | null;
}

// 점수 → 색 (잔디 셀 + 큰 숫자 양쪽에서 사용). ScoreGauge 와 동일 팔레트.
function scoreColor(score: number | null): string {
  if (score === null) return "text-neutral-500";
  if (score >= 90) return "text-emerald-400";
  if (score >= 70) return "text-lime-400";
  if (score >= 40) return "text-orange-400";
  return "text-rose-400";
}

// ActivityCalendar level (0=비활성, 1~4=점수 구간). 5단 색상.
function scoreToLevel(score: number | null): 0 | 1 | 2 | 3 | 4 {
  if (score === null) return 0;
  if (score >= 90) return 4;
  if (score >= 70) return 3;
  if (score >= 40) return 2;
  return 1;
}

function rankMedal(position: number): string {
  if (position === 1) return "🥇";
  if (position === 2) return "🥈";
  if (position === 3) return "🥉";
  return "";
}

interface EfficiencyScoreSectionProps {
  score: EfficiencyScoreSummary;
  period: Period;
  periodScore: number | null;
}

// period 별 게이지 라벨 — period 라벨 (i18n) + 평균 효율 suffix 조합.
function gaugeLabel(period: Period, m: Messages): string {
  if (period === "today") return m.dashboardView.efficiencyTodayLabel;
  const label = period === "8days" ? m.common.eightDays
    : period === "month" ? m.common.thisMonth
    : period === "30days" ? m.common.thirtyDays
    : m.common.all;
  return m.dashboardView.efficiencyAvgLabel.replace("{period}", label);
}

// {key} 치환 헬퍼.
function tmpl(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

// — Daily chart date fill —
// 사용하지 않은 날도 0 으로 (dimmed) 표시. Stephen Few "data honesty" +
// Datadog GAUGE zero-fill + GitHub contributions 패턴. "all" period 는 데이터
// 있는 날만 (전 기간 grid 의미 약함).
function enumerateDateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(start + "T00:00:00Z");
  const endD = new Date(end + "T00:00:00Z");
  while (cur <= endD) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function lastNDates(todayKey: string, n: number): string[] {
  const out: string[] = [];
  const end = new Date(todayKey + "T00:00:00Z");
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function monthToDateRange(todayKey: string): string[] {
  const out: string[] = [];
  const end = new Date(todayKey + "T00:00:00Z");
  const start = new Date(end);
  start.setUTCDate(1);
  while (start <= end) {
    out.push(start.toISOString().slice(0, 10));
    start.setUTCDate(start.getUTCDate() + 1);
  }
  return out;
}

function expectedDateRange(
  period: Period,
  userTz: string,
  snapshot: SnapshotInfo | null | undefined,
): string[] | null {
  if (period === "all") return null;
  // snapshot 뷰 — API 가 계산한 dataRange 사용. 데이터 양 끝의 빈 날까지 채우진
  // 못하지만 (snapshot 은 데이터만 저장) snapshot view 는 보조 동선이라 OK.
  if (snapshot?.dataRangeStart && snapshot?.dataRangeEnd) {
    return enumerateDateRange(snapshot.dataRangeStart, snapshot.dataRangeEnd);
  }
  if (snapshot?.periodStart) return [snapshot.periodStart];
  // live (no snapshot) — period 별 기대 범위.
  let todayKey: string;
  try { todayKey = new Date().toLocaleDateString("en-CA", { timeZone: userTz }); }
  catch { todayKey = new Date().toISOString().slice(0, 10); }
  if (period === "today") return [todayKey];
  if (period === "8days") return lastNDates(todayKey, 8);
  if (period === "30days") return lastNDates(todayKey, 30);
  if (period === "month") return monthToDateRange(todayKey);
  return null;
}

function EfficiencyScoreSection({ score, period, periodScore }: EfficiencyScoreSectionProps) {
  const { m } = useMessages();
  const calData = score.daily.map((d) => ({
    date: d.date,
    count: d.score ?? 0,
    level: scoreToLevel(d.score),
  }));
  // 점수 구간별 색 — 빨강(경고) / 주황(개선) / 라임(양호) / 에메랄드(탁월).
  // level 0 = 회색 (활동 없음). scoreHexColor() 와 동일 팔레트.
  const theme = { dark: ["#1e293b", "#7f1d1d", "#9a3412", "#65a30d", "#10b981"] as [string, string, string, string, string] };

  // today 일 때 reference 라인 = "어제 N (▼ −4)" inline.
  // 다른 period 면 hide — period 평균은 어제와 비교할 단일 anchor 가 아님.
  const referenceNode = (() => {
    if (period !== "today") return null;
    const y = score.yesterday;
    const d = score.delta;
    if (y === null) return null;
    const yLabel = <span className="text-neutral-400">{tmpl(m.dashboardView.yesterdayN, { n: y })}</span>;
    if (d === null) return yLabel;
    const deltaLabel = d > 0
      ? <span className="text-emerald-400">▲ +{d}</span>
      : d < 0
        ? <span className="text-rose-400">▼ {d}</span>
        : <span className="text-neutral-500">─ 0</span>;
    return <>{yLabel} <span className="text-neutral-600">(</span>{deltaLabel}<span className="text-neutral-600">)</span></>;
  })();

  // 라벨 — period=today 면 진행 중 시각, 그 외는 period 이름만.
  const labelMain = gaugeLabel(period, m);
  const labelSuffix = (() => {
    if (period !== "today") return "";
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return tmpl(m.dashboardView.inProgressAt, { hh, mm });
  })();

  // 게이지 표시값 = period 평균. 8일 / 30일 선택하면 그 기간 평균 점수.
  // period=today 면 단일 entry → today 점수와 동일.
  const displayScore = periodScore;

  // Drilldown — today 외 period 에서만 활성. localStorage 로 펼침 상태 유지.
  const drilldownAvailable = period !== "today";
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOpen(localStorage.getItem("score_drilldown_open") === "1");
  }, []);
  const toggleDrilldown = () => {
    if (!drilldownAvailable) return;
    setOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem("score_drilldown_open", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const gaugeBlock = (
    <>
      <ScoreGauge score={displayScore} />
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono">
        <span className={`font-bold ${scoreColor(displayScore)}`}>{scoreLabel(displayScore, m)}</span>
        {referenceNode && <span className="text-neutral-500">·</span>}
        {referenceNode}
      </div>
      <span className="text-[12px] font-mono text-neutral-600 mt-0.5">{m.dashboardView.efficiencyFormula}</span>
      {drilldownAvailable && (() => {
        const periodLabel = period === "8days" ? m.common.eightDays
          : period === "month" ? m.common.thisMonth
          : period === "30days" ? m.common.thirtyDays
          : m.common.all;
        return (
          <span
            data-testid="score-drilldown-hint"
            className="mt-1 text-[10px] font-mono text-sky-400/70 group-hover:text-sky-300 transition-colors"
          >
            {open ? m.dashboardView.closeUpTrend : tmpl(m.dashboardView.openTrend, { period: periodLabel })}
          </span>
        );
      })()}
    </>
  );

  return (
    <div data-testid="dash-efficiency-score" className="bg-neutral-900 border border-neutral-800 rounded">
      <div className="px-4 py-4">
        <div className="grid grid-cols-12 gap-x-6 items-start">
          {/* Hero: 원형 게이지 (3 cols) — 5초 테스트 통과용 단일 focal point */}
          {drilldownAvailable ? (
            <button
              type="button"
              data-testid="score-today"
              onClick={toggleDrilldown}
              className="group col-span-12 sm:col-span-3 flex flex-col items-center bg-transparent border-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded"
            >
              <span className="text-[12px] font-mono text-neutral-500 uppercase tracking-wider mb-1">
                {labelMain}{labelSuffix}
              </span>
              {gaugeBlock}
            </button>
          ) : (
            <div data-testid="score-today" className="col-span-12 sm:col-span-3 flex flex-col items-center">
              <span className="text-[12px] font-mono text-neutral-500 uppercase tracking-wider mb-1">
                {labelMain}{labelSuffix}
              </span>
              {gaugeBlock}
            </div>
          )}

          {/* 보조: streak + team rank 세로 stack (3 cols) */}
          <div className="col-span-12 sm:col-span-3 flex flex-col gap-3 py-1">
            {/* Streak */}
            <div data-testid="score-streak">
              <span className="text-[12px] font-mono text-neutral-500 uppercase tracking-wider block mb-1">
                {m.dashboardView.streakLabel}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-3xl leading-none">🔥</span>
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-mono font-bold leading-none ${score.streak >= 7 ? "text-orange-400" : score.streak >= 1 ? "text-neutral-200" : "text-neutral-600"}`}>
                      {score.streak}
                    </span>
                    <span className="text-xs font-mono text-neutral-500">{m.common.daysShort}</span>
                  </div>
                  <span className="text-[12px] font-mono text-neutral-500 mt-0.5">{m.dashboardView.streakSkip}</span>
                </div>
              </div>
            </div>

            {/* Team rank */}
            {score.teamRank ? (
              <div data-testid="score-team-rank">
                <span className="text-[12px] font-mono text-neutral-500 uppercase tracking-wider block mb-1">
                  {m.dashboardView.weekTeamCacheRank}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-3xl leading-none">{rankMedal(score.teamRank.position) || "🏅"}</span>
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-mono font-bold leading-none text-sky-300">
                        {score.teamRank.position}
                      </span>
                      <span className="text-xs font-mono text-neutral-500">{tmpl(m.dashboardView.rankOutOf, { n: score.teamRank.total })}</span>
                    </div>
                    <span className="text-[12px] font-mono text-neutral-500 mt-0.5">
                      {tmpl(m.dashboardView.rankMeTeam, { self: score.teamRank.selfCacheHitPct.toFixed(1), team: score.teamRank.teamAvgCacheHitPct.toFixed(1) })}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 opacity-60">
                <span className="text-3xl leading-none">🏅</span>
                <span className="text-[11px] font-mono text-neutral-600">{m.dashboardView.teamRankEmpty}</span>
              </div>
            )}
          </div>

          {/* Grass (6 cols) */}
          <div data-testid="score-grass" className="col-span-12 sm:col-span-6 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-mono text-neutral-500 uppercase tracking-wider">{m.dashboardView.recent90dEfficiency}</span>
              <div className="flex items-center gap-2.5 text-[12px] font-mono text-neutral-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: theme.dark[1] }} />{m.dashboardView.gradeWarning}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: theme.dark[2] }} />{m.dashboardView.gradeImprove}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: theme.dark[3] }} />{m.dashboardView.gradeGood}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: theme.dark[4] }} />{m.dashboardView.gradeExemplary}</span>
              </div>
            </div>
            <ActivityCalendar
              data={calData}
              colorScheme="dark"
              theme={theme}
              labels={{ legend: { less: m.dashboardView.legendLow, more: m.dashboardView.legendHigh } }}
              showWeekdayLabels
              blockSize={14}
              blockMargin={4}
              showTotalCount={false}
              renderColorLegend={() => <></>}
              renderBlock={(block, activity) => {
                const inactive = activity.level === 0;
                const label = inactive
                  ? tmpl(m.dashboardView.dayCellNoActivity, { date: activity.date })
                  : tmpl(m.dashboardView.dayCellScore, { date: activity.date, score: activity.count, label: scoreLabel(activity.count, m) });
                return React.cloneElement(block, {}, <title>{label}</title>);
              }}
            />
          </div>
        </div>
      </div>

      {drilldownAvailable && open && (
        <ScoreDrilldown daily={score.daily} period={period as DrilldownPeriod} />
      )}
    </div>
  );
}

function periodLabel(p: Period, m: Messages): string {
  switch (p) {
    case "today":  return m.common.today;
    case "8days":  return m.common.eightDays;
    case "month":  return m.common.thisMonth;
    case "30days": return m.common.thirtyDays;
    case "all":    return m.common.all;
  }
}

function formatPath(path: string): string {
  if (!path) return "";
  let p = path;
  if (path.startsWith("/")) {
    const m = path.match(/^\/(?:Users|home)\/[^/]+\/(.+)$/);
    p = m ? m[1] : path;
  }
  const parts = p.split("/").filter(Boolean);
  return parts.slice(-3).join("/");
}

function fmt$(n: number) { return `$${n.toFixed(2)}`; }

// Grade 식별자는 영어로 통일 — DOM 노출 시 m.grades[g] 로 변환.
type GradeLevel = "exemplary" | "good" | "moderate" | "insufficient" | "warning";
const GRADE_STYLES: Record<GradeLevel, string> = {
  exemplary:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  good:         "bg-green-500/15 text-green-400 border-green-500/40",
  moderate:     "bg-yellow-500/15 text-yellow-400 border-yellow-500/40",
  insufficient: "bg-orange-500/15 text-orange-400 border-orange-500/40",
  warning:      "bg-red-500/15 text-red-400 border-red-500/40",
};

const GRADE_TOOLTIP_CLS: Record<GradeLevel, string> = {
  exemplary:    "bg-emerald-950/60 text-emerald-300",
  good:         "bg-green-950/60 text-green-300",
  moderate:     "bg-yellow-950/60 text-yellow-300",
  insufficient: "bg-orange-950/60 text-orange-300",
  warning:      "bg-red-950/60 text-red-300",
};

function gradeLabel(g: GradeLevel, m: Messages): string {
  switch (g) {
    case "exemplary":    return m.grades.exemplary;
    case "good":         return m.grades.good;
    case "moderate":     return m.grades.moderate;
    case "insufficient": return m.grades.insufficient;
    case "warning":      return m.grades.warning;
  }
}

function cacheRows(m: Messages): [GradeLevel, string, string][] {
  return [
    ["exemplary",    "96%+",   m.gradeDescriptions.cacheHitExemplary],
    ["good",         "90~95%", m.gradeDescriptions.cacheHitGood],
    ["moderate",     "80~89%", m.gradeDescriptions.cacheHitModerate],
    ["insufficient", "60~79%", m.gradeDescriptions.cacheHitInsufficient],
    ["warning",      "<60%",   m.gradeDescriptions.cacheHitWarning],
  ];
}

function oneshotRows(m: Messages): [GradeLevel, string, string][] {
  return [
    ["exemplary", "80%+",   m.gradeDescriptions.oneShotExemplary],
    ["moderate",  "40~79%", m.gradeDescriptions.oneShotModerate],
    ["warning",   "<40%",   m.gradeDescriptions.oneShotWarning],
  ];
}

function costRows(m: Messages): [GradeLevel, string, string][] {
  return [
    ["exemplary", "<$25",    m.gradeDescriptions.costExemplary],
    ["moderate",  "$25~100", m.gradeDescriptions.costModerate],
    ["warning",   "$100+",   m.gradeDescriptions.costWarning],
  ];
}

function tokenRows(m: Messages): [GradeLevel, string, string][] {
  return [
    ["exemplary",    "8/10+ (≥150M/day)",  m.gradeDescriptions.tokenExemplary],
    ["good",         "6~7/10 (40~150M)",   m.gradeDescriptions.tokenGood],
    ["moderate",     "3~5/10 (8~40M)",     m.gradeDescriptions.tokenModerate],
    ["insufficient", "1~2/10 (≤8M)",       m.gradeDescriptions.tokenInsufficient],
    ["warning",      "0/10 (0 tokens)",    m.gradeDescriptions.tokenWarning],
  ];
}

function MiniGradeTable({ title, rows, current, m }: { title: string; rows: [GradeLevel, string, string][]; current: GradeLevel; m: Messages }) {
  return (
    <div>
      <p className="text-[10px] font-mono text-slate-400 font-semibold mb-1">{title}</p>
      {rows.map(([g, range, desc]) => (
        <div
          key={g}
          className={`flex items-center gap-1.5 px-1 py-0.5 rounded text-[10px] font-mono ${g === current ? GRADE_TOOLTIP_CLS[g] + " font-bold" : "text-slate-600"}`}
        >
          <span className="w-7 shrink-0">{gradeLabel(g, m)}</span>
          <span className="w-20 shrink-0 text-[9px]">{range}</span>
          <span className="text-[9px] opacity-70 truncate">{desc}</span>
          {g === current && <span className="ml-auto text-[8px] shrink-0 opacity-50">←</span>}
        </div>
      ))}
    </div>
  );
}

function cacheHitGrade(v: number): GradeLevel {
  if (v >= 96) return "exemplary";
  if (v >= 90) return "good";
  if (v >= 80) return "moderate";
  if (v >= 60) return "insufficient";
  return "warning";
}
function oneShotGrade(v: number): GradeLevel {
  if (v >= 80) return "exemplary";
  if (v >= 40) return "moderate";
  return "warning";
}
function costGrade(v: number): GradeLevel {
  if (v < 25) return "exemplary";
  if (v < 100) return "moderate";
  return "warning";
}
// Token level (0-10) → 5-level grade 매핑.
function tokenLevelToGrade(level: number): GradeLevel {
  if (level >= 8) return "exemplary";
  if (level >= 6) return "good";
  if (level >= 3) return "moderate";
  if (level >= 1) return "insufficient";
  return "warning";
}
function fmtTokensShort(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// EFFICIENCY 배지: API 가 반환한 periodScore 사용 (period 별 daily score 평균).
// period=today 면 단일 entry = 게이지 값 정확히 일치 → 게이지·배지 영원히 동기화.
// 이전엔 period overview 에서 별도 계산 (cross-source: ccusage vs codeburn 토큰/oneshot)
// 했는데 source 불일치로 ~5점 차이 발생 (91/탁월 vs 양호 버그). periodScore 사용으로 해결.
function badgeGradeFromScore(score: number | null): GradeLevel {
  // scoreLabel 의 5단계 와 일치 (90/75/55/35).
  if (score === null) return "warning";
  if (score >= 90) return "exemplary";
  if (score >= 75) return "good";
  if (score >= 55) return "moderate";
  if (score >= 35) return "insufficient";
  return "warning";
}

function fmtSyncedAt(ts: string | null, tz: string): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: tz,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

function fmtTokens(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatWeekRange(periodStart: string): string {
  const [y, m, d] = periodStart.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (dt: Date) => `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;
  return `${fmt(start)}-${fmt(end)}`;
}

function formatMonthLabel(periodStart: string): string {
  return periodStart.slice(0, 7);
}

function formatDayLabel(periodStart: string): string {
  const [, m, d] = periodStart.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

function dayOffsetLabel(i: number, m: Messages): string {
  const dv = m.dashboardView;
  if (i === 1) return dv.dayOffsetYesterday;
  if (i === 2) return dv.dayOffset2;
  return tmpl(dv.dayOffsetN, { n: i });
}

function weekOffsetLabel(i: number, m: Messages): string {
  return i === 1 ? m.dashboardView.weekOffsetLast : tmpl(m.dashboardView.weekOffsetN, { n: i });
}

function monthOffsetLabel(i: number, m: Messages): string {
  return i === 1 ? m.dashboardView.monthOffsetLast : tmpl(m.dashboardView.monthOffsetN, { n: i });
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  const fmt = (s: string) => {
    const [, m, d] = s.split("-");
    return `${parseInt(m)}/${parseInt(d)}`;
  };
  return `${fmt(start)}-${fmt(end)}`;
}

const TZ_ABBR_MAP: Record<string, string> = {
  "Asia/Singapore": "SGT",
  "Asia/Seoul": "KST",
  "Asia/Tokyo": "JST",
  "Asia/Hong_Kong": "HKT",
  "Asia/Shanghai": "CST",
  "Asia/Kolkata": "IST",
  "UTC": "UTC",
};

function tzAbbr(tz: string): string {
  const fromIntl = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "short" })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName")?.value ?? tz;
  return /^GMT[+-]/.test(fromIntl) ? (TZ_ABBR_MAP[tz] ?? fromIntl) : fromIntl;
}

const TIMEZONE_LIST: { label: string; value: string }[] = [
  { label: "SGT — Singapore (UTC+8)", value: "Asia/Singapore" },
  { label: "KST — Korea (UTC+9)", value: "Asia/Seoul" },
  { label: "JST — Japan (UTC+9)", value: "Asia/Tokyo" },
  { label: "HKT — Hong Kong (UTC+8)", value: "Asia/Hong_Kong" },
  { label: "CST — China (UTC+8)", value: "Asia/Shanghai" },
  { label: "IST — India (UTC+5:30)", value: "Asia/Kolkata" },
  { label: "GMT/BST — UK", value: "Europe/London" },
  { label: "CET — Central Europe", value: "Europe/Paris" },
  { label: "EST/EDT — US Eastern", value: "America/New_York" },
  { label: "CST/CDT — US Central", value: "America/Chicago" },
  { label: "PST/PDT — US Pacific", value: "America/Los_Angeles" },
  { label: "UTC", value: "UTC" },
];

function TipBtn({ label, onClick, variant = "action", testid }: { label: string; onClick: () => void; variant?: "explain" | "action"; testid?: string }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors leading-none ${variant === "explain" ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-indigo-600 text-white hover:bg-indigo-500"}`}
    >{label}</button>
  );
}

// 팀 내 내 위치 카드 — 4 metric (사용량/cost/cache hit/활용지수) 본인 등수
// + 값 + 팀 평균 + 1위 이름·값. 본인이 팀 멤버일 때만 (rank 계산 가능).
// 작은 N (4명) 가정. percentile 보다 ordinal "N/M명" + 본인 행 강조.
function TeamPositionCard({
  team,
  currentUserName,
  periodLabel,
}: {
  team: TeamRankPayload;
  currentUserName: string;
  periodLabel: string;
}) {
  const { m } = useMessages();
  const dv = m.dashboardView;
  const members = team.byEfficiency ?? [];
  const usage = team.memberUsage ?? [];
  if (members.length === 0) return null;
  // 본인 매칭 — name 기반 (동명이인 quirk team-view 와 동일).
  const me = members.find((mb) => mb.name === currentUserName);
  if (!me) return null;

  // 각 metric 별 정렬 (desc) + 본인 rank/평균/1위.
  function buildRow<T>(
    label: string,
    pool: T[],
    extract: (m: T) => { name: string; value: number },
    isHigherBetter: boolean,
    fmt: (v: number) => string,
    valueColor: string,
  ) {
    if (pool.length === 0) return null;
    const sorted = [...pool].sort((a, b) => {
      const va = extract(a).value;
      const vb = extract(b).value;
      return isHigherBetter ? vb - va : va - vb;
    });
    const myIdx = sorted.findIndex((mb) => extract(mb).name === currentUserName);
    if (myIdx === -1) return null;
    const myVal = extract(sorted[myIdx]).value;
    const total = sorted.length;
    const rank = myIdx + 1;
    const avg = sorted.reduce((s, mb) => s + extract(mb).value, 0) / sorted.length;
    const first = sorted[0];
    const isMeFirst = extract(first).name === currentUserName;
    const isTop1 = rank === 1;
    return { label, rank, total, myVal, avg, firstName: extract(first).name, firstVal: extract(first).value, isMeFirst, isTop1, fmt, valueColor };
  }

  const rows = [
    buildRow(dv.teamPositionLabelUsage, members, (mb) => ({ name: mb.name, value: mb.totalTokens }), true,
      (v) => v >= 1_000_000_000 ? `${(v / 1_000_000_000).toFixed(1)}B` : v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(1)}k` : String(v),
      "text-cyan-300"),
    buildRow(dv.teamPositionLabelCost, members, (mb) => ({ name: mb.name, value: mb.totalCost }), true,
      (v) => `$${v.toFixed(2)}`, "text-yellow-300"),
    buildRow(dv.teamPositionLabelCacheHit, members, (mb) => ({ name: mb.name, value: mb.cacheHitPct }), true,
      (v) => `${v.toFixed(1)}%`, "text-emerald-300"),
    buildRow(dv.teamPositionLabelPower, usage, (mb) => ({ name: mb.name, value: mb.powerIndex }), true,
      (v) => String(v), "text-cyan-300"),
  ].filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return null;

  return (
    <div data-testid="dash-card-team-position" data-track-dwell="team_position" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-indigo-500 rounded">
      <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider">
          {tmpl(dv.teamPositionTitle, { period: periodLabel, n: members.length })}
        </span>
      </div>
      <div className="p-3 space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-[5rem_2.5rem_5rem_1fr_auto] gap-x-3 items-baseline text-xs font-mono"
          >
            <span className="text-neutral-500 whitespace-nowrap truncate">{r.label}</span>
            <span className="text-neutral-200 tabular-nums whitespace-nowrap">
              {r.rank}/{r.total}
            </span>
            <span className={`${r.valueColor} tabular-nums font-bold text-right whitespace-nowrap`}>{r.fmt(r.myVal)}</span>
            <span className="text-neutral-500 truncate min-w-0">
              {tmpl(dv.teamPositionTeamAvg, { avg: r.fmt(r.avg) })}
              <span className="text-neutral-700 mx-1.5">·</span>
              {r.isMeFirst ? (
                <span className="text-emerald-400">{dv.teamPositionMeFirst}</span>
              ) : (
                <>{tmpl(dv.teamPositionTeamFirst, { name: r.firstName, val: r.fmt(r.firstVal) })}</>
              )}
            </span>
            <span className="text-emerald-400 w-3 text-center">
              {r.isTop1 && !r.isMeFirst ? "★" : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TeamMember { userId: string; name: string }

// 팀 내 내 위치 카드용 — /api/team 응답 일부.
interface TeamRankMember {
  userId: number;
  name: string;
  totalCost: number;
  totalTokens: number;
  cacheHitPct: number;
}
interface TeamRankMemberUsage {
  userId: number;
  name: string;
  powerIndex: number;
}
interface TeamRankPayload {
  byEfficiency: TeamRankMember[];
  memberUsage?: TeamRankMemberUsage[];
}

export function DashboardView({ targetUserId, onMemberSelect, storageKey = "dashboard_period", adminMode = false }: { targetUserId?: string; onMemberSelect?: (userId: string) => void; storageKey?: string; adminMode?: boolean }) {
  const viewOnly = !!targetUserId;
  // adminMode 면 admin layout sub-nav 가 이미 표시 → 본 컴포넌트는 nav 안 렌더.
  const NavComponent = adminMode ? () => null : Nav;
  const { data: session, status } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("8days");
  // localStorage 읽기 전 첫 fetch 가 stale period 로 발사 + race 로 늦은 응답이
  // 덮어쓰는 버그 방지. 읽기 완료 후에만 fetch 허용.
  const [periodReady, setPeriodReady] = useState(false);

  // 로컬 모드 (.pkg/.app 설치 환경) 면 NextAuth session 없이도 작동.
  const isLocalMode = useLocalMode();
  const { m: t } = useMessages();

  // 스크롤 깊이 25/50/75/100 마일스톤 자동 추적 (본인 모드 / view-as 모드 통합)
  useTrackScrollDepth(viewOnly ? "dashboard_view_as" : "dashboard");
  // 섹션 dwell 자동 추적 — 카드 div 의 data-track-dwell attribute 로 매칭.
  useTrackSectionDwell(viewOnly ? "dashboard_view_as" : "dashboard");

  // dashboard_view — funnel 추적은 page.tsx 의 DashboardPage 에서 처리.
  // 옛 이 위치 fire 는 DashboardRouter 의 status 분기 구조 (status !== authenticated
  // vs authenticated 가 Fragment 다른 위치) 때문에 session 전환 시 DashboardView 가
  // unmount + remount 되어 useEffect 가 2회 발사되는 버그 (Mixpanel 2026-05-29 e2e
  // 검증에서 발견). 추적을 outer page component 로 옮겨 1회만 보장.

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    // legacy "week" → "8days" (calendar week feature was removed)
    const upgraded = saved === "week" ? "8days" : saved;
    if (upgraded && ["today", "8days", "month", "30days", "all"].includes(upgraded)) {
      setPeriod(upgraded as Period);
    }
    setPeriodReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!periodReady) return;
    localStorage.setItem(storageKey, period);
  }, [period, storageKey, periodReady]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  // 팀 내 내 위치 카드 데이터 — 본인 화면일 때 (viewOnly 아님) /api/team 호출.
  // period 따라 등수 달라지니 같이 refetch.
  const [teamRankData, setTeamRankData] = useState<TeamRankPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [syncCopied, setSyncCopied] = useState(false);
  // 자세히 보기 토글 — by model / by project / top sessions / by activity /
  // core tools / shell commands / MCP / 체류 히트맵 모두 토글 안. localStorage
  // 로 사용자 선호 유지.
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDetailsOpen(localStorage.getItem("dash_details_open") === "1");
  }, []);
  const toggleDetails = () => {
    setDetailsOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem("dash_details_open", next ? "1" : "0"); } catch {}
      return next;
    });
  };
  const [showCacheModal, setShowCacheModal] = useState(false);
  const [showOneShotModal, setShowOneShotModal] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [showCallsModal, setShowCallsModal] = useState(false);
  const [showCacheMethodsModal, setShowCacheMethodsModal] = useState(false);
  const [showOneShotMethodsModal, setShowOneShotMethodsModal] = useState(false);
  const [showCostMethodsModal, setShowCostMethodsModal] = useState(false);
  const [showCallsMethodsModal, setShowCallsMethodsModal] = useState(false);
  const [showCostCallModal, setShowCostCallModal] = useState(false);
  const [showCostCallMethodsModal, setShowCostCallMethodsModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showTzPicker, setShowTzPicker] = useState(false);
  const [userTz, setUserTz] = useState<string>(() =>
    typeof window !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC"
  );
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [dayOffset, setDayOffset] = useState(0);
  // M6f: 사용자가 노트북 N대 쓰면 device chip 으로 선택. null = server 가 가장 최근 device 자동 결정.
  const [deviceId, setDeviceId] = useState<number | null>(null);
  // Multi-provider (2026-05-29 M): Claude / Codex 분리 탭. default = claude (대다수).
  const [provider, setProvider] = useState<"claude" | "codex">("claude");

  const apiUrl = (p: Period, wOff: number, mOff: number, dOff: number, devId: number | null, prov: "claude" | "codex") => {
    const params = new URLSearchParams({ period: p });
    if (targetUserId) params.set("userId", targetUserId);
    if (p === "8days" && wOff > 0) params.set("weekOffset", String(wOff));
    if (p === "month" && mOff > 0) params.set("monthOffset", String(mOff));
    if (p === "today" && dOff > 0) params.set("dayOffset", String(dOff));
    if (devId !== null) params.set("deviceId", String(devId));
    if (prov === "codex") params.set("provider", "codex");
    return `/api/dashboard?${params.toString()}`;
  };

  useEffect(() => {
    // 로컬 모드 미확정 (loading) 이면 redirect 보류
    if (isLocalMode === null) return;
    // 로컬 모드면 server 가 single-user 자동 인증 → login 우회
    if (isLocalMode) return;
    if (status === "unauthenticated") router.push("/login");
  }, [status, router, isLocalMode]);

  // Mount-time visit POST. session.user 만 카운트 (어드민이 viewOnly 로
  // 다른 사람 보더라도 어드민 본인 row 가 +1). useEffect deps 가 [session]
  // 이라 같은 세션에서 페이지 새로고침 시에만 1회 — period/offset 변경엔
  // 재호출 안 됨. 실패해도 무시 (UI 영향 0).
  useEffect(() => {
    if (!session) return;
    fetch("/api/visit", { method: "POST" }).catch(() => {});
  }, [session]);

  // Dwell time 추적: visibility-API 로 활성 시간 누적, hide / unload 시
  // sendBeacon 으로 /api/visit-end 에 누적초 전송. 백그라운드 탭은 자연
  // 정지. 같은 페이지에서 visible↔hidden 전환 가능 — 매 visible 마다 새
  // segment 시작. 4시간 cap 은 서버측에서 적용.
  useEffect(() => {
    if (!session) return;
    let visibleSince: number | null = document.visibilityState === "visible" ? Date.now() : null;
    let accumulated = 0;
    const flush = () => {
      if (visibleSince) {
        accumulated += Date.now() - visibleSince;
        visibleSince = null;
      }
      const sec = Math.floor(accumulated / 1000);
      if (sec <= 0) return;
      accumulated = 0;
      try {
        const blob = new Blob([JSON.stringify({ sec })], { type: "application/json" });
        navigator.sendBeacon("/api/visit-end", blob);
      } catch {
        // ignore
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        visibleSince = Date.now();
      } else {
        flush();
      }
    };
    const onUnload = () => flush();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onUnload);
    return () => {
      flush(); // unmount 시에도 누적분 전송
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onUnload);
    };
  }, [session]);

  useEffect(() => {
    if (!viewOnly || !session) return;
    fetch("/api/team")
      .then((r) => r.json())
      .then((d) => {
        const list: TeamMember[] = (d.byEfficiency ?? []).map((m: { userId: string; name: string }) => ({
          userId: m.userId,
          name: m.name,
        }));
        setTeamMembers(list);
      })
      .catch(() => {});
  }, [viewOnly, session]);

  // 팀 내 내 위치 카드 — 본인 화면 + admin view-as 둘 다. view-as 일 때는
  // viewAs 팀 (target user 의 팀) 데이터 옴 (/api/team 이 effectiveTeamId
  // 사용). period 따라 등수 달라지니 period 의존. LOCAL_MODE 는 skip.
  useEffect(() => {
    if (!session || isLocalMode) return;
    if (!periodReady) return;
    const ctrl = new AbortController();
    fetch(`/api/team?period=${period}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) return;
        setTeamRankData({
          byEfficiency: d.byEfficiency ?? [],
          memberUsage: d.memberUsage ?? [],
        });
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
      });
    return () => ctrl.abort();
  }, [session, period, periodReady, isLocalMode]);

  useEffect(() => {
    if (!session) return;
    if (!periodReady) return;
    const ctrl = new AbortController();
    setLoading(true);
    fetch(apiUrl(period, weekOffset, monthOffset, dayOffset, deviceId, provider), { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) { setFetchError(true); setLoading(false); return; }
        setFetchError(false);
        setData(d);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setFetchError(true);
        setLoading(false);
      });
    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, period, weekOffset, monthOffset, dayOffset, deviceId, provider, targetUserId, periodReady]);

  useEffect(() => {
    if (data?.user?.timezone) setUserTz(data.user.timezone);
  }, [data?.user?.timezone]);

  // overview 가 없는 사용자 (첫 sync 대기 중) 자동 polling. LOCAL_MODE 면 5초,
  // 서버 모드 면 4초. 옛 동작은 두 useEffect 가 분리되어 isLocalMode=false 사용자
  // 가 LOCAL_MODE 가드 통과 후 서버 polling 동시에 도는 race 가능 + AbortController
  // 없어 unmount 후 setData 호출. 통합 + signal 처리.
  useEffect(() => {
    if (!session && !isLocalMode) return;
    if (data?.overview) return;
    const intervalMs = isLocalMode ? 5000 : 4000;
    const ctrl = new AbortController();
    const id = setInterval(() => {
      fetch(apiUrl(period, weekOffset, monthOffset, dayOffset, deviceId, provider), { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => {
          if (d?.error) return;
          if (d?.overview) setData(d);
        })
        .catch(() => {
          // AbortError / 네트워크 오류 — 다음 tick 에서 자연 재시도.
        });
    }, intervalMs);
    return () => {
      clearInterval(id);
      ctrl.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isLocalMode, data?.overview, period, weekOffset, monthOffset, dayOffset, deviceId, provider, targetUserId]);

  const saveTz = async (tz: string) => {
    setUserTz(tz);
    setShowTzPicker(false);
    await fetch("/api/user/timezone", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: tz }),
    });
  };

  if (status === "loading" || (!data && !fetchError)) return (
    <div className="min-h-screen bg-neutral-950">
      <NavComponent />
      <div className="flex items-center justify-center h-64">
        <span data-testid="dash-loading" className="font-mono text-neutral-500 animate-pulse">loading...</span>
      </div>
    </div>
  );

  if (fetchError) return (
    <div className="min-h-screen bg-neutral-950">
      <NavComponent />
      <div data-testid="dash-fetch-error" className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-neutral-400 font-mono text-sm">{t.dashboardView.dataLoadFailed}</p>
        <button
          data-testid="dash-retry"
          onClick={() => {
            setFetchError(false); setLoading(true);
            fetch(apiUrl(period, weekOffset, monthOffset, dayOffset, deviceId, provider)).then((r) => r.json()).then((d) => {
              if (!d?.error) { setData(d); setLoading(false); }
            });
          }}
          className="px-4 py-1.5 bg-neutral-800 rounded text-sm text-neutral-200 hover:bg-neutral-700 font-mono"
        >{t.dashboardView.retry}</button>
      </div>
    </div>
  );

  if (!data) return null;

  // isLocalMode 가 아직 loading (null) 이면 redirect 보류 — null 은 falsy 라
  // `!isLocalMode` 가 true 로 평가되어 setup 으로 튕기는 race 방지.
  if (isLocalMode === null) return null;

  // 로컬 모드 (.app 인스톨러) 는 setup 흐름이 다름 (위저드 → launchd 자동 등록).
  // sync 가 아직 안 돈 상태여도 setup 페이지로 보내지 않고 빈 dashboard 표시.
  // M6d (2026-05-21): /setup 강제 redirect 예외를 Owner (Platform Admin || Team Owner)
  // 만으로 좁힘. Membership/Billing Admin 도 본인 트래킹 필수 — 설치 안 했으면 /setup.
  const sessionUser = session?.user as
    | { isAdmin?: boolean; isPlatformAdmin?: boolean; currentTeamRole?: string | null }
    | undefined;
  const isOwnerLike =
    !!sessionUser?.isPlatformAdmin || sessionUser?.currentTeamRole === "owner";
  if (!data.user.lastSyncedAt && !viewOnly && isLocalMode === false && !isOwnerLike) {
    router.push("/setup");
    return null;
  }

  if (!data.overview) {
    // Multi-provider (2026-05-29 M): Codex 탭 선택 + 현재 CLI 가 옛 버전 (< 0.3.0) →
    // Codex 데이터 미수집 안내. admin / isLocalMode / sync 안내 분기보다 우선 — 본인이
    // admin 이라도 Codex 미수집 안내가 더 정확. viewOnly 는 그대로 noDataYet 표시.
    if (!viewOnly && provider === "codex" && data.supportsMultiProvider === false) {
      const selectedDev = data.devices?.find((d) => d.tokenId === data.selectedDeviceId);
      const verLabel = selectedDev?.cliVersion ?? "0.2.x";
      // Windows 사용자에겐 PowerShell 명령. selectedDevice.platform 없으면 macOS/Linux 기본.
      const installCmd = selectedDev?.platform === "win32"
        ? "irm https://aiusage.z21labs.world/install.ps1 | iex"
        : "curl -fsSL https://aiusage.z21labs.world/install.sh | bash";
      return (
        <div className="min-h-screen bg-neutral-950">
          <NavComponent />
          <main className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
            <h1 className="text-2xl font-bold text-neutral-100">Codex 데이터 미수집</h1>
            <p className="text-neutral-400 text-sm">
              현재 CLI 버전 (<code className="text-cyan-400 font-mono">v{verLabel}</code>) 은 Codex 사용량을 수집하지 않습니다.<br />
              최신 버전으로 업데이트하면 Codex 사용량도 자동으로 표시됩니다.
            </p>
            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded px-4 py-3 text-left">
              <code className="flex-1 text-sm text-cyan-400 font-mono break-all">{installCmd}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(installCmd); setSyncCopied(true); setTimeout(() => setSyncCopied(false), 2000); }}
                className="shrink-0 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded font-mono"
              >{syncCopied ? "✓" : "복사"}</button>
            </div>
            <p className="text-xs text-neutral-600 font-mono">업데이트 후 5-10분 안에 Codex 데이터가 차오릅니다.</p>
            <button
              onClick={() => setProvider("claude")}
              className="text-xs text-neutral-500 hover:text-neutral-300 font-mono"
            >← Claude Code 탭으로 돌아가기</button>
          </main>
        </div>
      );
    }

    if (viewOnly) return (
      <div className="min-h-screen bg-neutral-950">
        <NavComponent />
        <div className="flex items-center justify-center h-64">
          <p className="text-neutral-500 font-mono text-sm">{t.dashboardView.noDataYet}</p>
        </div>
      </div>
    );

    // 로컬 모드 (.app 인스톨러) — 백그라운드 sync 가 자동 실행 중. 사용자는
    // 아무 행동 안 해도 됨. 화면이 자동 폴링 → 데이터 도착하면 즉시 표시.
    if (isLocalMode) {
      return (
        <div className="min-h-screen bg-neutral-950">
          <header className="border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
            <span className="font-mono font-bold text-neutral-200">{t.brand}</span>
          </header>
          <main className="max-w-md mx-auto px-4 py-20 text-center space-y-8">
            <div className="flex justify-center">
              <svg
                width="96"
                height="96"
                viewBox="0 0 32 32"
                xmlns="http://www.w3.org/2000/svg"
                aria-label={t.dashboard.loading.title}
              >
                <rect x="2" y="2" width="28" height="28" rx="6" fill="#10b981" />
                <circle
                  cx="16"
                  cy="16"
                  r="9"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeOpacity="0.3"
                />
                <g style={{ transformOrigin: "16px 16px", animation: "wizardSpin 1.2s linear infinite" }}>
                  <path
                    d="M 16 7 A 9 9 0 0 1 24.4 19.4"
                    fill="none"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </g>
              </svg>
              <style>{`@keyframes wizardSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-neutral-100">{t.dashboard.loading.title}</h1>
              <p className="text-neutral-400 text-sm">
                {t.dashboard.loading.body1}
                <br />
                {t.dashboard.loading.body2}
              </p>
            </div>
            <p className="text-xs text-neutral-600 font-mono">{t.dashboard.loading.polling}</p>
          </main>
        </div>
      );
    }

    // M6d: Owner (Platform Admin || Team Owner) 가 데이터 없는 상태로 dashboard 에
    // 머무를 때 — sync 강제 안내 대신 "admin 설정 완료 + (원하면) CLI 설치" 배너 +
    // admin 패널 진입 링크. Membership/Billing Admin 은 위 redirect 단계에서 이미
    // /setup 으로 보내졌으므로 여기 도달 불가.
    // Platform Admin 이 view-as 모드 (다른 회사 보고 있음) 인데 그 회사에 본인이
    // 멤버가 아니라 dashboard 가 비어 있는 케이스 — 별도 안내. (2026-05-22)
    const viewAsTeamName = (session?.user as { viewAsTeamName?: string | null } | undefined)?.viewAsTeamName ?? null;
    if (isOwnerLike) {
      return (
        <div className="min-h-screen bg-neutral-950">
          <NavComponent />
          <main className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
            {viewAsTeamName ? (
              <>
                <h1 className="text-2xl font-bold text-neutral-100">
                  Platform view-as: {viewAsTeamName}
                </h1>
                <p className="text-neutral-400 text-sm">
                  본인 dashboard 는 본인 팀의 데이터 입니다. {viewAsTeamName} 팀의 멤버 사용량을 보려면 어드민 → 팀원 으로 가세요.
                </p>
                <div className="flex flex-col gap-2">
                  <a
                    href="/admin/members"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-semibold text-white"
                  >
                    어드민 → 팀원
                  </a>
                  <a
                    href="/platform-admin/all-users"
                    className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 rounded text-sm font-mono text-neutral-200"
                  >
                    All Users 로
                  </a>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-neutral-100">
                  {t.dashboardAdminBanner.title}
                </h1>
                <p className="text-neutral-400 text-sm">{t.dashboardAdminBanner.body}</p>
                <div className="flex flex-col gap-2">
                  <a
                    href="/admin/members"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-semibold text-white"
                  >
                    Admin
                  </a>
                  <a
                    href="/setup"
                    className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 rounded text-sm font-mono text-neutral-200"
                  >
                    {t.dashboardAdminBanner.cta}
                  </a>
                </div>
              </>
            )}
          </main>
        </div>
      );
    }

    // 서버 모드 (5명) — 외부 npx 명령으로 sync 안내
    const syncCmd = `npx github:${process.env.NEXT_PUBLIC_GITHUB_ORG ?? "eugene-eee-hongkyu"}/ai-usage-tracker sync`;
    return (
      <div className="min-h-screen bg-neutral-950">
        <header className="border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
          <span className="font-mono font-bold text-neutral-200">z21labs Usage</span>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-sm text-neutral-500 hover:text-neutral-300 font-mono">logout</button>
        </header>
        <main data-testid="dash-sync-needed" className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
          <h1 className="text-2xl font-bold text-neutral-100 font-mono">{t.dashboard.syncNeeded.title}</h1>
          <p className="text-neutral-400 text-sm font-mono">{t.dashboard.syncNeeded.body}</p>
          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded px-4 py-3 text-left">
            <code data-testid="dash-sync-cmd" className="flex-1 text-sm text-cyan-400 font-mono break-all">{syncCmd}</code>
            <button
              data-testid="dash-sync-copy"
              onClick={() => { navigator.clipboard.writeText(syncCmd); setSyncCopied(true); setTimeout(() => setSyncCopied(false), 2000); }}
              className="shrink-0 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded font-mono"
            >{syncCopied ? "✓" : t.dashboard.syncNeeded.copy}</button>
          </div>
        </main>
      </div>
    );
  }

  const ov = data.overview;
  // period 별 기대 날짜로 fill — 사용 안 한 날도 0 (dimmed) 으로 표시.
  // "all" period 는 fill 없이 데이터 있는 날만.
  const expectedDates = expectedDateRange(period, userTz, data.snapshot);
  const dailyCostByFull: Record<string, { cost: number; sessions: number }> = {};
  for (const d of data.daily) dailyCostByFull[d.date] = { cost: d.cost, sessions: d.sessions };
  const tokenByFull: Record<string, number> = {};
  for (const t of data.dailyTokens ?? []) tokenByFull[t.date] = t.totalTokens;
  const sourceFullDates: string[] = expectedDates ?? data.daily.map((d) => d.date);
  const chartData = sourceFullDates.map((fullDate) => {
    const row = dailyCostByFull[fullDate];
    return {
      date: fullDate.slice(5),
      cost: row?.cost ?? 0,
      sessions: row?.sessions ?? 0,
      empty: !row,
    };
  });
  const chartTokenData = sourceFullDates.map((fullDate) => {
    const tokens = tokenByFull[fullDate] ?? 0;
    return { date: fullDate.slice(5), tokens, empty: tokens === 0 };
  });
  const maxProjectCost = Math.max(...data.projects.map((p) => p.cost), 0.01);
  const maxSessionCost = Math.max(...data.topSessions.map((s) => s.cost), 0.01);

  // MCP Servers 카드 — today period 면 Active Blocks 가 미표시라 빈 슬롯이
  // 생김. 그 자리에 MCP 를 올려 한 줄 절약. 그 외 period 는 Row 7 에 표시.
  const mcpServersBlock = (
    <div data-testid="dash-card-mcp" data-track-dwell="mcp" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-cyan-500 rounded">
      <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">MCP Servers</span>
        {(data.mcpServers ?? []).length > 15 && (
          <span className="flex items-center gap-1 text-[10px] font-mono bg-cyan-900/40 text-cyan-300 border border-cyan-700/60 rounded px-1.5 py-0.5">
            ↕ scroll · {(data.mcpServers ?? []).length}
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="flex text-xs text-neutral-600 font-mono mb-1.5">
          <span className="flex-1">server</span>
          <span className="w-16 text-right">calls</span>
        </div>
        <div className={(data.mcpServers ?? []).length > 15 ? "overflow-y-auto max-h-[300px] no-scrollbar" : ""}>
          <div className="space-y-1">
            {(data.mcpServers ?? []).map((m) => {
              const maxCalls = Math.max(...(data.mcpServers ?? []).map((x) => x.calls), 0.01);
              return (
                <div key={m.name} className="flex items-center gap-1.5 text-xs font-mono">
                  <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                    <div className="h-full bg-cyan-500 rounded" style={{ width: `${(m.calls / maxCalls) * 100}%` }} />
                  </div>
                  <span className="flex-1 text-neutral-300 truncate">{m.name}</span>
                  <span className="w-16 text-blue-400 text-right">{m.calls.toLocaleString()}</span>
                </div>
              );
            })}
            {(data.mcpServers ?? []).length === 0 && <p className="text-neutral-600 text-xs font-mono">no data</p>}
          </div>
        </div>
      </div>
    </div>
  );

  // Dwell heatmap 카드 — 토글 안 새 Row 에서 MCP 와 짝. 기존 Row 6 우측 위치에서
  // 이동. (사용자 요청: core/shell 아래로)
  const dwellHeatmapBlock = (data.visitDaily ?? []).length > 0 ? (() => {
    const rows = data.visitDaily ?? [];
    const calData = rows.map((row) => {
      const min = Math.round(row.dwellSec / 60);
      const sec = row.dwellSec;
      const level: 0 | 1 | 2 | 3 | 4 =
        sec === 0 ? 0 :
        sec < 120 ? 1 :
        sec < 300 ? 2 :
        sec < 900 ? 3 :
        4;
      return { date: row.date, count: min, level };
    });
    // monthKey 는 사용자 timezone 기준 — 옛 UTC `.toISOString().slice(0, 7)` 은
    // KST/SGT 사용자가 매월 1일 자정~9시 사이에 이번 달 visits 0 으로 표시되는
    // boundary mismatch. daily_visits.date 가 사용자 timezone 으로 저장되므로
    // client 도 동일 timezone 으로 filter.
    const monthKey = (() => {
      try {
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: userTz,
          year: "numeric",
          month: "2-digit",
        }).formatToParts(new Date());
        const y = parts.find((p) => p.type === "year")?.value ?? "0000";
        const mo = parts.find((p) => p.type === "month")?.value ?? "01";
        return `${y}-${mo}`;
      } catch {
        return new Date().toISOString().slice(0, 7);
      }
    })();
    const monthRows = rows.filter((r) => r.date.startsWith(monthKey));
    const monthVisitsTotal = monthRows.reduce((s, r) => s + r.visitCount, 0);
    const monthDwellTotal = monthRows.reduce((s, r) => s + r.dwellSec, 0);
    const avgDwellSec = monthVisitsTotal > 0 ? Math.round(monthDwellTotal / monthVisitsTotal) : 0;
    const avgMinSec = `${Math.floor(avgDwellSec / 60)}:${String(avgDwellSec % 60).padStart(2, "0")}`;
    return (
      <div data-testid="dash-card-dwell-heatmap" data-track-dwell="dwell_heatmap" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-amber-500 rounded">
        <div className="px-3 py-2 border-b border-neutral-800">
          <span data-testid="dash-heatmap-dwell" className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
            {tmpl(t.dashboardView.dwellHeatmapLabel, { weeks: Math.round(rows.length / 7) })}
            {monthVisitsTotal > 0 && tmpl(t.dashboardView.dwellMonthVisits, { n: monthVisitsTotal, time: avgMinSec })})
          </span>
        </div>
        <div className="p-3 flex justify-center [&>article]:!items-center">
          <ActivityCalendar
            data={calData}
            colorScheme="dark"
            theme={{ dark: ["#1e293b", "#854d0e", "#a16207", "#ca8a04", "#facc15"] }}
            labels={{ legend: { less: "0", more: "15+" } }}
            showWeekdayLabels
            blockSize={14}
            blockMargin={4}
            showTotalCount={false}
          />
        </div>
      </div>
    );
  })() : <div />;

  // 일별 토큰 단가 (plan amortized) — (monthlyPrice/30) / 일별 토큰 × 1M.
  // 팀 화면의 BY MEMBER 카드와 동일 공식. emerald = plan 활용 효율 컨셉.
  const unitCostBlock = (
    <div data-testid="dash-card-unit-cost" data-track-dwell="unit_cost" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-emerald-500 rounded">
      <div className="px-3 py-2 border-b border-neutral-800">
        <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
          {t.dashboard.cards.unitCost}
          <span className="ml-1.5 text-neutral-500 normal-case font-normal">(log)</span>
        </span>
      </div>
      <div className="p-3">
        {(() => {
          const planUnitCostData = (data.dailyPlanUnitCost ?? []).map((row) => ({
            date: row.date.slice(5),
            unitCost: row.unitCost,
          }));
          // API tier (PAYG) 면 plan 단가 자체가 의미 없음 (monthlyPrice=0). 차트 미표시.
          const isApiTier = data.planHealth?.declaredLimits?.tier === "api";
          if (isApiTier) {
            return (
              <p className="text-neutral-600 text-xs font-mono leading-relaxed">
                API 종량제 사용자입니다. Plan 단가 비교는 N/A.
              </p>
            );
          }
          // unitCost 가 0 이거나 null 만 있으면 데이터 부족.
          const hasData = planUnitCostData.some((u) => u.unitCost != null && u.unitCost > 0);
          if (!hasData) {
            return (
              <p className="text-neutral-600 text-xs font-mono">
                {t.dashboard.cards.noActivityHint}
              </p>
            );
          }
          // 기준선 2개 — 본인 기간 평균(회색) + API PAYG 환산 평균(황색).
          // 글로벌/팀 평균을 안 쓰는 이유: 워크로드 이질성 + upward social
          // comparison 디모티베이션 (Obloj·Zenger 2017) + JMIR RCT 가
          // personal baseline > population average 효과 확인.
          // 평균은 active 일 unitCost 의 산술 평균 (낮을수록 좋음 메시지 유지).
          const tokensByDateKey: Record<string, number> = {};
          for (const t of data.dailyTokens ?? []) {
            tokensByDateKey[t.date.slice(5)] = t.totalTokens;
          }
          const costByDateKey: Record<string, number> = {};
          for (const d of data.daily) costByDateKey[d.date.slice(5)] = d.cost;
          const planUnitVals: number[] = [];
          const apiUnitVals: number[] = [];
          for (const row of planUnitCostData) {
            if (row.unitCost != null) planUnitVals.push(row.unitCost);
            const tokens = tokensByDateKey[row.date] ?? 0;
            const cost = costByDateKey[row.date] ?? 0;
            if (tokens > 0 && cost > 0) apiUnitVals.push((cost / tokens) * 1_000_000);
          }
          const personalAvg = planUnitVals.length > 0
            ? planUnitVals.reduce((s, v) => s + v, 0) / planUnitVals.length
            : null;
          const apiAvg = apiUnitVals.length > 0
            ? apiUnitVals.reduce((s, v) => s + v, 0) / apiUnitVals.length
            : null;
          const fmtUnit = (n: number) =>
            n >= 1 ? `$${n.toFixed(2)}` : n >= 0.01 ? `$${n.toFixed(3)}` : `$${n.toFixed(4)}`;
          return (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={planUnitCostData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" stroke="#525252" fontSize={10} interval="preserveStartEnd" />
                  <YAxis
                    stroke="#525252"
                    fontSize={10}
                    scale="log"
                    domain={[0.001, "auto"]}
                    tickFormatter={(v) => {
                      const n = Number(v);
                      return n >= 0.01 ? `$${n.toFixed(2)}` : `$${n.toFixed(3)}`;
                    }}
                  />
                  <Tooltip
                    contentStyle={{ background: "#0a0a0a", border: "1px solid #404040", fontSize: 11, fontFamily: "monospace" }}
                    formatter={(v) => {
                      if (v == null) return ["—", "unit cost"];
                      const n = Number(v);
                      const s = n >= 1 ? `$${n.toFixed(2)}` : n >= 0.01 ? `$${n.toFixed(3)}` : `$${n.toFixed(4)}`;
                      return [`${s} / 1M`, "unit cost"];
                    }}
                  />
                  {personalAvg !== null && (
                    <ReferenceLine
                      y={personalAvg}
                      stroke="#a3a3a3"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                      ifOverflow="hidden"
                    />
                  )}
                  {apiAvg !== null && (
                    <ReferenceLine
                      y={apiAvg}
                      stroke="#f59e0b"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                      ifOverflow="extendDomain"
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="unitCost"
                    stroke="#10b981"
                    strokeWidth={1.75}
                    dot={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11px] font-mono">
                <span className="inline-flex items-center gap-1.5 text-emerald-400">
                  <span className="inline-block w-3 h-[2px] bg-emerald-500" />
                  {t.dashboard.cards.unitCostLegendActual}
                </span>
                {personalAvg !== null && (
                  <span className="inline-flex items-center gap-1.5 text-neutral-400">
                    <span
                      className="inline-block w-3 border-t border-dashed"
                      style={{ borderColor: "#a3a3a3" }}
                    />
                    {t.dashboard.cards.unitCostLegendPersonalAvg} {fmtUnit(personalAvg)}
                  </span>
                )}
                {apiAvg !== null && (
                  <span className="inline-flex items-center gap-1.5 text-amber-500/90">
                    <span
                      className="inline-block w-3 border-t border-dashed"
                      style={{ borderColor: "#f59e0b" }}
                    />
                    {t.dashboard.cards.unitCostLegendApiAvg} {fmtUnit(apiAvg)}
                  </span>
                )}
              </div>
              <p className="text-[12px] font-mono text-neutral-600 mt-1.5">
                {t.dashboard.cards.unitCostHint}
              </p>
            </>
          );
        })()}
      </div>
    </div>
  );

  // Plan Savings KPI — fintech stat card pattern: 빅 넘버 (절약 금액) + 트렌드
  // 화살표 + 비교 막대. team 카드와 동일 디자인.
  const planSavingsBlock = (
    <div data-testid="dash-card-plan-savings" data-track-dwell="plan_savings" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-emerald-500 rounded">
      <div className="px-3 py-2 border-b border-neutral-800">
        <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
          {t.dashboard.cards.planSavings}
        </span>
      </div>
      <div className="p-4">
        {(() => {
          const apiCost = chartData.reduce((s, d) => s + (d.cost ?? 0), 0);
          const planCost = data.planHealth?.priceForPeriod ?? null;
          const isApiTier = data.planHealth?.declaredLimits?.tier === "api";
          // API tier (PAYG) — plan 가격이 0 이라 절감 개념 N/A. 실제 사용 비용만 표시.
          if (isApiTier) {
            const fmt = (v: number) =>
              v >= 100 ? `$${Math.round(v).toLocaleString()}` :
              v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(2)}`;
            return (
              <div className="space-y-2">
                <p className="text-[11px] text-neutral-500 font-mono uppercase tracking-wider">API 종량제</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-amber-300 text-3xl font-mono font-bold tracking-tight">{fmt(apiCost)}</span>
                  <span className="text-xs text-neutral-500 font-mono">실제 사용 비용</span>
                </div>
                <p className="text-[11px] text-neutral-600 font-mono leading-relaxed">
                  Plan 가격 비교 N/A — Anthropic API 직접 결제 (PAYG). Plan 절감 개념 적용 X.
                </p>
              </div>
            );
          }
          if (planCost == null || planCost <= 0) {
            // activity 0 + tier 미입력 케이스만 도달.
            return (
              <p className="text-neutral-600 text-xs font-mono">
                {t.dashboard.cards.noActivityHint}
              </p>
            );
          }
          const saved = apiCost - planCost;
          const savedPct = apiCost > 0 ? Math.round((saved / apiCost) * 100) : null;
          const positive = saved > 0;
          const fmt = (v: number) =>
            v >= 1000 ? `$${(v / 1000).toFixed(1)}k`.replace(".0k", "k") :
            v >= 100 ? `$${v.toFixed(0)}` :
            v >= 1 ? `$${v.toFixed(1)}` : `$${v.toFixed(2)}`;
          const fmtExact = (v: number) =>
            v >= 100 ? `$${Math.round(v).toLocaleString()}` :
            v >= 1 ? `$${v.toFixed(1)}` : `$${v.toFixed(2)}`;
          const limits = data.planHealth?.declaredLimits ?? null;
          const tierLabel = limits?.label ?? null;
          const monthlyPrice = limits?.monthlyPriceUsd ?? null;
          const isEstimated = data.planHealth?.isEstimatedTier === true;
          const barMax = Math.max(apiCost, planCost);
          const apiPct = (apiCost / barMax) * 100;
          const planPct = (planCost / barMax) * 100;
          // 본전 회수 hero (이번 달, period 무관). monthRecovery 가 있으면
          // 메인 framing — 사용자 인터뷰 "월 요금제 뽕 뽑기". 없으면 기존
          // period 별 절감 hero 로 fallback (API tier / tier 미입력 / 데이터 0).
          const mr = data.planHealth?.monthRecovery ?? null;
          return (
            <div className="space-y-4">
              {/* HERO: 이번 달 본전 회수 (있을 때) — 회수율 + 절감액 + 본전 돌파일 */}
              {mr && mr.monthlyPriceUsd > 0 ? (
                <div data-testid="dash-plan-recovery-hero">
                  <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-1">
                    이번 달 본전 회수
                  </p>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className={`text-3xl sm:text-4xl font-mono font-bold tracking-tight ${
                      mr.recoveryPct >= 100 ? "text-emerald-400" : "text-neutral-200"
                    }`}>
                      {mr.recoveryPct}%
                    </span>
                    {mr.recoveryPct >= 100 ? (
                      <span className="text-emerald-300 text-sm font-mono">
                        ▼ {fmtExact(mr.monthCostUsd - mr.monthlyPriceUsd)} 절감
                      </span>
                    ) : (
                      <span className="text-neutral-400 text-sm font-mono">
                        본전까지 {fmtExact(mr.monthlyPriceUsd - mr.monthCostUsd)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-neutral-500 mt-1.5">
                    Plan ${mr.monthlyPriceUsd} · 사용 {fmtExact(mr.monthCostUsd)}
                  </p>
                  <div className="text-[11px] font-mono text-neutral-500 mt-1 space-y-0.5">
                    {mr.breakEvenDate ? (
                      <p>본전 돌파일 <span className="text-emerald-300">{mr.breakEvenDate.slice(5)} ✓</span></p>
                    ) : (
                      <p>본전 미회수 · {mr.monthDaysTotal - mr.monthDaysElapsed}일 남음</p>
                    )}
                    {mr.remainingEstimateUsd > 0 && (
                      <p>
                        남은 기간 예상{" "}
                        <span className={mr.recoveryPct >= 100 ? "text-emerald-300" : "text-neutral-300"}>
                          {mr.recoveryPct >= 100 ? "+" : ""}{fmtExact(mr.remainingEstimateUsd)}
                        </span>
                      </p>
                    )}
                    {/* period 별 절감 보조 — 사용자가 토글한 period 의 절감액
                        (이번 달 본전 회수와 별개 정보). period=month 면 본전
                        회수와 중복이라 안 보임. */}
                    {period !== "month" && savedPct !== null && positive && (
                      <p className="pt-1 border-t border-neutral-800/60 mt-1">
                        이번 {periodLabel(period, t)} 절감{" "}
                        <span className="text-emerald-400">▼ {fmtExact(saved)}</span>{" "}
                        <span className="text-neutral-600">({savedPct}%)</span>
                      </p>
                    )}
                    {period !== "month" && savedPct !== null && !positive && (
                      <p className="pt-1 border-t border-neutral-800/60 mt-1">
                        이번 {periodLabel(period, t)}{" "}
                        <span className="text-rose-400">▲ {fmtExact(Math.abs(saved))} 초과</span>
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  {savedPct !== null && positive && (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-emerald-400 text-3xl sm:text-4xl font-mono font-bold tracking-tight">
                          ▼ {fmtExact(saved)}
                        </span>
                      </div>
                      <p className="text-[13px] font-mono text-emerald-300/80 mt-1">
                        {savedPct}% {t.dashboard.cards.planSavingsSavedLabel}
                      </p>
                    </>
                  )}
                  {savedPct !== null && !positive && (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-rose-400 text-3xl sm:text-4xl font-mono font-bold tracking-tight">
                          ▲ {fmtExact(Math.abs(saved))}
                        </span>
                      </div>
                      <p className="text-[13px] font-mono text-rose-300/80 mt-1">
                        {Math.abs(savedPct)}% over
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* 비교 막대 — Plan 없을 때 vs Plan 비용 비율 */}
              <div className="space-y-2.5">
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">
                      {t.dashboard.cards.planSavingsApiLabel}
                    </span>
                    <span className="text-amber-300 font-mono font-bold tabular-nums">{fmt(apiCost)}</span>
                  </div>
                  <div className="h-2 bg-neutral-800/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${apiPct}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">
                      {t.dashboard.cards.planSavingsPlanLabel}
                      {tierLabel && monthlyPrice !== null && (
                        <span className={`ml-2 normal-case ${isEstimated ? "text-amber-500/70" : "text-neutral-600"}`}>
                          {tierLabel} · ${monthlyPrice}{t.dashboard.cards.planSavingsMonthlySuffix}
                          {isEstimated && ` (${t.dashboard.cards.planSavingsEstimatedLabel})`}
                        </span>
                      )}
                    </span>
                    <span className="text-neutral-100 font-mono font-bold tabular-nums">{fmt(planCost)}</span>
                  </div>
                  <div className="h-2 bg-neutral-800/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-300 rounded-full transition-all"
                      style={{ width: `${planPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );

  // Efficiency Metrics
  const efficiencyBlock = (
    <div data-testid="dash-card-efficiency" data-track-dwell="efficiency" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-fuchsia-500 rounded">
      <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-fuchsia-400 uppercase tracking-wider">Efficiency</span>
        {(() => {
          const costPs = ov.sessions > 0 ? ov.cost / ov.sessions : 0;
          const grade = badgeGradeFromScore(ov.periodScore);
          return (
            <div className="relative group/grade">
              <span data-testid="dash-grade-overall" className={`text-xs font-mono font-bold px-2 py-0.5 rounded border cursor-default ${GRADE_STYLES[grade]}`}>
                {gradeLabel(grade, t)}
              </span>
              {grade !== "good" && (
                <div className="absolute right-0 top-full mt-1 z-50 opacity-0 invisible group-hover/grade:opacity-100 group-hover/grade:visible transition-all duration-100 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-3 w-[580px]">
                  <p className="text-[10px] font-mono text-slate-500 mb-2.5 uppercase tracking-wider">{t.dashboardView.gradeCriteria}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <MiniGradeTable m={t} title="Cache hit" rows={cacheRows(t)} current={cacheHitGrade(ov.cacheHitPct)} />
                    <MiniGradeTable m={t} title="One-shot rate" rows={oneshotRows(t)} current={oneShotGrade(Math.round(ov.oneShotRate * 100))} />
                    <MiniGradeTable m={t} title="Cost / session" rows={costRows(t)} current={costGrade(costPs)} />
                    <MiniGradeTable m={t} title={tmpl(t.dashboardView.usageWithLevel, { lvl: computeTokenLevel(ov.avgDailyTokens) })} rows={tokenRows(t)} current={tokenLevelToGrade(computeTokenLevel(ov.avgDailyTokens))} />
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
      <div className="p-3 font-mono">
        <div className="flex text-xs text-neutral-600 mb-1.5">
          <span className="flex-1">metric</span>
          <span>value</span>
        </div>
        {(() => {
          const costPerSession = ov.sessions > 0 ? ov.cost / ov.sessions : 0;
          const callsPerSession = ov.sessions > 0 ? Math.round(ov.calls / ov.sessions) : 0;
          const BAD: GradeLevel[] = ["moderate", "insufficient", "warning"];
          const isBad = (g: GradeLevel) => BAD.includes(g);
          const tokenLvl = computeTokenLevel(ov.avgDailyTokens);
          const gradedRows = [
            {
              tid: "cache",
              label: "Cache hit",
              value: `${ov.cacheHitPct.toFixed(1)}%`,
              color: "text-emerald-400",
              grade: cacheHitGrade(ov.cacheHitPct),
              gradeRows: cacheRows(t),
              gradeTitle: "Cache hit",
              onDesc: () => setShowCacheModal(true),
              onAct: () => setShowCacheMethodsModal(true),
              actLabel: t.dashboardView.increase,
            },
            {
              tid: "oneshot",
              label: "One-shot rate",
              value: `${Math.round(ov.oneShotRate * 100)}%`,
              color: "text-violet-400",
              grade: oneShotGrade(Math.round(ov.oneShotRate * 100)),
              gradeRows: oneshotRows(t),
              gradeTitle: "One-shot rate",
              onDesc: () => setShowOneShotModal(true),
              onAct: () => setShowOneShotMethodsModal(true),
              actLabel: t.dashboardView.increase,
            },
            {
              tid: "cost-session",
              label: "Cost / session",
              value: ov.sessions > 0 ? fmt$(costPerSession) : "$0.00",
              color: "text-yellow-400",
              grade: costGrade(costPerSession),
              gradeRows: costRows(t),
              gradeTitle: "Cost / session",
              onDesc: () => setShowCostModal(true),
              onAct: () => setShowCostMethodsModal(true),
              actLabel: t.dashboardView.decrease,
            },
            {
              tid: "tokens",
              label: t.dashboardView.usage,
              value: ov.avgDailyTokens > 0 ? `${tokenLvl}/10 · ${fmtTokensShort(ov.avgDailyTokens)}` : "0",
              color: "text-cyan-400",
              grade: tokenLevelToGrade(tokenLvl),
              gradeRows: tokenRows(t),
              gradeTitle: tmpl(t.dashboardView.usageWithLevel, { lvl: tokenLvl }),
              onDesc: () => setShowTokenModal(true),
              onAct: () => setShowTokenModal(true),
              actLabel: t.dashboardView.moreUsage,
            },
          ];
          const referenceRows = [
            {
              tid: "calls-session",
              label: "Calls / session",
              value: callsPerSession.toString(),
              color: "text-blue-400",
              grade: null as GradeLevel | null,
              gradeRows: null as [GradeLevel, string, string][] | null,
              gradeTitle: "",
              onDesc: () => setShowCallsModal(true),
              onAct: () => setShowCallsMethodsModal(true),
              actLabel: t.dashboardView.optimize,
            },
            {
              tid: "cost-call",
              label: "Cost / call",
              value: ov.calls > 0 ? `$${(ov.costPerCall ?? 0).toFixed(3)}` : "$0.000",
              color: "text-orange-400",
              grade: null as GradeLevel | null,
              gradeRows: null as [GradeLevel, string, string][] | null,
              gradeTitle: "",
              onDesc: () => setShowCostCallModal(true),
              onAct: () => setShowCostCallMethodsModal(true),
              actLabel: t.dashboardView.decrease,
            },
          ];
          type MetricRow = (typeof gradedRows)[number] | (typeof referenceRows)[number];
          const renderRow = ({ tid, label, value, color, grade, gradeRows, gradeTitle, onDesc, onAct, actLabel }: MetricRow) => (
            <div key={label} data-testid={`dash-metric-${tid}`} className="flex items-center text-xs py-0.5 gap-2">
              <span className="text-neutral-400 w-36 shrink-0 whitespace-nowrap">{label}</span>
              <span className="flex gap-1 shrink-0 w-24">
                <TipBtn testid={`dash-tip-${tid}-desc`} label={t.dashboardView.explain} onClick={onDesc} variant="explain" />
                {grade && isBad(grade) && <TipBtn testid={`dash-tip-${tid}-act`} label={actLabel} onClick={onAct} />}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <span className={`font-bold ${color}`}>{value}</span>
                {grade && gradeRows ? (
                  <div className="relative group/mbadge">
                    <span data-testid={`dash-metric-${tid}-grade`} className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border w-14 text-center block cursor-default ${GRADE_STYLES[grade]}`}>{gradeLabel(grade, t)}</span>
                    <div className="absolute right-0 top-full mt-1 z-50 opacity-0 invisible group-hover/mbadge:opacity-100 group-hover/mbadge:visible transition-all duration-100 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-3 w-72">
                      <MiniGradeTable m={t} title={gradeTitle} rows={gradeRows} current={grade} />
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-transparent w-14 text-center block" aria-hidden>&nbsp;</span>
                )}
              </div>
            </div>
          );
          return (
            <>
              {gradedRows.map(renderRow)}
              {/* 시각 그룹 분리 — 등급 (행동 가이드) vs 참고 (diagnostic). */}
              <div className="mt-2 pt-1.5 border-t border-neutral-800/60 flex items-center">
                <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-wider">{t.dashboardView.referenceFigures}</span>
              </div>
              {referenceRows.map(renderRow)}
            </>
          );
        })()}
      </div>
    </div>
  );

  // 비용 원인 Top 3 — 사용자 needs 1 (얼마나 썼나 + 어디에) 직접. period
  // 따라 Project / Model / Activity 각 1위만 1줄씩. 자세히 보기 안 흩어진
  // BY MODEL / BY PROJECT / BY ACTIVITY 의 핵심 summary. 모든 기간 토글
  // 에서 의미 (오늘 / 8일 / 30일 / 이번달 / 전체).
  const costCauseTop3Block = (() => {
    const topProject = (data.projects ?? []).sort((a, b) => b.cost - a.cost)[0];
    const topModel = (data.models ?? []).sort((a, b) => b.cost - a.cost)[0];
    const topActivity = (data.activities ?? []).sort((a, b) => b.cost - a.cost)[0];
    const hasAny = topProject || topModel || topActivity;
    if (!hasAny) return null;
    const fmtCost = (v: number) =>
      v >= 1000 ? `$${(v / 1000).toFixed(1)}k`.replace(".0k", "k") :
      v >= 100 ? `$${Math.round(v).toLocaleString()}` :
      v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(2)}`;
    type Row = { label: string; name: string; cost: number; color: string };
    const rows: Row[] = [];
    if (topProject) rows.push({ label: "Project", name: topProject.name, cost: topProject.cost, color: "text-yellow-300" });
    if (topModel) rows.push({ label: "Model", name: topModel.name, cost: topModel.cost, color: "text-pink-300" });
    if (topActivity) rows.push({ label: "Activity", name: topActivity.name, cost: topActivity.cost, color: "text-violet-300" });
    return (
      <div data-testid="dash-card-cost-top3" data-track-dwell="cost_top3" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-amber-500 rounded">
        <div className="px-3 py-2 border-b border-neutral-800">
          <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
            비용 원인 Top 3 · {periodLabel(period, t)}
          </span>
        </div>
        <div className="p-3 space-y-1.5">
          {rows.map((r, i) => (
            <div key={r.label} className="grid grid-cols-[6rem_minmax(0,1fr)_5rem] gap-x-3 items-baseline text-xs font-mono">
              <span className="text-neutral-500 whitespace-nowrap overflow-hidden text-ellipsis">{i + 1}. {r.label}</span>
              {/* ellipsis 위치: 끝이 아니라 앞 — 프로젝트 path 처럼 뒤쪽 segment
                  (예: coding/four-pillars) 가 정보 가치 크고 앞쪽 (/Users/eugene/
                  Downloads/) 은 잘려도 됨. CSS direction:rtl 트릭. */}
              <span
                className={`${r.color} font-bold min-w-0 overflow-hidden whitespace-nowrap block`}
                style={{ direction: "rtl", textAlign: "left", textOverflow: "ellipsis" }}
                title={r.name}
              >
                <bdi>{r.name}</bdi>
              </span>
              <span className="text-yellow-400 text-right tabular-nums font-bold whitespace-nowrap">{fmtCost(r.cost)}</span>
            </div>
          ))}
          <p className="text-[10px] font-mono text-neutral-600 pt-1.5 border-t border-neutral-800/60 mt-1">
            선택한 기간 기준으로 비용이 가장 많이 발생한 원인. 자세한 분포는 자세히 보기 안 By Model / Project / Activity 참고.
          </p>
        </div>
      </div>
    );
  })();

  // L. CACHE HIT STREAK 카드 — 사용자 피드백 efficiency 옆 자리.
  // data.efficiencyScore.streak + teamRank 데이터 재사용. period 무관 항상
  // 현재 시점 streak.
  const cacheStreakBlock = (() => {
    const s = data.efficiencyScore;
    if (!s) return null;
    return (
      <div data-testid="dash-card-cache-streak" data-track-dwell="cache_streak" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-orange-500 rounded">
        <div className="px-3 py-2 border-b border-neutral-800">
          <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-wider">
            Cache Hit Streak
          </span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-4">
            <span className="text-4xl leading-none">🔥</span>
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-mono font-bold leading-none ${s.streak >= 7 ? "text-orange-400" : s.streak >= 1 ? "text-neutral-200" : "text-neutral-600"}`}>
                  {s.streak}
                </span>
                <span className="text-sm font-mono text-neutral-400">{t.common.daysShort}</span>
              </div>
              <span className="text-[11px] font-mono text-neutral-500 mt-1">
                cache hit ≥ 90% 연속 · {t.dashboardView.streakSkip}
              </span>
            </div>
          </div>
          {s.teamRank ? (
            <div className="pt-2 border-t border-neutral-800/60">
              <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-1.5">
                {t.dashboardView.weekTeamCacheRank}
              </p>
              <div className="flex items-center gap-3">
                <span className="text-2xl leading-none">{rankMedal(s.teamRank.position) || "🏅"}</span>
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-mono font-bold leading-none text-sky-300">
                      {s.teamRank.position}
                    </span>
                    <span className="text-xs font-mono text-neutral-500">
                      {tmpl(t.dashboardView.rankOutOf, { n: s.teamRank.total })}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-500 mt-0.5">
                    {tmpl(t.dashboardView.rankMeTeam, { self: s.teamRank.selfCacheHitPct.toFixed(1), team: s.teamRank.teamAvgCacheHitPct.toFixed(1) })}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  })();

  // Daily Cost block — main Row 1 (Daily Activity 옆) + 자세히 보기 안
  // Efficiency 옆 두 곳에서 재사용 (사용자 피드백: 진단성 차트로도 옆에).
  const dailyCostBlock = (
    <div data-testid="dash-card-daily-cost" data-track-dwell="daily_cost" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-yellow-500 rounded">
      <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-yellow-400 uppercase tracking-wider">Daily Cost</span>
        {chartData.length > 45 && (
          <span className="flex items-center gap-1 text-[10px] font-mono bg-yellow-900/40 text-yellow-300 border border-yellow-700/60 rounded px-1.5 py-0.5">
            ↕ scroll · {chartData.length}
          </span>
        )}
      </div>
      <div className="p-3">
        {chartData.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-neutral-600 text-xs font-mono">no data</div>
        ) : (
          <div className={chartData.length > 45 ? "overflow-y-auto max-h-[300px] no-scrollbar" : ""}>
            <div className="space-y-1">
              {(() => {
                const maxCost = Math.max(...chartData.map((d) => d.cost), 0.01);
                return chartData.map((d) => (
                  <div key={d.date} className={`flex items-center gap-1.5 text-xs font-mono ${d.empty ? "opacity-40" : ""}`}>
                    <span className={`w-12 shrink-0 whitespace-nowrap ${d.empty ? "text-neutral-700" : "text-neutral-500"}`}>{d.date}</span>
                    <div className="flex-1 h-1.5 bg-neutral-800 rounded overflow-hidden">
                      {!d.empty && (
                        <div className="h-full bg-yellow-500 rounded" style={{ width: `${(d.cost / maxCost) * 100}%` }} />
                      )}
                    </div>
                    <span className={`w-16 text-right shrink-0 ${d.empty ? "text-neutral-700" : "text-yellow-400"}`}>{d.empty ? "—" : fmt$(d.cost)}</span>
                    {d.sessions > 0 && <span className="text-neutral-600 w-8 text-right shrink-0">{d.sessions}s</span>}
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Activity Heatmap (last 13 weeks, cost-based)
  const activityHeatmapBlock = (data.heatmapDaily ?? []).length > 0 ? (() => {
    const calData = (data.heatmapDaily ?? []).map((row) => {
      const cost = row.cost;
      // 임계 근거 (외부 + 내부 데이터):
      //  - level 1 <$5: Anthropic 평균 사용자 ($6) 의 절반 이하
      //  - level 2 $5~25: Anthropic 평균 ~ 엔터 평균 ($6~$13) 포함
      //  - level 3 $25~100: 엔터 90th ($30) 이상 ~ 우리 p75 ($89) 위
      //  - level 4 $100+: 외부 99th + 우리 p90 ($154) + "엄청 했음"
      const level: 0 | 1 | 2 | 3 | 4 =
        cost === 0 ? 0 :
        cost < 5 ? 1 :
        cost < 25 ? 2 :
        cost < 100 ? 3 :
        4;
      return { date: row.date, count: Math.round(cost * 100), level };
    });
    return (
      <div data-testid="dash-card-activity-heatmap" data-track-dwell="activity_heatmap" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-indigo-500 rounded">
        <div className="px-3 py-2 border-b border-neutral-800">
          <span data-testid="dash-heatmap-activity" className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider">{tmpl(t.dashboardView.activityHeatmapLabel, { weeks: Math.round((data.heatmapDaily ?? []).length / 7) })}</span>
        </div>
        <div className="p-3 flex justify-center [&>article]:!items-center">
          <ActivityCalendar
            data={calData}
            colorScheme="dark"
            theme={{ dark: ["#1e293b", "#4338ca", "#6366f1", "#818cf8", "#a5b4fc"] }}
            labels={{ legend: { less: "$0", more: "$100+" } }}
            showWeekdayLabels
            blockSize={14}
            blockMargin={4}
            showTotalCount={false}
            renderBlock={(block, activity) => {
              // today 셀은 amber outline 으로 강조 — "오늘 어디?" 즉시 파악.
              // hover 시 tooltip 으로 그 날 cost 표시 (잔디 패턴과 동일).
              const todayKey = new Date().toISOString().slice(0, 10);
              const isToday = activity.date === todayKey;
              const cost = activity.count / 100; // calData 에서 *100 했던 거 복원
              const label = activity.level === 0
                ? `${tmpl(t.dashboardView.dayCellNoActivity, { date: activity.date })}${isToday ? t.dashboardView.todaySuffix : ""}`
                : `${tmpl(t.dashboardView.dayCellCost, { date: activity.date, cost: cost.toFixed(2) })}${isToday ? t.dashboardView.todaySuffix : ""}`;
              return isToday
                ? React.cloneElement(block, { stroke: "#fbbf24", strokeWidth: 1.5 }, <title>{label}</title>)
                : React.cloneElement(block, {}, <title>{label}</title>);
            }}
          />
        </div>
      </div>
    );
  })() : <div />;

  return (
    <div className={`min-h-screen bg-neutral-950 text-neutral-100 transition-opacity duration-150 ${loading ? "opacity-50 pointer-events-none" : ""}`}>
      <NavComponent />
      <StaleSyncBanner
        lastSyncedAt={data.user.lastSyncedAt}
        hidden={viewOnly || isLocalMode === true}
      />

      {/* Period Tabs */}
      <div className="border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 pt-3 pb-2 flex gap-1 items-center">
          {(["today", "8days", "month", "30days", "all"] as Period[]).map((p) => (
            <button
              key={p}
              data-testid={`dash-period-${p}`}
              onClick={() => {
                track(EVENTS.PERIOD_CLICK, { screen: "dashboard", period: p });
                setPeriod(p);
                // 어떤 period 버튼을 누르든 모든 offset 초기화 → 항상 라이브로 복귀
                setWeekOffset(0);
                setMonthOffset(0);
                setDayOffset(0);
              }}
              className={`w-16 text-center py-1 rounded text-xs font-mono transition-colors ${period === p && !(p === "8days" && weekOffset > 0) && !(p === "month" && monthOffset > 0) && !(p === "today" && dayOffset > 0) ? "bg-indigo-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"}`}
            >{periodLabel(p, t)}</button>
          ))}
          {period === "today" && (data.availableSnapshots?.daily?.length ?? 0) > 0 && (
            <select
              data-testid="dash-day-offset"
              value={dayOffset}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v > 0) track(EVENTS.HISTORICAL_PERIOD_CLICK, { screen: "dashboard", kind: "day", offset: v });
                setDayOffset(v);
              }}
              className={`text-xs font-mono border rounded px-2 py-1 cursor-pointer focus:outline-none ${dayOffset > 0 ? "bg-indigo-600 text-white border-indigo-500" : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200"}`}
            >
              <option value={0}>{t.dashboardView.previous}</option>
              {data.availableSnapshots!.daily!.slice(0, 7).map((s, i) => (
                <option key={s.periodStart} value={i + 1}>
                  {`${dayOffsetLabel(i + 1, t)} (${formatDayLabel(s.periodStart)})`}
                </option>
              ))}
            </select>
          )}
          {period === "8days" && (data.availableSnapshots?.weekly?.length ?? 0) > 0 && (
            <select
              data-testid="dash-week-offset"
              value={weekOffset}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v > 0) track(EVENTS.HISTORICAL_PERIOD_CLICK, { screen: "dashboard", kind: "week", offset: v });
                setWeekOffset(v);
              }}
              className={`text-xs font-mono border rounded px-2 py-1 cursor-pointer focus:outline-none ${weekOffset > 0 ? "bg-indigo-600 text-white border-indigo-500" : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200"}`}
            >
              <option value={0}>{t.dashboardView.previous}</option>
              {data.availableSnapshots!.weekly.slice(0, 5).map((s, i) => (
                <option key={s.periodStart} value={i + 1}>
                  {`${weekOffsetLabel(i + 1, t)} (${formatWeekRange(s.periodStart)})`}
                </option>
              ))}
            </select>
          )}
          {period === "month" && (data.availableSnapshots?.monthly?.length ?? 0) > 0 && (
            <select
              data-testid="dash-month-offset"
              value={monthOffset}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v > 0) track(EVENTS.HISTORICAL_PERIOD_CLICK, { screen: "dashboard", kind: "month", offset: v });
                setMonthOffset(v);
              }}
              className={`text-xs font-mono border rounded px-2 py-1 cursor-pointer focus:outline-none ${monthOffset > 0 ? "bg-indigo-600 text-white border-indigo-500" : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200"}`}
            >
              <option value={0}>{t.dashboardView.previous}</option>
              {data.availableSnapshots!.monthly.slice(0, 6).map((s, i) => (
                <option key={s.periodStart} value={i + 1}>
                  {`${monthOffsetLabel(i + 1, t)} (${formatMonthLabel(s.periodStart)})`}
                </option>
              ))}
            </select>
          )}
          {viewOnly && teamMembers.length > 0 && (
            <select
              data-testid="dash-member-select"
              value={targetUserId}
              onChange={(e) => onMemberSelect ? onMemberSelect(e.target.value) : router.push(`/team/${e.target.value}/dashboard`)}
              className="ml-auto text-xs font-mono bg-neutral-800 text-neutral-300 border border-neutral-700 rounded px-2 py-1 self-center hover:border-neutral-500 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {teamMembers.map((m) => (
                <option key={m.userId} value={m.userId}>{m.name}</option>
              ))}
            </select>
          )}
        </div>
        {/* Multi-provider (2026-05-29 M): Claude / Codex 탭.
            표시 조건 = !supportsMultiProvider (옛 CLI — 업데이트 유도) || hasCodexData (새 CLI + Codex 사용자).
            둘 다 아니면 (새 CLI + Codex 안 씀) 탭 라인 자체 숨김 — 사용자 선택지 없는데 노출 = 노이즈. */}
        {(!data.supportsMultiProvider || data.hasCodexData) && (
          <div className="max-w-6xl mx-auto px-4 pb-2 flex gap-1.5 items-center">
            <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-wider mr-1">provider:</span>
            {(["claude", "codex"] as const).map((prov) => (
              <button
                key={prov}
                data-testid={`dash-provider-${prov}`}
                onClick={() => setProvider(prov)}
                className={`text-xs font-mono border rounded px-3 py-1 transition-colors ${
                  provider === prov
                    ? "bg-indigo-600 text-white border-indigo-500"
                    : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-neutral-500"
                }`}
              >{prov === "claude" ? "Claude Code" : "Codex"}</button>
            ))}
          </div>
        )}
        {/* M6f: device chip row — user 가 노트북 N대 사용 시 표시. 1개면 숨김.
            클릭하면 그 device 의 데이터로 dashboard 갱신. server 가 selectedDeviceId 결정 → 동기화. */}
        {(data.devices?.length ?? 0) >= 2 && (
          <div className="max-w-6xl mx-auto px-4 pb-2 flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-wider mr-1">device:</span>
            {data.devices!.map((dev) => {
              const isSelected = (deviceId ?? data.selectedDeviceId) === dev.tokenId;
              const sinceMs = dev.snapshotUpdatedAt ? Date.now() - new Date(dev.snapshotUpdatedAt).getTime() : null;
              const ageLabel = sinceMs === null
                ? "no data"
                : sinceMs < 3_600_000 ? `${Math.floor(sinceMs / 60_000)}m ago`
                : sinceMs < 86_400_000 ? `${Math.floor(sinceMs / 3_600_000)}h ago`
                : `${Math.floor(sinceMs / 86_400_000)}d ago`;
              const isStale = sinceMs !== null && sinceMs > 3 * 86_400_000;
              const icon = dev.platform === "darwin" ? "🍎" : dev.platform === "win32" ? "🪟" : dev.platform === "linux" ? "🐧" : "💻";
              return (
                <button
                  key={dev.tokenId}
                  data-testid={`dash-device-${dev.tokenId}`}
                  onClick={() => setDeviceId(dev.tokenId)}
                  className={`text-xs font-mono border rounded px-2 py-1 transition-colors flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-500"
                      : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-neutral-500"
                  }`}
                >
                  <span>{icon}</span>
                  <span className="truncate max-w-[160px]">{dev.name}</span>
                  <span className={`text-[10px] ${isStale ? "text-amber-400" : isSelected ? "text-indigo-100" : "text-neutral-500"}`}>
                    · {ageLabel}{isStale ? " ⚠" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* M6f: stale device 경고 — multi-device 사용자에서 한쪽 노트북이 3일+ sync 안 되면
          launchd / Task Scheduler 미동작 가능. 본인 view 만 표시 (admin view-as 면 숨김). */}
      {!viewOnly && (data.devices?.length ?? 0) >= 2 && (() => {
        const staleDevices = (data.devices ?? []).filter((dev) => {
          if (!dev.snapshotUpdatedAt) return true; // 데이터 없음도 stale 취급
          return Date.now() - new Date(dev.snapshotUpdatedAt).getTime() > 3 * 86_400_000;
        });
        if (staleDevices.length === 0) return null;
        return (
          <div data-testid="dash-stale-device-warning" className="bg-amber-900/20 border-b border-amber-700/40">
            <div className="max-w-6xl mx-auto px-4 py-2 flex items-start gap-2 text-xs font-mono">
              <span className="text-amber-400 text-sm shrink-0">⚠</span>
              <div className="flex-1 text-amber-200">
                <span className="font-semibold">
                  {staleDevices.map((d) => d.name).join(", ")}
                </span>{" "}
                <span className="text-amber-300/80">— 3일+ sync 안 됨. 해당 노트북에서 Claude Code 사용 중이라면 install 재실행 필요.</span>
                <a href="/setup-status" className="ml-2 underline hover:text-amber-100">디바이스 확인</a>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Privacy banner — dismiss 가능. 진우님 "프롬프트 저장 여부 궁금" 응답 반영.
          본인 view 만. viewOnly 면 어드민 컨텍스트라 별도 banner 불필요. */}
      {!viewOnly && <PrivacyBanner />}

      {/* Usage Hero (활용지수 + 토큰단가 / API 추천) 는 더 이상 최상단에 두지
          않는다. 사용자 인터뷰에서 진입 후 가장 먼저 확인하는 건 "얼마나 썼나"
          (Daily Activity/Cost) 와 "내 플랜 대비 잘 쓰고 있나" (일별 토큰 단가 +
          Plan 절감) → 활용지수·토큰단가는 한 단계 더 깊은 지표라 main 안쪽
          Row 1.5 다음으로 내림 (아래 embedded=true 렌더 참조). */}

      {/* Overview Bar — 사용자 인터뷰에서 "activity + cost 만 본다" 답이 다수.
          폰트 키우고 hero 수준으로 시각 승격. */}
      <div data-testid="dash-overview-bar" className="bg-neutral-900 border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono">
          {viewOnly && (
            <span className="text-indigo-400 font-semibold self-center mr-2">{data.user.name}</span>
          )}
          {/* hero — activity (tokens) + cost. 사용자 인터뷰 답변에서 가장 자주 보는 두 지표.
              period="today" 면 ov.totalTokensStrictToday (오늘 하루) 사용 — codeburn 의
              today period 가 KST/SGT 사용자에서 어제 + 오늘 spillover 되는 문제 회피. */}
          <span className="flex items-baseline gap-1">
            <span className="text-cyan-400 font-bold text-2xl tabular-nums">
              {fmtTokens(
                ov.totalTokensStrictToday !== null
                  ? ov.totalTokensStrictToday
                  : chartTokenData.reduce((s, d) => s + d.tokens, 0)
              )}
            </span>
            <span className="text-neutral-500 text-xs">tokens</span>
          </span>
          <span className="flex items-baseline gap-1">
            <span className="text-yellow-400 font-bold text-2xl tabular-nums">${ov.cost.toFixed(2)}</span>
            <span className="text-neutral-500 text-xs">cost</span>
          </span>
          {/* secondary — 효율 지표 (cache hit / 1-shot) 만. calls·sessions 는
              "얼마나 썼나" 는 token·cost 로 이미 알 수 있고 hero 띠는 한 줄
              유지 우선이라 제거. */}
          <span className="text-sm"><span className="text-emerald-400 font-bold">{ov.cacheHitPct.toFixed(1)}%</span><span className="text-neutral-500 ml-1 text-xs">cache hit</span></span>
          <span className="text-sm"><span className="text-violet-400 font-bold">{Math.round(ov.oneShotRate * 100)}%</span><span className="text-neutral-500 ml-1 text-xs">1-shot</span></span>
          <span className="text-neutral-600 text-xs self-center ml-auto flex items-center gap-3">
            <span>{tmpl(t.dashboardView.activeNDays, { n: ov.activeDays })}</span>
            {data.snapshot ? (
              <span className="text-amber-400">
                📌 captured {fmtSyncedAt(data.snapshot.capturedAt, userTz)} {tzAbbr(userTz)}
                {data.snapshot.dataRangeStart && data.snapshot.dataRangeEnd && (
                  <span className="text-neutral-500"> · {formatDateRange(data.snapshot.dataRangeStart, data.snapshot.dataRangeEnd)}</span>
                )}
              </span>
            ) : !viewOnly ? (
              <span className="relative">
                {t.dashboardView.lastReceived}{" "}
                <span className="text-neutral-500">{fmtSyncedAt(data.user.lastSyncedAt, userTz)}</span>{" "}
                <button
                  data-testid="dash-tz-btn"
                  onClick={() => setShowTzPicker((v) => !v)}
                  className="text-neutral-600 hover:text-neutral-300 text-[10px] font-mono border border-neutral-700 hover:border-neutral-500 rounded px-1 py-0.5 transition-colors"
                  title={t.dashboardView.tzChangeTitle}
                >{tzAbbr(userTz)}</button>
                {showTzPicker && (
                  <div data-testid="dash-tz-list" className="absolute right-0 top-full mt-1 z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl w-64 py-1 text-left">
                    {TIMEZONE_LIST.map((tz) => (
                      <button
                        key={tz.value}
                        onClick={() => saveTz(tz.value)}
                        className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-neutral-800 transition-colors ${userTz === tz.value ? "text-indigo-400" : "text-neutral-300"}`}
                      >{tz.label}</button>
                    ))}
                  </div>
                )}
              </span>
            ) : (
              <span className="text-neutral-500">
                {t.dashboardView.lastReceived} {fmtSyncedAt(data.user.lastSyncedAt, userTz)}
              </span>
            )}
          </span>
        </div>
      </div>

      <main className="px-4 py-4 space-y-4 max-w-6xl mx-auto">

        {/* Row 1: Daily Activity (tokens) + Daily Cost */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Daily Activity (tokens) */}
          <div data-testid="dash-card-daily-tokens" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-cyan-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">Daily Activity</span>
              {chartTokenData.length > 45 && (
                <span className="flex items-center gap-1 text-[10px] font-mono bg-cyan-900/40 text-cyan-300 border border-cyan-700/60 rounded px-1.5 py-0.5">
                  ↕ scroll · {chartTokenData.length}
                </span>
              )}
            </div>
            <div className="p-3">
              {chartTokenData.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-neutral-600 text-xs font-mono">no data</div>
              ) : (
                <div className={chartTokenData.length > 45 ? "overflow-y-auto max-h-[300px] no-scrollbar" : ""}>
                  <div className="space-y-1">
                    {(() => {
                      const maxTokens = Math.max(...chartTokenData.map((d) => d.tokens), 1);
                      return chartTokenData.map((d) => (
                        <div key={d.date} className={`flex items-center gap-1.5 text-xs font-mono ${d.empty ? "opacity-40" : ""}`}>
                          <span className={`w-12 shrink-0 whitespace-nowrap ${d.empty ? "text-neutral-700" : "text-neutral-500"}`}>{d.date}</span>
                          <div className="flex-1 h-1.5 bg-neutral-800 rounded overflow-hidden">
                            {!d.empty && (
                              <div className="h-full bg-cyan-500 rounded" style={{ width: `${(d.tokens / maxTokens) * 100}%` }} />
                            )}
                          </div>
                          <span className={`w-16 text-right shrink-0 ${d.empty ? "text-neutral-700" : "text-cyan-300"}`}>{d.empty ? "—" : fmtTokens(d.tokens)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Daily Cost — main Row 1. 같은 dailyCostBlock 변수가 자세히
              보기 안 Efficiency 옆에서도 재사용. */}
          {dailyCostBlock}
        </div>

        {/* Row 1.5: 일별 토큰 단가 + Plan 절감.
            API tier (PAYG) 사용자는 단가 비교가 의미 없고 hero 의 추천 플랜 카드가
            대체하므로 이 row 자체를 숨김. */}
        {data.planHealth?.declaredLimits?.tier !== "api" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {unitCostBlock}
            {planSavingsBlock}
          </div>
        )}

        {/* Row 1.6: 활용지수 + 토큰단가 (또는 API 추천). embedded 모드 — main
            grid 안에서 다른 카드 row 들과 동일 스타일. */}
        {data.powerIndex && (
          <UsageHero
            embedded
            powerIndex={data.powerIndex.score}
            activeDays={data.powerIndex.activeDays}
            avgDailyTokens={data.powerIndex.avgDailyTokens}
            periodDays={data.planHealth?.periodDays ?? 30}
            periodLabel={periodLabel(period, t)}
            declaredTier={data.user.planTier ?? null}
            declaredTierLabel={data.planHealth?.declaredLimits?.label ?? null}
            priceForPeriod={data.planHealth?.priceForPeriod ?? null}
            totalWindowTokens={data.planHealth?.totalWindowTokens ?? 0}
            nonCacheTotalWindowTokens={data.planHealth?.nonCacheTotalWindowTokens ?? null}
            cacheHitPctForPeriod={data.planHealth?.cacheHitPctForPeriod ?? null}
            viewOnly={viewOnly}
            isEstimatedTier={data.planHealth?.isEstimatedTier ?? false}
            hasActivity={chartData.some((d) => (d.cost ?? 0) > 0)}
            apiRecommendation={data.planHealth?.apiRecommendation ?? null}
          />
        )}

        {/* Row 2: 팀 내 내 위치 + 활동 히트맵 (반셀 2열). 사용자 피드백:
            팀 내 내 위치가 full-width 차지할 필요 없음 → 활동 히트맵 옆.
            본인 화면 (session.user.name) + admin view-as (data.user.name)
            둘 다. 팀 데이터 없거나 매칭 row 없으면 히트맵만 full-width
            fallback. Efficiency 카드는 자세히 보기로 이동 (사용자 안 본다). */}
        {(() => {
          const targetName = viewOnly ? data.user.name : session?.user?.name;
          if (teamRankData && targetName) {
            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TeamPositionCard
                  team={teamRankData}
                  currentUserName={targetName}
                  periodLabel={periodLabel(period, t)}
                />
                {activityHeatmapBlock}
              </div>
            );
          }
          return activityHeatmapBlock;
        })()}

        {/* Row 2.5 (신설): 비용 원인 Top 3 (반셀) + 빈 자리.
            사용자 needs 1 ('얼마나 + 어디에 썼나') 직접 답 카드. 팀 내 내
            위치 아래 자연스러운 위치. 옆 자리는 추후 다른 카드 추가 자리. */}
        {costCauseTop3Block && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {costCauseTop3Block}
            <div />
          </div>
        )}

        {/* 자세히 보기 토글 — divider + 중앙 라벨 풀폭 패턴 (Medium / Notion 식).
            "여기부터 details" 메타포 + 위·아래 영역 시각 단절. by model · by
            project · top sessions · by activity · core tools · shell · MCP ·
            체류 · Active Blocks 모두 토글 안. localStorage 선호 유지. */}
        <div className="pt-4 pb-1">
          <div className="flex items-center gap-3">
            <hr className="flex-1 border-t border-neutral-800" />
            <button
              type="button"
              onClick={toggleDetails}
              data-testid="dash-toggle-details"
              className="text-sm font-mono text-neutral-400 hover:text-neutral-200 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-600 rounded px-4 py-2 transition-colors shrink-0"
            >
              {detailsOpen ? t.dashboardView.collapseDetails : t.dashboardView.moreDetails}
            </button>
            <hr className="flex-1 border-t border-neutral-800" />
          </div>
          {!detailsOpen && (
            <p className="text-center text-xs font-mono text-neutral-600 mt-2">
              {t.dashboardView.moreDetailsHint}
            </p>
          )}
        </div>

        {detailsOpen && (<>

        {/* Efficiency + Cache Hit Streak — 반셀 2열. 옛 Daily Cost (main Row 1
            과 중복) 자리에 STREAK 으로 교체 — 사용자 피드백. Streak 게이미피
            케이션 + 팀 cache hit 랭킹이 efficiency 진단 옆에 자연스럽게 시너지. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {efficiencyBlock}
          {cacheStreakBlock ?? <div />}
        </div>

        {/* Row 3: By Model + By Project — 비용 분해 그룹 (어디에 썼나) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* By Model */}
          <div data-testid="dash-card-by-model" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-pink-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800">
              <span className="text-xs font-mono font-bold text-pink-400 uppercase tracking-wider">By Model</span>
            </div>
            <div className="p-3">
              <div className="flex text-xs text-neutral-600 font-mono mb-1.5">
                <span className="flex-1">model</span>
                <span className="w-16 text-right">cost</span>
                <span className="w-14 text-right">cache</span>
                <span className="w-14 text-right">calls</span>
              </div>
              <div className="space-y-1">
                {(data.models ?? []).map((m) => {
                  const maxCost = Math.max(...(data.models ?? []).map((x) => x.cost), 0.01);
                  return (
                    <div key={m.name} className="flex items-center gap-1.5 text-xs font-mono">
                      <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                        <div className="h-full bg-pink-500 rounded" style={{ width: `${(m.cost / maxCost) * 100}%` }} />
                      </div>
                      <span className="flex-1 text-neutral-300 truncate">{m.name}</span>
                      <span className="w-16 text-yellow-400 text-right">{fmt$(m.cost)}</span>
                      <span className="w-14 text-emerald-400 text-right">{m.cacheHitPct.toFixed(1)}%</span>
                      <span className="w-14 text-neutral-500 text-right">{m.calls.toLocaleString()}</span>
                    </div>
                  );
                })}
                {(data.models ?? []).length === 0 && <p className="text-neutral-600 text-xs font-mono">no data</p>}
              </div>
            </div>
          </div>

          {/* By Project */}
          <div data-testid="dash-card-by-project" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-yellow-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-yellow-400 uppercase tracking-wider">By Project</span>
              {data.projects.length > 15 && (
                <span className="flex items-center gap-1 text-[10px] font-mono bg-yellow-900/40 text-yellow-300 border border-yellow-700/60 rounded px-1.5 py-0.5">
                  ↕ scroll · {data.projects.length}
                </span>
              )}
            </div>
            <div className="p-3">
              <div className="flex text-xs text-neutral-600 font-mono mb-1.5 pr-1">
                <span className="flex-1">project</span>
                <span className="w-16 text-right">cost</span>
                <span className="w-14 text-right">avg/s</span>
                <span className="w-6 text-right">s</span>
              </div>
              <div className={data.projects.length > 15 ? "overflow-y-auto max-h-[300px] no-scrollbar" : ""}>
                <div className="space-y-1">
                  {data.projects.map((p) => {
                    const displayPath = formatPath(p.path || p.name);
                    return (
                      <div key={p.name} className="flex items-center gap-1.5 text-xs font-mono">
                        <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                          <div className="h-full bg-yellow-500 rounded" style={{ width: `${(p.cost / maxProjectCost) * 100}%` }} />
                        </div>
                        <span className="flex-1 text-neutral-300 overflow-hidden whitespace-nowrap" style={{ direction: "rtl", textOverflow: "ellipsis", textAlign: "left" }} title={p.path || p.name}>{displayPath}</span>
                        <span className="w-16 text-yellow-400 text-right">{fmt$(p.cost)}</span>
                        <span className="w-14 text-neutral-500 text-right">{fmt$(p.avgCost)}</span>
                        <span className="w-6 text-neutral-600 text-right">{p.sessions}</span>
                      </div>
                    );
                  })}
                  {data.projects.length === 0 && (
                    <p className="text-neutral-600 text-xs font-mono">no data</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 4: Top Sessions + By Activity — 이상치 / 카테고리 점검 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Top Sessions */}
          <div data-testid="dash-card-top-sessions" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-red-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800">
              <span className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider">Top Sessions</span>
            </div>
            <div className="p-3">
              <div className="flex text-xs text-neutral-600 font-mono mb-1.5">
                <span className="w-5">#</span>
                <span className="w-20">date</span>
                <span className="flex-1">project</span>
                <span className="w-16 text-right">cost</span>
                <span className="w-16 text-right">calls</span>
              </div>
              <div className="space-y-1">
                {data.topSessions.slice(0, 5).map((s, i) => {
                  const displayPath = formatPath(s.projectPath || s.project);
                  return (
                    <div key={s.id || i} className="flex items-center gap-2 text-xs font-mono">
                      <span className="w-5 text-neutral-600">{i + 1}.</span>
                      <span className="w-24 text-neutral-500 shrink-0 whitespace-nowrap">{s.date}</span>
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                          <div className="h-full bg-red-500 rounded" style={{ width: `${(s.cost / maxSessionCost) * 100}%` }} />
                        </div>
                        <span className="text-neutral-300 overflow-hidden whitespace-nowrap" style={{ direction: "rtl", textOverflow: "ellipsis", textAlign: "left" }} title={s.projectPath || s.project}>{displayPath}</span>
                      </div>
                      <span className="w-16 text-yellow-400 text-right shrink-0">{fmt$(s.cost)}</span>
                      <span className="w-16 text-neutral-500 text-right shrink-0">{s.calls.toLocaleString()}</span>
                    </div>
                  );
                })}
                {data.topSessions.length === 0 && (
                  <p className="text-neutral-600 text-xs font-mono">no data</p>
                )}
              </div>
            </div>
          </div>

          {/* By Activity */}
          <div data-testid="dash-card-by-activity" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-violet-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-violet-400 uppercase tracking-wider">By Activity</span>
              {data.activities.length > 15 && (
                <span className="flex items-center gap-1 text-[10px] font-mono bg-violet-900/40 text-violet-300 border border-violet-700/60 rounded px-1.5 py-0.5">
                  ↕ scroll · {data.activities.length}
                </span>
              )}
            </div>
            <div className="p-3">
              <div className="flex text-xs text-neutral-600 font-mono mb-1.5 pr-1">
                <span className="w-16 shrink-0" />
                <span className="flex-1">activity</span>
                <span className="w-16 text-right">cost</span>
                <span className="w-12 text-right">turns</span>
                <span className="w-14 text-right">1-shot</span>
              </div>
              <div className={data.activities.length > 15 ? "overflow-y-auto max-h-[300px] no-scrollbar" : ""}>
                <div className="space-y-1">
                  {(() => {
                    const maxCost = Math.max(...data.activities.map((a) => a.cost), 0.01);
                    return data.activities.map((a) => {
                      const pct = a.oneShotRate != null ? Math.round(a.oneShotRate * 100) : null;
                      return (
                        <div key={a.name} className="flex items-center gap-1.5 text-xs font-mono">
                          <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                            <div className="h-full bg-violet-500 rounded" style={{ width: `${(a.cost / maxCost) * 100}%` }} />
                          </div>
                          <span className="flex-1 text-neutral-300 truncate">{a.name}</span>
                          <span className="w-16 text-yellow-400 text-right">{fmt$(a.cost)}</span>
                          <span className="w-12 text-neutral-500 text-right">{a.turns}</span>
                          <span className={`w-14 text-right font-bold ${pct == null ? "text-neutral-600" : pct >= 70 ? "text-emerald-400" : pct >= 40 ? "text-yellow-400" : "text-neutral-500"}`}>
                            {pct != null ? `${pct}%` : "—"}
                          </span>
                        </div>
                      );
                    });
                  })()}
                  {data.activities.length === 0 && (
                    <p className="text-neutral-600 text-xs font-mono">no data</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 5: Core Tools + Shell Commands */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Core Tools */}
          <div data-testid="dash-card-core-tools" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-teal-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-teal-400 uppercase tracking-wider">Core Tools</span>
              {(data.tools ?? []).length > 15 && (
                <span className="flex items-center gap-1 text-[10px] font-mono bg-teal-900/40 text-teal-300 border border-teal-700/60 rounded px-1.5 py-0.5">
                  ↕ scroll · {(data.tools ?? []).length}
                </span>
              )}
            </div>
            <div className="p-3">
              <div className="flex text-xs text-neutral-600 font-mono mb-1.5">
                <span className="flex-1">tool</span>
                <span className="w-16 text-right">calls</span>
              </div>
              <div className={(data.tools ?? []).length > 15 ? "overflow-y-auto max-h-[300px] no-scrollbar" : ""}>
                <div className="space-y-1">
                  {(data.tools ?? []).map((t) => {
                    const maxCalls = Math.max(...(data.tools ?? []).map((x) => x.calls), 0.01);
                    return (
                      <div key={t.name} className="flex items-center gap-1.5 text-xs font-mono">
                        <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                          <div className="h-full bg-teal-500 rounded" style={{ width: `${(t.calls / maxCalls) * 100}%` }} />
                        </div>
                        <span className="flex-1 text-neutral-300 truncate">{t.name}</span>
                        <span className="w-16 text-blue-400 text-right">{t.calls.toLocaleString()}</span>
                      </div>
                    );
                  })}
                  {(data.tools ?? []).length === 0 && <p className="text-neutral-600 text-xs font-mono">no data</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Shell Commands */}
          <div data-testid="dash-card-shell-cmd" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-orange-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-wider">Shell Commands</span>
              {(data.shellCommands ?? []).length > 15 && (
                <span className="flex items-center gap-1 text-[10px] font-mono bg-orange-900/40 text-orange-300 border border-orange-700/60 rounded px-1.5 py-0.5">
                  ↕ scroll · {(data.shellCommands ?? []).length}
                </span>
              )}
            </div>
            <div className="p-3">
              <div className="flex text-xs text-neutral-600 font-mono mb-1.5">
                <span className="flex-1">command</span>
                <span className="w-16 text-right">calls</span>
              </div>
              <div className={(data.shellCommands ?? []).length > 15 ? "overflow-y-auto max-h-[300px] no-scrollbar" : ""}>
                <div className="space-y-1">
                  {(data.shellCommands ?? []).map((s) => {
                    const maxCalls = Math.max(...(data.shellCommands ?? []).map((x) => x.calls), 0.01);
                    return (
                      <div key={s.name} className="flex items-center gap-1.5 text-xs font-mono">
                        <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                          <div className="h-full bg-orange-500 rounded" style={{ width: `${(s.calls / maxCalls) * 100}%` }} />
                        </div>
                        <span className="flex-1 text-neutral-300 truncate">{s.name}</span>
                        <span className="w-16 text-blue-400 text-right">{s.calls.toLocaleString()}</span>
                      </div>
                    );
                  })}
                  {(data.shellCommands ?? []).length === 0 && <p className="text-neutral-600 text-xs font-mono">no data</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 새 Row: MCP Servers + 체류 히트맵 — 사용자 요청: core/shell 아래. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {mcpServersBlock}
          {dwellHeatmapBlock}
        </div>

        </>)}  {/* detailsOpen 토글 닫기 — Row 3 ~ Row 5 + 새 Row 모두 토글 안 */}

        {/* Daily Efficiency Score + Streak + 90일 잔디 + 팀 랭크 — 동기부여·게임화 패널.
            매일 보는 액션 카드가 아니라 주 1회 "이번 주 어땠지" 확인용. Core Tools /
            Shell Commands 아래로 배치해 핵심 의사결정 layer (activity → 효율 →
            비용 분해 → 이상치 → 작업 텍스처) 와 분리. */}
        {data.efficiencyScore && (
          <EfficiencyScoreSection score={data.efficiencyScore} period={period} periodScore={ov.periodScore} />
        )}

      </main>

      {showCacheModal && (
        <CacheHitModal value={ov.cacheHitPct} onClose={() => setShowCacheModal(false)} />
      )}
      {showOneShotModal && (
        <OneShotRateModal value={Math.round(ov.oneShotRate * 100)} onClose={() => setShowOneShotModal(false)} />
      )}
      {showCostModal && (
        <CostPerSessionModal
          value={ov.sessions > 0 ? ov.cost / ov.sessions : 0}
          sessionsCount={ov.sessions}
          totalCost={ov.cost}
          onClose={() => setShowCostModal(false)}
        />
      )}
      {showCallsModal && (
        <CallsPerSessionModal
          value={ov.sessions > 0 ? Math.round(ov.calls / ov.sessions) : 0}
          callsTotal={ov.calls}
          sessionsCount={ov.sessions}
          onClose={() => setShowCallsModal(false)}
        />
      )}
      {showCacheMethodsModal && (
        <CacheHitModal value={ov.cacheHitPct} onClose={() => setShowCacheMethodsModal(false)} methodsOnly />
      )}
      {showOneShotMethodsModal && (
        <OneShotRateModal value={Math.round(ov.oneShotRate * 100)} onClose={() => setShowOneShotMethodsModal(false)} methodsOnly />
      )}
      {showCostMethodsModal && (
        <CostPerSessionModal
          value={ov.sessions > 0 ? ov.cost / ov.sessions : 0}
          sessionsCount={ov.sessions}
          totalCost={ov.cost}
          onClose={() => setShowCostMethodsModal(false)}
          methodsOnly
        />
      )}
      {showCallsMethodsModal && (
        <CallsPerSessionModal
          value={ov.sessions > 0 ? Math.round(ov.calls / ov.sessions) : 0}
          callsTotal={ov.calls}
          sessionsCount={ov.sessions}
          onClose={() => setShowCallsMethodsModal(false)}
          methodsOnly
        />
      )}
      {showCostCallModal && (
        <CostPerCallModal value={ov.costPerCall ?? 0} totalCost={ov.cost} totalCalls={ov.calls} onClose={() => setShowCostCallModal(false)} />
      )}
      {showCostCallMethodsModal && (
        <CostPerCallModal value={ov.costPerCall ?? 0} totalCost={ov.cost} totalCalls={ov.calls} onClose={() => setShowCostCallMethodsModal(false)} methodsOnly />
      )}
      {showTokenModal && (
        <TokenVolumeModal
          level={computeTokenLevel(ov.avgDailyTokens)}
          avgDailyTokens={ov.avgDailyTokens}
          onClose={() => setShowTokenModal(false)}
        />
      )}
    </div>
  );
}
