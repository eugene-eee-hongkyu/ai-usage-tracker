"use client";

import React, { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { AdminNav } from "@/components/admin-nav";
import { CacheHitModal, OneShotRateModal, CostPerSessionModal, CallsPerSessionModal, CostPerCallModal, TokenVolumeModal } from "@/components/metric-modal";
import { computeTokenLevel } from "@/lib/rules";
import { ActivityCalendar } from "react-activity-calendar";
import { ScoreGauge, scoreLabel } from "@/components/score-gauge";
import dynamic from "next/dynamic";
import type { DrilldownPeriod } from "@/components/score-drilldown";
import { UsageHero } from "@/components/usage-hero";
import { PrivacyBanner } from "@/components/privacy-banner";

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
          <span className="text-xs font-mono text-neutral-600 animate-pulse">차트 로딩 중...</span>
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

interface DashboardData {
  user: { name: string; lastSyncedAt: string | null; timezone: string | null; planTier: string | null };
  planHealth?: import("@/components/plan-health-card").PlanHealthResult;
  powerIndex?: PowerIndexSummary;
  overview: Overview | null;
  daily: DailyRow[];
  dailyTokens?: DailyTokenRow[];
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
  blocks?: BlocksSummary | null;
  efficiencyScore?: EfficiencyScoreSummary | null;
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

interface BlocksSummary {
  count: number;
  activeDays: number;
  avgMinutes: number;
  medianMinutes: number;
  maxMinutes: number;
  longestStartedAt: string | null;
  tokensPerMinute: number;
  totalMinutes: number;
  totalTokens: number;
  distribution: { lt30: number; m30to60: number; h1to2: number; h2to4: number; h4plus: number };
  tooFewData: boolean;
  pattern: "몰입형" | "분산형" | "균형형" | "단발형";
  trend: {
    countDeltaPct: number | null;
    avgMinutesDeltaPct: number | null;
    tokensPerMinuteDeltaPct: number | null;
    hasPrevData: boolean;
  } | null;
}

const PATTERN_DESCRIPTIONS: Record<BlocksSummary["pattern"], { color: string; tooltip: string }> = {
  "몰입형": {
    color: "bg-violet-500/15 text-violet-300 border-violet-500/40",
    tooltip: "median 4h+ 또는 4h+ 블록 비율 50% 이상. 한 번 시작하면 5h 빌링 블록을 거의 꽉 채우는 깊은 집중 패턴.",
  },
  "분산형": {
    color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
    tooltip: "median 1h 미만 또는 1h 미만 블록 비율 50% 이상. 짧게 자주 사용하는 패턴. 작업 단위가 작거나 분산적.",
  },
  "균형형": {
    color: "bg-sky-500/15 text-sky-300 border-sky-500/40",
    tooltip: "median 1~4h, 짧은 블록과 긴 블록이 섞인 패턴. 작업 종류에 따라 깊이 조절.",
  },
  "단발형": {
    color: "bg-neutral-500/15 text-neutral-400 border-neutral-500/40",
    tooltip: "활성 블록 10개 미만. 가끔만 사용하는 패턴. 표본이 적어 다른 지표 신뢰도 낮음.",
  },
};

function TrendArrow({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-neutral-700">─</span>;
  if (pct === 0) return <span className="text-neutral-600">─ 0%</span>;
  if (pct > 0) return <span className="text-emerald-400">↑ +{pct}%</span>;
  return <span className="text-rose-400">↓ {pct}%</span>;
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

// period 별 게이지 라벨 — 다른 카드 (DAILY ACTIVITY / COST / BY MODEL ...) 가 모두
// period-aware 로 움직이는데 이 게이지만 오늘 고정이면 인지 부조화. period 반영.
function gaugeLabel(period: Period): string {
  switch (period) {
    case "today":  return "오늘 효율";
    case "8days":  return "8일 평균 효율";
    case "month":  return "이번달 평균 효율";
    case "30days": return "30일 평균 효율";
    case "all":    return "전체 평균 효율";
  }
}

function EfficiencyScoreSection({ score, period, periodScore }: EfficiencyScoreSectionProps) {
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
    const yLabel = <span className="text-neutral-400">어제 {y}</span>;
    if (d === null) return yLabel;
    const deltaLabel = d > 0
      ? <span className="text-emerald-400">▲ +{d}</span>
      : d < 0
        ? <span className="text-rose-400">▼ {d}</span>
        : <span className="text-neutral-500">─ 0</span>;
    return <>{yLabel} <span className="text-neutral-600">(</span>{deltaLabel}<span className="text-neutral-600">)</span></>;
  })();

  // 라벨 — period=today 면 진행 중 시각, 그 외는 period 이름만.
  const labelMain = gaugeLabel(period);
  const labelSuffix = (() => {
    if (period !== "today") return "";
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return ` (진행 중 · ${hh}:${mm})`;
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
        <span className={`font-bold ${scoreColor(displayScore)}`}>{scoreLabel(displayScore)}</span>
        {referenceNode && <span className="text-neutral-500">·</span>}
        {referenceNode}
      </div>
      <span className="text-[10px] font-mono text-neutral-600 mt-0.5">cache 42 + one-shot 18 + cost 10 + 사용량 30</span>
      {drilldownAvailable && (
        <span
          data-testid="score-drilldown-hint"
          className="mt-1 text-[10px] font-mono text-sky-400/70 group-hover:text-sky-300 transition-colors"
        >
          {open ? "▲ 추이 닫기" : `▼ ${period === "8days" ? "8일" : period === "month" ? "이번달" : period === "30days" ? "30일" : "전체"} 추이 보기`}
        </span>
      )}
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
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-1">
                {labelMain}{labelSuffix}
              </span>
              {gaugeBlock}
            </button>
          ) : (
            <div data-testid="score-today" className="col-span-12 sm:col-span-3 flex flex-col items-center">
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-1">
                {labelMain}{labelSuffix}
              </span>
              {gaugeBlock}
            </div>
          )}

          {/* 보조: streak + team rank 세로 stack (3 cols) */}
          <div className="col-span-12 sm:col-span-3 flex flex-col gap-3 py-1">
            {/* Streak */}
            <div data-testid="score-streak">
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider block mb-1">
                현재 cache hit ≥ 90% Streak
              </span>
              <div className="flex items-center gap-3">
                <span className="text-3xl leading-none">🔥</span>
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-mono font-bold leading-none ${score.streak >= 7 ? "text-orange-400" : score.streak >= 1 ? "text-neutral-200" : "text-neutral-600"}`}>
                      {score.streak}
                    </span>
                    <span className="text-xs font-mono text-neutral-500">일</span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500 mt-0.5">활동 없는 날 자동 보류</span>
                </div>
              </div>
            </div>

            {/* 팀 랭크 */}
            {score.teamRank ? (
              <div data-testid="score-team-rank">
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider block mb-1">
                  이번주 팀 cache hit 랭크
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-3xl leading-none">{rankMedal(score.teamRank.position) || "🏅"}</span>
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-mono font-bold leading-none text-sky-300">
                        {score.teamRank.position}
                      </span>
                      <span className="text-xs font-mono text-neutral-500">/ {score.teamRank.total}명</span>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-500 mt-0.5">
                      나 {score.teamRank.selfCacheHitPct.toFixed(1)}% · 팀 {score.teamRank.teamAvgCacheHitPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 opacity-60">
                <span className="text-3xl leading-none">🏅</span>
                <span className="text-[11px] font-mono text-neutral-600">팀 랭크 데이터 없음</span>
              </div>
            )}
          </div>

          {/* 잔디 (6 cols) — F-pattern 우측, 데이터로 dead space 채움 */}
          <div data-testid="score-grass" className="col-span-12 sm:col-span-6 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">최근 90일 효율</span>
              <div className="flex items-center gap-2.5 text-[10px] font-mono text-neutral-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: theme.dark[1] }} />경고</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: theme.dark[2] }} />개선</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: theme.dark[3] }} />양호</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: theme.dark[4] }} />탁월</span>
              </div>
            </div>
            <ActivityCalendar
              data={calData}
              colorScheme="dark"
              theme={theme}
              labels={{ legend: { less: "낮음", more: "탁월" } }}
              showWeekdayLabels
              blockSize={10}
              blockMargin={2}
              showTotalCount={false}
              renderColorLegend={() => <></>}
              renderBlock={(block, activity) => {
                // 셀 hover 시 native SVG <title> tooltip 으로 그 날 점수 + 등급.
                // 색만 보면 "왜 이 색?" 모호한 거 해결. 별도 라이브러리 의존 0.
                const inactive = activity.level === 0;
                const label = inactive
                  ? `${activity.date} · 활동 없음`
                  : `${activity.date} · ${activity.count}점 · ${scoreLabel(activity.count)}`;
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

const PERIOD_LABELS: Record<Period, string> = {
  today: "오늘", "8days": "8일", month: "이번달", "30days": "30일", all: "전체",
};

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

type GradeLevel = "탁월" | "양호" | "보통" | "부족" | "경고";
const GRADE_STYLES: Record<GradeLevel, string> = {
  "탁월": "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  "양호": "bg-green-500/15 text-green-400 border-green-500/40",
  "보통": "bg-yellow-500/15 text-yellow-400 border-yellow-500/40",
  "부족": "bg-orange-500/15 text-orange-400 border-orange-500/40",
  "경고": "bg-red-500/15 text-red-400 border-red-500/40",
};

const GRADE_TOOLTIP_CLS: Record<GradeLevel, string> = {
  "탁월": "bg-emerald-950/60 text-emerald-300",
  "양호": "bg-green-950/60 text-green-300",
  "보통": "bg-yellow-950/60 text-yellow-300",
  "부족": "bg-orange-950/60 text-orange-300",
  "경고": "bg-red-950/60 text-red-300",
};

const CACHE_ROWS: [GradeLevel, string, string][] = [
  ["탁월", "96%+",    "Claude Code 본사 내부 기준"],
  ["양호", "90~95%",  "좋은 상태"],
  ["보통", "80~89%",  "일반적인 수준"],
  ["부족", "60~79%",  "CLAUDE.md 비대 의심"],
  ["경고", "<60%",    "본사 기준 사고(SEV) 수준"],
];
// one-shot rate: codeburn 공식 anchor (90% "right first try" / 30% "retry loop")
// 기준 3단계. 80% 위 = 진짜 우수, 40~80% = messy 코딩 정상 범위 (행동 변경 권유 안 함),
// 40% 미만 = Edit→Build→Edit 루프 신호 (codeburn 30% 명시 문제선 + 약간 margin).
const ONESHOT_ROWS: [GradeLevel, string, string][] = [
  ["탁월", "80%+",    "코드 retry 거의 없음. 명확한 컨텍스트"],
  ["보통", "40~79%",  "messy 코딩의 정상 범위"],
  ["경고", "<40%",    "Edit→Build→Edit 루프 자주 발생"],
];
// cost/session: 외부 anchor 약함 (Anthropic baseline $6-8/세션 + $13/active day).
// 5단계는 거짓 정밀. 3단계로 단순화 — one-shot 과 동일한 정책 (anchor 약하면 coarse).
const COST_ROWS: [GradeLevel, string, string][] = [
  ["탁월", "<$25",     "일상적 세션 크기"],
  ["보통", "$25~100",  "큰 작업 세션. 정상 범위"],
  ["경고", "$100+",    "거대 세션. 분리 또는 효율 점검"],
];
// 사용량 (total tokens/day): 외부 anchor 3개 (Anthropic median/P90/enterprise P90) 로
// 10단계 calibrated. Verdent + power user 데이터로 보간 검증.
// 점수 환산: level × 3 (max 30, daily score 의 30% 비중).
const TOKEN_ROWS: [GradeLevel, string, string][] = [
  ["탁월", "8/10+ (≥150M/day)",  "Heavy 사용자. Power user 영역"],
  ["양호", "6~7/10 (40~150M)",   "Anthropic enterprise P90 (~$30/day) 이상"],
  ["보통", "3~5/10 (8~40M)",     "Anthropic 평균~P90 사이. 정상 활성"],
  ["부족", "1~2/10 (≤8M)",       "라이트 사용 또는 거의 안 씀"],
  ["경고", "0/10 (0 tokens)",    "오늘 안 씀"],
];

function MiniGradeTable({ title, rows, current }: { title: string; rows: [GradeLevel, string, string][]; current: GradeLevel }) {
  return (
    <div>
      <p className="text-[10px] font-mono text-slate-400 font-semibold mb-1">{title}</p>
      {rows.map(([g, range, desc]) => (
        <div
          key={g}
          className={`flex items-center gap-1.5 px-1 py-0.5 rounded text-[10px] font-mono ${g === current ? GRADE_TOOLTIP_CLS[g] + " font-bold" : "text-slate-600"}`}
        >
          <span className="w-7 shrink-0">{g}</span>
          <span className="w-20 shrink-0 text-[9px]">{range}</span>
          <span className="text-[9px] opacity-70 truncate">{desc}</span>
          {g === current && <span className="ml-auto text-[8px] shrink-0 opacity-50">←</span>}
        </div>
      ))}
    </div>
  );
}

function cacheHitGrade(v: number): GradeLevel {
  if (v >= 96) return "탁월";
  if (v >= 90) return "양호";
  if (v >= 80) return "보통";
  if (v >= 60) return "부족";
  return "경고";
}
function oneShotGrade(v: number): GradeLevel {
  if (v >= 80) return "탁월";
  if (v >= 40) return "보통";
  return "경고";
}
function costGrade(v: number): GradeLevel {
  if (v < 25) return "탁월";
  if (v < 100) return "보통";
  return "경고";
}
// calls/session, cost/call, output/input — 외부 anchor 없음. 등급 미표시.
// 값만 노출. 추세 (후속 PR) 로 변화 인지.

// Token level (0-10) → 5-level grade 매핑 (배지 색깔용).
// 8-10: 탁월 / 6-7: 양호 / 3-5: 보통 / 1-2: 부족 / 0: 경고
function tokenLevelToGrade(level: number): GradeLevel {
  if (level >= 8) return "탁월";
  if (level >= 6) return "양호";
  if (level >= 3) return "보통";
  if (level >= 1) return "부족";
  return "경고";
}
function fmtTokensShort(n: number): string {
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
  if (score === null) return "경고";
  if (score >= 90) return "탁월";
  if (score >= 75) return "양호";
  if (score >= 55) return "보통";
  if (score >= 35) return "부족";
  return "경고";
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
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtMinutes(n: number): string {
  if (n < 60) return `${n}m`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtBlockDate(iso: string): string {
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return "";
  const wd = ["일", "월", "화", "수", "목", "금", "토"][dt.getDay()];
  return `${dt.getMonth() + 1}/${dt.getDate()} (${wd})`;
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

const DAY_OFFSET_LABELS: Record<number, string> = {
  1: "어제", 2: "그제", 3: "3일전", 4: "4일전", 5: "5일전", 6: "6일전", 7: "7일전",
};

const WEEK_OFFSET_LABEL = (i: number) => i === 1 ? "지난주" : `${i}주전`;
const MONTH_OFFSET_LABEL = (i: number) => i === 1 ? "지난달" : `${i}달전`;

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

interface TeamMember { userId: string; name: string }

export function DashboardView({ targetUserId, onMemberSelect, storageKey = "dashboard_period", adminMode = false }: { targetUserId?: string; onMemberSelect?: (userId: string) => void; storageKey?: string; adminMode?: boolean }) {
  const viewOnly = !!targetUserId;
  const NavComponent = adminMode ? AdminNav : Nav;
  const { data: session, status } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("8days");

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    // legacy "week" → "8days" (calendar week feature was removed)
    const upgraded = saved === "week" ? "8days" : saved;
    if (upgraded && ["today", "8days", "month", "30days", "all"].includes(upgraded)) {
      setPeriod(upgraded as Period);
    }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, period);
  }, [period, storageKey]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [syncCopied, setSyncCopied] = useState(false);
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

  const apiUrl = (p: Period, wOff: number, mOff: number, dOff: number) => {
    const params = new URLSearchParams({ period: p });
    if (targetUserId) params.set("userId", targetUserId);
    if (p === "8days" && wOff > 0) params.set("weekOffset", String(wOff));
    if (p === "month" && mOff > 0) params.set("monthOffset", String(mOff));
    if (p === "today" && dOff > 0) params.set("dayOffset", String(dOff));
    return `/api/dashboard?${params.toString()}`;
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

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

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetch(apiUrl(period, weekOffset, monthOffset, dayOffset))
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) { setFetchError(true); setLoading(false); return; }
        setFetchError(false);
        setData(d);
        setLoading(false);
      })
      .catch(() => { setFetchError(true); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, period, weekOffset, monthOffset, dayOffset, targetUserId]);

  useEffect(() => {
    if (data?.user?.timezone) setUserTz(data.user.timezone);
  }, [data?.user?.timezone]);

  const saveTz = async (tz: string) => {
    setUserTz(tz);
    setShowTzPicker(false);
    await fetch("/api/user/timezone", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: tz }),
    });
  };

  useEffect(() => {
    if (!session || !data || data.overview) return;
    const timer = setInterval(() => {
      fetch(apiUrl(period, weekOffset, monthOffset, dayOffset))
        .then((r) => r.json())
        .then((d) => { if (d.overview) setData(d); });
    }, 4000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, data, period, weekOffset, monthOffset, dayOffset]);

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
        <p className="text-neutral-400 font-mono text-sm">데이터를 불러오지 못했습니다.</p>
        <button
          data-testid="dash-retry"
          onClick={() => {
            setFetchError(false); setLoading(true);
            fetch(apiUrl(period, weekOffset, monthOffset, dayOffset)).then((r) => r.json()).then((d) => {
              if (!d?.error) { setData(d); setLoading(false); }
            });
          }}
          className="px-4 py-1.5 bg-neutral-800 rounded text-sm text-neutral-200 hover:bg-neutral-700 font-mono"
        >재시도</button>
      </div>
    </div>
  );

  if (!data) return null;

  if (!data.user.lastSyncedAt && !viewOnly) {
    router.push("/setup");
    return null;
  }

  if (!data.overview) {
    if (viewOnly) return (
      <div className="min-h-screen bg-neutral-950">
        <NavComponent />
        <div className="flex items-center justify-center h-64">
          <p className="text-neutral-500 font-mono text-sm">아직 데이터가 없습니다.</p>
        </div>
      </div>
    );
    const syncCmd = `npx github:${process.env.NEXT_PUBLIC_GITHUB_ORG ?? "eugene-eee-hongkyu"}/ai-usage-tracker sync`;
    return (
      <div className="min-h-screen bg-neutral-950">
        <header className="border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
          <span className="font-mono font-bold text-neutral-200">Primus Usage</span>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-sm text-neutral-500 hover:text-neutral-300 font-mono">logout</button>
        </header>
        <main data-testid="dash-sync-needed" className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
          <h1 className="text-2xl font-bold text-neutral-100 font-mono">sync needed</h1>
          <p className="text-neutral-400 text-sm font-mono">터미널에서 아래 명령어를 실행하세요.</p>
          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded px-4 py-3 text-left">
            <code data-testid="dash-sync-cmd" className="flex-1 text-sm text-cyan-400 font-mono break-all">{syncCmd}</code>
            <button
              data-testid="dash-sync-copy"
              onClick={() => { navigator.clipboard.writeText(syncCmd); setSyncCopied(true); setTimeout(() => setSyncCopied(false), 2000); }}
              className="shrink-0 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded font-mono"
            >{syncCopied ? "✓" : "복사"}</button>
          </div>
        </main>
      </div>
    );
  }

  const ov = data.overview;
  const chartData = data.daily.map((d) => ({ date: d.date.slice(5), cost: d.cost, sessions: d.sessions }));
  const tokenMap: Record<string, number> = {};
  for (const t of data.dailyTokens ?? []) tokenMap[t.date.slice(5)] = t.totalTokens;
  const chartTokenData = chartData.map((d) => ({ date: d.date, tokens: tokenMap[d.date] ?? 0 }));
  const maxProjectCost = Math.max(...data.projects.map((p) => p.cost), 0.01);
  const maxSessionCost = Math.max(...data.topSessions.map((s) => s.cost), 0.01);

  return (
    <div className={`min-h-screen bg-neutral-950 text-neutral-100 transition-opacity duration-150 ${loading ? "opacity-50 pointer-events-none" : ""}`}>
      <NavComponent />

      {/* Period Tabs */}
      <div className="border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 pt-3 pb-2 flex gap-1 items-center">
          {(["today", "8days", "month", "30days", "all"] as Period[]).map((p) => (
            <button
              key={p}
              data-testid={`dash-period-${p}`}
              onClick={() => {
                setPeriod(p);
                // 어떤 period 버튼을 누르든 모든 offset 초기화 → 항상 라이브로 복귀
                setWeekOffset(0);
                setMonthOffset(0);
                setDayOffset(0);
              }}
              className={`w-16 text-center py-1 rounded text-xs font-mono transition-colors ${period === p && !(p === "8days" && weekOffset > 0) && !(p === "month" && monthOffset > 0) && !(p === "today" && dayOffset > 0) ? "bg-indigo-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"}`}
            >{PERIOD_LABELS[p]}</button>
          ))}
          {period === "today" && (data.availableSnapshots?.daily?.length ?? 0) > 0 && (
            <select
              data-testid="dash-day-offset"
              value={dayOffset}
              onChange={(e) => setDayOffset(Number(e.target.value))}
              className={`text-xs font-mono border rounded px-2 py-1 cursor-pointer focus:outline-none ${dayOffset > 0 ? "bg-indigo-600 text-white border-indigo-500" : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200"}`}
            >
              <option value={0}>이전 ▼</option>
              {data.availableSnapshots!.daily!.slice(0, 7).map((s, i) => (
                <option key={s.periodStart} value={i + 1}>
                  {`${DAY_OFFSET_LABELS[i + 1] ?? `${i + 1}일전`} (${formatDayLabel(s.periodStart)})`}
                </option>
              ))}
            </select>
          )}
          {period === "8days" && (data.availableSnapshots?.weekly?.length ?? 0) > 0 && (
            <select
              data-testid="dash-week-offset"
              value={weekOffset}
              onChange={(e) => setWeekOffset(Number(e.target.value))}
              className={`text-xs font-mono border rounded px-2 py-1 cursor-pointer focus:outline-none ${weekOffset > 0 ? "bg-indigo-600 text-white border-indigo-500" : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200"}`}
            >
              <option value={0}>이전 ▼</option>
              {data.availableSnapshots!.weekly.slice(0, 5).map((s, i) => (
                <option key={s.periodStart} value={i + 1}>
                  {`${WEEK_OFFSET_LABEL(i + 1)} (${formatWeekRange(s.periodStart)})`}
                </option>
              ))}
            </select>
          )}
          {period === "month" && (data.availableSnapshots?.monthly?.length ?? 0) > 0 && (
            <select
              data-testid="dash-month-offset"
              value={monthOffset}
              onChange={(e) => setMonthOffset(Number(e.target.value))}
              className={`text-xs font-mono border rounded px-2 py-1 cursor-pointer focus:outline-none ${monthOffset > 0 ? "bg-indigo-600 text-white border-indigo-500" : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200"}`}
            >
              <option value={0}>이전 ▼</option>
              {data.availableSnapshots!.monthly.slice(0, 6).map((s, i) => (
                <option key={s.periodStart} value={i + 1}>
                  {`${MONTH_OFFSET_LABEL(i + 1)} (${formatMonthLabel(s.periodStart)})`}
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
      </div>

      {/* Privacy banner — dismiss 가능. 진우님 "프롬프트 저장 여부 궁금" 응답 반영.
          본인 view 만. viewOnly 면 어드민 컨텍스트라 별도 banner 불필요. */}
      {!viewOnly && <PrivacyBanner />}

      {/* Usage Hero — Power Index (활용 지수) + Plan 활용률 동등 크기 2-card.
          인터뷰 4/4 일치: "사용량/cost 만 본다, 효율 점수는 약하다".
          최상단 hero — F-pattern top-left + Dashboard UX best practice. */}
      {!viewOnly && data.powerIndex && (
        <UsageHero
          powerIndex={data.powerIndex.score}
          activeDays={data.powerIndex.activeDays}
          avgDailyTokens={data.powerIndex.avgDailyTokens}
          periodDays={data.planHealth?.periodDays ?? 30}
          periodLabel={PERIOD_LABELS[period]}
          declaredTier={data.user.planTier ?? null}
          declaredTierLabel={data.planHealth?.declaredLimits?.label ?? null}
          priceForPeriod={data.planHealth?.priceForPeriod ?? null}
          totalWindowTokens={data.planHealth?.totalWindowTokens ?? 0}
          realUsagePct={data.planHealth?.realUsagePct ?? null}
          nonCacheTotalWindowTokens={data.planHealth?.nonCacheTotalWindowTokens ?? null}
          cacheHitPctForPeriod={data.planHealth?.cacheHitPctForPeriod ?? null}
        />
      )}

      {/* Overview Bar — 사용자 인터뷰에서 "activity + cost 만 본다" 답이 다수.
          폰트 키우고 hero 수준으로 시각 승격. */}
      <div data-testid="dash-overview-bar" className="bg-neutral-900 border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono">
          {viewOnly && (
            <span className="text-indigo-400 font-semibold self-center mr-2">{data.user.name}</span>
          )}
          {/* hero — activity (tokens) + cost. 사용자 인터뷰 답변에서 가장 자주 보는 두 지표. */}
          <span className="flex items-baseline gap-1">
            <span className="text-cyan-400 font-bold text-2xl tabular-nums">{fmtTokens(chartTokenData.reduce((s, d) => s + d.tokens, 0))}</span>
            <span className="text-neutral-500 text-xs">tokens</span>
          </span>
          <span className="flex items-baseline gap-1">
            <span className="text-yellow-400 font-bold text-2xl tabular-nums">${ov.cost.toFixed(2)}</span>
            <span className="text-neutral-500 text-xs">cost</span>
          </span>
          {/* secondary — calls / sessions / cache / 1-shot 은 기존 사이즈 유지 */}
          <span className="text-sm"><span className="text-blue-400 font-bold">{ov.calls.toLocaleString()}</span><span className="text-neutral-500 ml-1 text-xs">calls</span></span>
          <span className="text-sm"><span className="text-cyan-400 font-bold">{ov.sessions}</span><span className="text-neutral-500 ml-1 text-xs">sessions</span></span>
          <span className="text-sm"><span className="text-emerald-400 font-bold">{ov.cacheHitPct.toFixed(1)}%</span><span className="text-neutral-500 ml-1 text-xs">cache hit</span></span>
          <span className="text-sm"><span className="text-violet-400 font-bold">{Math.round(ov.oneShotRate * 100)}%</span><span className="text-neutral-500 ml-1 text-xs">1-shot</span></span>
          <span className="text-neutral-600 text-xs self-center ml-auto flex items-center gap-3">
            <span>활성 {ov.activeDays}일</span>
            {data.snapshot ? (
              <span className="text-amber-400">
                📌 captured {fmtSyncedAt(data.snapshot.capturedAt, userTz)} {tzAbbr(userTz)}
                {data.snapshot.dataRangeStart && data.snapshot.dataRangeEnd && (
                  <span className="text-neutral-500"> · {formatDateRange(data.snapshot.dataRangeStart, data.snapshot.dataRangeEnd)}</span>
                )}
              </span>
            ) : !viewOnly ? (
              <span className="relative">
                마지막 수신{" "}
                <span className="text-neutral-500">{fmtSyncedAt(data.user.lastSyncedAt, userTz)}</span>{" "}
                <button
                  data-testid="dash-tz-btn"
                  onClick={() => setShowTzPicker((v) => !v)}
                  className="text-neutral-600 hover:text-neutral-300 text-[10px] font-mono border border-neutral-700 hover:border-neutral-500 rounded px-1 py-0.5 transition-colors"
                  title="타임존 변경"
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
                마지막 수신 {fmtSyncedAt(data.user.lastSyncedAt, userTz)}
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
              {chartTokenData.length === 0 || chartTokenData.every((d) => d.tokens === 0) ? (
                <div className="h-32 flex items-center justify-center text-neutral-600 text-xs font-mono">no data</div>
              ) : (
                <div className={chartTokenData.length > 45 ? "overflow-y-auto max-h-[300px] no-scrollbar" : ""}>
                  <div className="space-y-1">
                    {(() => {
                      const maxTokens = Math.max(...chartTokenData.map((d) => d.tokens), 1);
                      return chartTokenData.map((d) => (
                        <div key={d.date} className="flex items-center gap-1.5 text-xs font-mono">
                          <span className="w-10 text-neutral-500 shrink-0">{d.date}</span>
                          <div className="flex-1 h-1.5 bg-neutral-800 rounded overflow-hidden">
                            <div className="h-full bg-cyan-500 rounded" style={{ width: `${(d.tokens / maxTokens) * 100}%` }} />
                          </div>
                          <span className="text-cyan-300 w-16 text-right shrink-0">{fmtTokens(d.tokens)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Daily Cost */}
          <div data-testid="dash-card-daily-cost" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-yellow-500 rounded">
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
                        <div key={d.date} className="flex items-center gap-1.5 text-xs font-mono">
                          <span className="w-10 text-neutral-500 shrink-0">{d.date}</span>
                          <div className="flex-1 h-1.5 bg-neutral-800 rounded overflow-hidden">
                            <div className="h-full bg-yellow-500 rounded" style={{ width: `${(d.cost / maxCost) * 100}%` }} />
                          </div>
                          <span className="text-yellow-400 w-16 text-right shrink-0">{fmt$(d.cost)}</span>
                          {d.sessions > 0 && <span className="text-neutral-600 w-8 text-right shrink-0">{d.sessions}s</span>}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Efficiency + Activity Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Efficiency Metrics */}
          <div data-testid="dash-card-efficiency" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-fuchsia-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-fuchsia-400 uppercase tracking-wider">Efficiency</span>
              {(() => {
                const costPs = ov.sessions > 0 ? ov.cost / ov.sessions : 0;
                const grade = badgeGradeFromScore(ov.periodScore);
                return (
                  <div className="relative group/grade">
                    <span data-testid="dash-grade-overall" className={`text-xs font-mono font-bold px-2 py-0.5 rounded border cursor-default ${GRADE_STYLES[grade]}`}>
                      {grade}
                    </span>
                    {grade !== "양호" && (
                      <div className="absolute right-0 top-full mt-1 z-50 opacity-0 invisible group-hover/grade:opacity-100 group-hover/grade:visible transition-all duration-100 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-3 w-[580px]">
                        <p className="text-[10px] font-mono text-slate-500 mb-2.5 uppercase tracking-wider">등급 기준</p>
                        <div className="grid grid-cols-2 gap-3">
                          <MiniGradeTable title="Cache hit" rows={CACHE_ROWS} current={cacheHitGrade(ov.cacheHitPct)} />
                          <MiniGradeTable title="One-shot rate" rows={ONESHOT_ROWS} current={oneShotGrade(Math.round(ov.oneShotRate * 100))} />
                          <MiniGradeTable title="Cost / session" rows={COST_ROWS} current={costGrade(costPs)} />
                          <MiniGradeTable title={`사용량 (${computeTokenLevel(ov.avgDailyTokens)}/10)`} rows={TOKEN_ROWS} current={tokenLevelToGrade(computeTokenLevel(ov.avgDailyTokens))} />
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
                const BAD: GradeLevel[] = ["보통", "부족", "경고"];
                const isBad = (g: GradeLevel) => BAD.includes(g);
                const tokenLvl = computeTokenLevel(ov.avgDailyTokens);
                // 등급 메트릭 (4) — 외부 anchor 기반 행동 가이드.
                const gradedRows = [
                  {
                    tid: "cache",
                    label: "Cache hit",
                    value: `${ov.cacheHitPct.toFixed(1)}%`,
                    color: "text-emerald-400",
                    grade: cacheHitGrade(ov.cacheHitPct),
                    gradeRows: CACHE_ROWS,
                    gradeTitle: "Cache hit",
                    onDesc: () => setShowCacheModal(true),
                    onAct: () => setShowCacheMethodsModal(true),
                    actLabel: "늘리는법",
                  },
                  {
                    tid: "oneshot",
                    label: "One-shot rate",
                    value: `${Math.round(ov.oneShotRate * 100)}%`,
                    color: "text-violet-400",
                    grade: oneShotGrade(Math.round(ov.oneShotRate * 100)),
                    gradeRows: ONESHOT_ROWS,
                    gradeTitle: "One-shot rate",
                    onDesc: () => setShowOneShotModal(true),
                    onAct: () => setShowOneShotMethodsModal(true),
                    actLabel: "늘리는법",
                  },
                  {
                    tid: "cost-session",
                    label: "Cost / session",
                    value: ov.sessions > 0 ? fmt$(costPerSession) : "$0.00",
                    color: "text-yellow-400",
                    grade: costGrade(costPerSession),
                    gradeRows: COST_ROWS,
                    gradeTitle: "Cost / session",
                    onDesc: () => setShowCostModal(true),
                    onAct: () => setShowCostMethodsModal(true),
                    actLabel: "줄이는법",
                  },
                  {
                    tid: "tokens",
                    label: "사용량",
                    // 팀 EFFICIENCY 와 동일 포맷 — level primary, abs value secondary.
                    value: ov.avgDailyTokens > 0 ? `${tokenLvl}/10 · ${fmtTokensShort(ov.avgDailyTokens)}` : "0",
                    color: "text-cyan-400",
                    grade: tokenLevelToGrade(tokenLvl),
                    gradeRows: TOKEN_ROWS,
                    gradeTitle: `사용량 (${tokenLvl}/10)`,
                    onDesc: () => setShowTokenModal(true),
                    onAct: () => setShowTokenModal(true),
                    actLabel: "더 쓰는법",
                  },
                ];
                // 참고 수치 (2) — 외부 anchor 없음, diagnostic 용.
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
                    actLabel: "최적화",
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
                    actLabel: "줄이는법",
                  },
                ];
                type MetricRow = (typeof gradedRows)[number] | (typeof referenceRows)[number];
                const renderRow = ({ tid, label, value, color, grade, gradeRows, gradeTitle, onDesc, onAct, actLabel }: MetricRow) => (
                  <div key={label} data-testid={`dash-metric-${tid}`} className="flex items-center text-xs py-0.5 gap-2">
                    <span className="text-neutral-400 w-28 shrink-0">{label}</span>
                    <span className="flex gap-1 shrink-0 w-24">
                      <TipBtn testid={`dash-tip-${tid}-desc`} label="설명" onClick={onDesc} variant="explain" />
                      {grade && isBad(grade) && <TipBtn testid={`dash-tip-${tid}-act`} label={actLabel} onClick={onAct} />}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <span className={`font-bold ${color}`}>{value}</span>
                      {grade && gradeRows ? (
                        <div className="relative group/mbadge">
                          <span data-testid={`dash-metric-${tid}-grade`} className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border w-14 text-center block cursor-default ${GRADE_STYLES[grade]}`}>{grade}</span>
                          <div className="absolute right-0 top-full mt-1 z-50 opacity-0 invisible group-hover/mbadge:opacity-100 group-hover/mbadge:visible transition-all duration-100 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-3 w-72">
                            <MiniGradeTable title={gradeTitle} rows={gradeRows} current={grade} />
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
                      <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-wider">참고 수치</span>
                    </div>
                    {referenceRows.map(renderRow)}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Activity Heatmap (last 13 weeks, cost-based) */}
          {(data.heatmapDaily ?? []).length > 0 ? (() => {
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
              <div data-testid="dash-card-activity-heatmap" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-indigo-500 rounded">
                <div className="px-3 py-2 border-b border-neutral-800">
                  <span data-testid="dash-heatmap-activity" className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider">활동 히트맵 ({Math.round((data.heatmapDaily ?? []).length / 7)}주, 비용 기준)</span>
                </div>
                <div className="p-3">
                  <ActivityCalendar
                    data={calData}
                    colorScheme="dark"
                    theme={{ dark: ["#1e293b", "#4338ca", "#6366f1", "#818cf8", "#a5b4fc"] }}
                    labels={{ legend: { less: "$0", more: "$100+" } }}
                    showWeekdayLabels
                    blockSize={11}
                    showTotalCount={false}
                    renderBlock={(block, activity) => {
                      // today 셀은 amber outline 으로 강조 — "오늘 어디?" 즉시 파악.
                      // hover 시 tooltip 으로 그 날 cost 표시 (잔디 패턴과 동일).
                      const todayKey = new Date().toISOString().slice(0, 10);
                      const isToday = activity.date === todayKey;
                      const cost = activity.count / 100; // calData 에서 *100 했던 거 복원
                      const label = activity.level === 0
                        ? `${activity.date} · 활동 없음${isToday ? " · 오늘" : ""}`
                        : `${activity.date} · $${cost.toFixed(2)}${isToday ? " · 오늘" : ""}`;
                      return isToday
                        ? React.cloneElement(block, { stroke: "#fbbf24", strokeWidth: 1.5 }, <title>{label}</title>)
                        : React.cloneElement(block, {}, <title>{label}</title>);
                    }}
                  />
                </div>
              </div>
            );
          })() : <div />}
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
                      <span className="w-20 text-neutral-500 shrink-0">{s.date}</span>
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

        {/* Daily Efficiency Score + Streak + 90일 잔디 + 팀 랭크 — 동기부여·게임화 패널.
            매일 보는 액션 카드가 아니라 주 1회 "이번 주 어땠지" 확인용. Core Tools /
            Shell Commands 아래로 배치해 핵심 의사결정 layer (activity → 효율 →
            비용 분해 → 이상치 → 작업 텍스처) 와 분리. */}
        {data.efficiencyScore && (
          <EfficiencyScoreSection score={data.efficiencyScore} period={period} periodScore={ov.periodScore} />
        )}

        {/* Row 6: Active Blocks + Dwell Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Active Blocks pattern. ccusage blocks --json 기반 wall-clock 집계.
              period === "today" 면 카드 자체 렌더링 안 함 (blocks=null).
              count < 5 면 tooFewData=true → 안내 문구만 표시. */}
          {period !== "today" && data.blocks ? (
            <div data-testid="dash-card-active-blocks" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-sky-500 rounded">
              <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider">Active Blocks</span>
                {!data.blocks.tooFewData && (
                  <div className="relative group/pattern">
                    <span
                      data-testid="dash-active-blocks-pattern"
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border cursor-help ${PATTERN_DESCRIPTIONS[data.blocks.pattern].color}`}
                    >
                      {data.blocks.pattern} <span className="opacity-60">ⓘ</span>
                    </span>
                    <div className="absolute right-0 top-full mt-1 z-50 opacity-0 invisible group-hover/pattern:opacity-100 group-hover/pattern:visible transition-all duration-100 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-3 w-72 text-left">
                      <p className="text-[10px] font-mono text-slate-500 mb-1.5 uppercase tracking-wider">{data.blocks.pattern} 기준</p>
                      <p className="text-xs font-mono text-slate-300 leading-relaxed">{PATTERN_DESCRIPTIONS[data.blocks.pattern].tooltip}</p>
                      <p className="text-[10px] font-mono text-slate-500 mt-2 pt-2 border-t border-slate-800">
                        패턴 분류는 자기 인식 용도. 좋고 나쁨이 아닙니다.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-3">
                {data.blocks.tooFewData ? (
                  <p data-testid="dash-active-blocks-empty" className="text-neutral-500 text-xs font-mono">데이터 부족 — 블록 5개 이상 누적되면 표시됩니다.</p>
                ) : (
                  <>
                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-neutral-400 shrink-0">활성 블록</span>
                        <span className="flex-1 text-right">
                          <span className="text-neutral-200">{data.blocks.count}</span>
                          <span className="text-neutral-500"> ({data.blocks.activeDays}일)</span>
                        </span>
                        <span className="w-20 text-right text-[10px]" title="직전 동일 길이 윈도우 대비">
                          {data.blocks.trend?.hasPrevData
                            ? <TrendArrow pct={data.blocks.trend.countDeltaPct} />
                            : <span className="text-neutral-700">─</span>}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-neutral-400 shrink-0">평균 길이</span>
                        <span className="flex-1 text-right">
                          <span className="text-neutral-200">{fmtMinutes(data.blocks.avgMinutes)}</span>
                          <span className="text-neutral-500"> (median {fmtMinutes(data.blocks.medianMinutes)})</span>
                        </span>
                        <span className="w-20 text-right text-[10px]" title="직전 동일 길이 윈도우 대비">
                          {data.blocks.trend?.hasPrevData
                            ? <TrendArrow pct={data.blocks.trend.avgMinutesDeltaPct} />
                            : <span className="text-neutral-700">─</span>}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-neutral-400 shrink-0">분당 토큰</span>
                        <span className="flex-1 text-right text-sky-400">{fmtTokens(data.blocks.tokensPerMinute)}</span>
                        <span className="w-20 text-right text-[10px]" title="직전 동일 길이 윈도우 대비">
                          {data.blocks.trend?.hasPrevData
                            ? <TrendArrow pct={data.blocks.trend.tokensPerMinuteDeltaPct} />
                            : <span className="text-neutral-700">─</span>}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-neutral-400 shrink-0">최장 블록</span>
                        <span className="flex-1 text-right">
                          <span className="text-neutral-200">{fmtMinutes(data.blocks.maxMinutes)}</span>
                          {data.blocks.longestStartedAt && (
                            <span className="text-neutral-500"> ({fmtBlockDate(data.blocks.longestStartedAt)})</span>
                          )}
                        </span>
                        <span className="w-20 text-right text-neutral-700 text-[10px]">─</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-neutral-800">
                      <p className="text-[10px] text-neutral-500 mb-2 uppercase tracking-wider">길이 분포</p>
                      <div className="space-y-1 text-[11px] font-mono">
                        {(() => {
                          const dist = data.blocks.distribution;
                          const buckets: Array<[string, number]> = [
                            ["<30m", dist.lt30],
                            ["30m-1h", dist.m30to60],
                            ["1-2h", dist.h1to2],
                            ["2-4h", dist.h2to4],
                            ["4h+", dist.h4plus],
                          ];
                          const maxV = Math.max(...buckets.map(([, v]) => v), 1);
                          const med = data.blocks!.medianMinutes;
                          const medBucket = med < 30 ? 0 : med < 60 ? 1 : med < 120 ? 2 : med < 240 ? 3 : 4;
                          return buckets.map(([label, v], i) => (
                            <div key={label} className="flex items-center gap-2">
                              <span className="w-14 text-neutral-500">{label}</span>
                              <div className="flex-1 h-2 bg-neutral-800 rounded overflow-hidden">
                                <div className="h-full bg-sky-500/70 rounded" style={{ width: `${(v / maxV) * 100}%` }} />
                              </div>
                              <span className="w-8 text-right text-neutral-400">{v}</span>
                              <span className="w-16 text-[10px] text-sky-400">{i === medBucket ? "← median" : ""}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : <div />}

          {/* Engagement heatmap (lower bar 가설 검증 + 깊이 측정).
              일자별 총 머문 시간 (분) 으로 색 인코딩.
              level: 0 / <2min / 2-5 / 5-15 / 15+ min.
              tooltip 의 count 는 "분" 으로 입력 (사용자 hover 시 자연
              해석). 카드 라벨에 이번달 visit 횟수도 같이 표시 → "12회
              방문 · 평균 3:40" 통계 한 줄 inline. */}
          {(data.visitDaily ?? []).length > 0 ? (() => {
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
            // 이번달 (UTC YYYY-MM) 합계 — 카드 라벨용
            const monthKey = new Date().toISOString().slice(0, 7);
            const monthRows = rows.filter((r) => r.date.startsWith(monthKey));
            const monthVisitsTotal = monthRows.reduce((s, r) => s + r.visitCount, 0);
            const monthDwellTotal = monthRows.reduce((s, r) => s + r.dwellSec, 0);
            const avgDwellSec = monthVisitsTotal > 0 ? Math.round(monthDwellTotal / monthVisitsTotal) : 0;
            const avgMinSec = `${Math.floor(avgDwellSec / 60)}:${String(avgDwellSec % 60).padStart(2, "0")}`;
            return (
              <div data-testid="dash-card-dwell-heatmap" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-amber-500 rounded">
                <div className="px-3 py-2 border-b border-neutral-800">
                  <span data-testid="dash-heatmap-dwell" className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                    체류 히트맵 ({Math.round(rows.length / 7)}주, 일별 총 분
                    {monthVisitsTotal > 0 && ` · 이번달 ${monthVisitsTotal}회 방문 · 평균 ${avgMinSec}`})
                  </span>
                </div>
                <div className="p-3">
                  <ActivityCalendar
                    data={calData}
                    colorScheme="dark"
                    theme={{ dark: ["#1e293b", "#854d0e", "#a16207", "#ca8a04", "#facc15"] }}
                    labels={{ legend: { less: "0", more: "15+" } }}
                    showWeekdayLabels
                    blockSize={11}
                    showTotalCount={false}
                  />
                </div>
              </div>
            );
          })() : <div />}
        </div>

        {/* Row 7: MCP Servers (반쪽만, 우측은 빈칸 — Active Blocks 추가로 한 칸 밀려남) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* MCP Servers */}
          <div data-testid="dash-card-mcp" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-cyan-500 rounded">
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

        </div>

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
