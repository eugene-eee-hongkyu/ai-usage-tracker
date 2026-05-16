"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { AdminNav } from "@/components/admin-nav";
import { TeamPlanHealthCard, type TeamPlanSummary } from "@/components/team-plan-health-card";
import { TeamUsageHero } from "@/components/team-usage-hero";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from "recharts";
import { ScoreGauge, scoreLabel } from "@/components/score-gauge";
import { computeTokenLevel, computeDailyEfficiencyScore } from "@/lib/rules";

type Period = "today" | "8days" | "month" | "30days" | "all";
type GradeLevel = "탁월" | "양호" | "보통" | "부족" | "경고";

const PERIOD_LABELS: Record<Period, string> = {
  today: "오늘", "8days": "8일", month: "이번달", "30days": "30일", all: "전체",
};

const GRADE_STYLES: Record<GradeLevel, string> = {
  "탁월": "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40",
  "양호": "bg-green-500/15 text-green-400 border border-green-500/40",
  "보통": "bg-yellow-500/15 text-yellow-400 border border-yellow-500/40",
  "부족": "bg-orange-500/15 text-orange-400 border border-orange-500/40",
  "경고": "bg-red-500/15 text-red-400 border border-red-500/40",
};

const GRADE_VALUE_COLOR: Record<GradeLevel, string> = {
  "탁월": "text-emerald-400",
  "양호": "text-green-400",
  "보통": "text-yellow-400",
  "부족": "text-orange-400",
  "경고": "text-red-400",
};

const GRADE_CELL_BG: Record<GradeLevel, string> = {
  "탁월": "bg-emerald-500/25",
  "양호": "bg-green-500/20",
  "보통": "bg-slate-600/25",
  "부족": "bg-amber-500/25",
  "경고": "bg-red-500/30",
};

const MEMBER_COLORS = [
  "#4f46e5", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
];

interface MemberStat {
  userId: number;
  name: string;
  avatarUrl: string | null;
  lastSyncedAt: string | null;
  totalCost: number;
  totalTokens: number;
  sessionsCount: number;
  cacheHitPct: number;
  overallOneShot: number;
  efficiencyScore: number;
  topProject: string;
  callsCount: number;
  outputInputRatio: number;
  ccusageMissing?: boolean;
  monthVisits: number;        // 이번달 (UTC) 방문 횟수
  avgDwellSec: number;        // 이번달 평균 체류 (초)
  tokensPerMinute: number | null;  // user_blocks 기반 분당 토큰. 블록 없으면 null
  avgDailyTokens: number;     // period 활성일 평균 total tokens (사용량 신호)
}

interface TeamActivity {
  name: string;
  totalCost: number;
  totalTurns: number;
  memberCount: number;
}

interface TopSession {
  userId: number;
  userName: string;
  id: string;
  date: string;
  project: string;
  cost: number;
  calls: number;
}

interface IndustryComparison {
  windowDays: number;
  activeDayCount: number;
  activeDayAvg: number;
  activeDayP50: number;
  activeDayP75: number;
  activeDayP90: number;
  activeDayMax: number;
  perDevMonthAvg: number;
  perDevMonthMax: number;
}

interface TeamData {
  byEfficiency: MemberStat[];
  bySessions: MemberStat[];
  isAdminUser: boolean;
  teamSummary: {
    totalCost: number;
    totalSessions: number;
    activeMemberCount: number;
    avgCacheHitPct: number;
    avgOneShotRate: number;
  };
  daily: Array<{ date: string; cost: number }>;
  teamActivities: TeamActivity[];
  dailyByMember: Array<Record<string, number | string>>;
  memberNames: string[];
  topSessions: TopSession[];
  teamModels?: Array<{ name: string; cost: number; calls: number; cacheHitPct: number }>;
  teamTools?: Array<{ name: string; calls: number }>;
  teamShellCommands?: Array<{ name: string; calls: number }>;
  industryComparison?: IndustryComparison;
  teamScore?: {
    score: number | null;
    cacheHitPct: number;
    costPerCall: number;
    memberCount: number;
    windowDays: number;
  } | null;
  teamPlanHealth?: TeamPlanSummary;
  teamUsage?: {
    periodDays: number;
    powerIndex: number;
    activeMembers: number;
    avgActiveDays: number;
    avgDailyTokens: number;
    priceForPeriodSum: number | null;
    totalWindowTokensSum: number;
  };
  memberUsage?: Array<{
    userId: number;
    name: string;
    memberKey: string;
    powerIndex: number;
    declaredTier: string | null;
    estimatedTier: string | null;
    effectiveTier: string | null;
    monthlyPriceUsd: number | null;
    isEstimated: boolean;
    activeDays: number;
    totalTokens: number;
  }>;
  dailyUnitCostByMember?: Array<Record<string, number | string | null>>;
}

function AdminBadge() {
  return (
    <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 leading-none">ADMIN</span>
  );
}

function SyncBadge({ lastSyncedAt, userId }: { lastSyncedAt: string | null; userId?: string | number }) {
  const tid = userId !== undefined ? `team-sync-badge-${userId}` : undefined;
  if (!lastSyncedAt) return <span data-testid={tid} className="text-[10px] text-red-400 font-mono">미수신</span>;
  const days = Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 86_400_000);
  if (days >= 5) return <span data-testid={tid} className="text-[10px] text-red-400 font-mono" title="데이터 수신 없음">⚠{days}일</span>;
  if (days >= 2) return <span data-testid={tid} className="text-[10px] text-yellow-500 font-mono">{days}일전</span>;
  return null;
}

function CcusageMissingBadge({ missing, userId }: { missing: boolean | undefined; userId?: string | number }) {
  if (!missing) return null;
  const tid = userId !== undefined ? `team-ccusage-badge-${userId}` : undefined;
  return (
    <span
      data-testid={tid}
      className="text-[10px] text-orange-400 font-mono px-1 py-0.5 rounded bg-orange-500/10 border border-orange-500/40 leading-none"
      title="ccusage 미설치 — 토큰/비용 데이터가 수집되지 않습니다. npm install -g ccusage 후 repair 실행 필요"
    >
      ccusage❌
    </span>
  );
}

function GradePill({ grade }: { grade: GradeLevel }) {
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono ${GRADE_STYLES[grade]}`}>
      {grade}
    </span>
  );
}

function cacheHitGrade(v: number): GradeLevel {
  if (v >= 96) return "탁월"; if (v >= 90) return "양호"; if (v >= 80) return "보통"; if (v >= 60) return "부족"; return "경고";
}
function oneShotGrade(v: number): GradeLevel {
  if (v >= 80) return "탁월"; if (v >= 40) return "보통"; return "경고";
}
function costGrade(v: number): GradeLevel {
  if (v < 25) return "탁월"; if (v < 100) return "보통"; return "경고";
}
// 사용량 (token volume) — 개인 EFFICIENCY 카드와 동일 등급 매핑.
// computeTokenLevel 의 0~10 단계를 5-level GradeLevel 로 압축 (UI 색 컨벤션 공유).
function tokenLevelGrade(level: number): GradeLevel {
  if (level >= 8) return "탁월";
  if (level >= 6) return "양호";
  if (level >= 3) return "보통";
  if (level >= 1) return "부족";
  return "경고";
}
// outputInputGrade 제거 — 외부 anchor 없음, cache 와 multi-collinear.

// 종합 점수 — 개인 EFFICIENCY 와 동일 공식 (cache 42 + one-shot 18 + cost 10 + 사용량 30).
// 이전엔 별도 (cache 40 + one-shot 40 + cost 20) 사용했지만 개인 게이지·배지와
// 불일치 — 같은 사람 점수가 화면마다 달라 보이는 문제. 통일.
function computeMemberScore(m: MemberStat): number | null {
  if (m.sessionsCount === 0) return null;
  const cpc = m.callsCount > 0 ? m.totalCost / m.callsCount : 0;
  return computeDailyEfficiencyScore(m.cacheHitPct, cpc, m.overallOneShot * 100, m.avgDailyTokens);
}
function scoreToGrade(score: number | null): GradeLevel {
  if (score === null) return "경고";
  if (score >= 90) return "탁월";
  if (score >= 75) return "양호";
  if (score >= 55) return "보통";
  if (score >= 35) return "부족";
  return "경고";
}
function overallGrade(m: MemberStat): GradeLevel {
  return scoreToGrade(computeMemberScore(m));
}

function fmtSyncTime(ts: string): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${min}`;
}

function syncStyle(lastSyncedAt: string | null): { timeClass: string; badge: React.ReactNode } {
  if (!lastSyncedAt) return { timeClass: "text-red-400", badge: <span className="text-[10px] text-red-400">미수신</span> };
  const days = Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 86_400_000);
  if (days >= 5) return { timeClass: "text-red-400", badge: <span className="text-[10px] text-red-400">⚠{days}일</span> };
  if (days >= 2) return { timeClass: "text-yellow-500", badge: <span className="text-[10px] text-yellow-500">{days}일전</span> };
  return { timeClass: "text-neutral-300", badge: null };
}

function fmtDate(d: string): string {
  const m = d.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${parseInt(m[1])}/${parseInt(m[2])}` : d;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// memberNames are "name__userId" keys; strip the suffix for display
function memberLabel(key: string): string {
  return key.replace(/__\d+$/, "");
}

function GradeCell({ grade, children, testid, tooltip }: { grade: GradeLevel; children: React.ReactNode; testid?: string; tooltip?: string }) {
  return (
    <td data-testid={testid} title={tooltip ?? grade} className={`py-2.5 px-3 text-right whitespace-nowrap tabular-nums ${GRADE_CELL_BG[grade]}`}>
      <span className={`font-bold ${GRADE_VALUE_COLOR[grade]}`}>{children}</span>
    </td>
  );
}

interface MemberTooltipPayload {
  dataKey: string;
  value: number;
  color: string;
}

function MemberTooltip({ active, payload, label }: { active?: boolean; payload?: MemberTooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div style={{ background: "#171717", border: "1px solid #404040", borderRadius: 6, fontSize: 11, fontFamily: "monospace", padding: "6px 10px" }}>
      <div style={{ color: "#737373", marginBottom: 4 }}>{label}</div>
      {sorted.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {memberLabel(p.dataKey)} : ${p.value.toFixed(2)}
        </div>
      ))}
    </div>
  );
}

export function TeamView({ adminMode = false }: { adminMode?: boolean }) {
  const NavComponent = adminMode ? AdminNav : Nav;
  const { data: session, status } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("month");

  useEffect(() => {
    const saved = localStorage.getItem("team_period");
    // legacy "week" → "8days" (calendar week feature was removed)
    const upgraded = saved === "week" ? "8days" : saved;
    if (upgraded && ["today", "8days", "month", "30days", "all"].includes(upgraded)) {
      setPeriod(upgraded as Period);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("team_period", period);
  }, [period]);
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    setFetchError(false);
    fetch(`/api/team?period=${period}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => {
        if (d?.error) { setFetchError(true); setLoading(false); return; }
        setData(d);
        setLoading(false);
      })
      .catch(() => { setFetchError(true); setLoading(false); });
  }, [session, period, reloadKey]);

  if (fetchError) return (
    <div className="min-h-screen bg-neutral-950">
      <NavComponent />
      <div data-testid="team-fetch-error" className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-neutral-400 font-mono text-sm">팀 데이터를 불러오지 못했습니다.</p>
        <button
          data-testid="team-retry"
          onClick={() => setReloadKey((k) => k + 1)}
          className="px-4 py-1.5 bg-neutral-800 rounded text-sm text-neutral-200 hover:bg-neutral-700 font-mono"
        >다시 시도</button>
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-neutral-950">
      <NavComponent />
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-neutral-500 text-sm font-mono">로딩 중...</div>
      </div>
    </div>
  );

  const adminUser = adminMode && data.isAdminUser;
  const members = data.byEfficiency;
  const sum = data.teamSummary;
  const byCost = [...members].sort((a, b) => b.totalCost - a.totalCost);
  const byTokens = [...members].sort((a, b) => b.totalTokens - a.totalTokens);
  const memberColorMap = Object.fromEntries(members.map((m, i) => [m.name, MEMBER_COLORS[i % MEMBER_COLORS.length]]));
  const maxCost = Math.max(...byCost.map((m) => m.totalCost), 0.01);
  const maxTokens = Math.max(...byTokens.map((m) => m.totalTokens), 1);
  const maxActivity = Math.max(...(data.teamActivities ?? []).map((a) => a.totalTurns), 0.01);

  // Compute team total from dailyByMember — same source as By Member chart to stay in sync
  const dailyTotal = (data.dailyByMember ?? []).map((row) => ({
    date: String(row.date),
    cost: (data.memberNames ?? []).reduce((s, key) => s + (Number(row[key]) || 0), 0),
  }));

  // Grade counts for efficiency header
  const gradeCounts = members.reduce<Record<GradeLevel, number>>(
    (acc, m) => {
      const g = overallGrade(m);
      acc[g] = (acc[g] ?? 0) + 1;
      return acc;
    },
    { "탁월": 0, "양호": 0, "보통": 0, "부족": 0, "경고": 0 }
  );
  const gradeSummary = (["탁월", "양호", "보통", "부족", "경고"] as GradeLevel[])
    .filter((g) => gradeCounts[g] > 0)
    .map((g) => `${g} ${gradeCounts[g]}명`)
    .join(" · ");

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <NavComponent />

      {/* Period Tabs */}
      <div className="border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 pt-3 pb-2 flex gap-1">
          {(["today", "8days", "month", "30days", "all"] as Period[]).map((p) => (
            <button
              key={p}
              data-testid={`team-period-${p}`}
              onClick={() => setPeriod(p)}
              className={`w-16 text-center py-1 rounded text-xs font-mono transition-colors ${period === p ? "bg-indigo-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"}`}
            >{PERIOD_LABELS[p]}</button>
          ))}
        </div>
      </div>

      {/* Team Summary Bar */}
      <div data-testid="team-summary-bar" className="bg-neutral-900 border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap gap-x-5 gap-y-1 text-sm font-mono">
          <span><span className="text-cyan-400 font-bold">{fmtTokens(members.reduce((s, m) => s + m.totalTokens, 0))}</span><span className="text-neutral-500 ml-1 text-xs">총토큰</span></span>
          <span><span className="text-yellow-400 font-bold">${sum.totalCost.toFixed(2)}</span><span className="text-neutral-500 ml-1 text-xs">총비용</span></span>
          <span><span className="text-blue-400 font-bold">{sum.totalSessions.toLocaleString()}</span><span className="text-neutral-500 ml-1 text-xs">세션</span></span>
          <span><span className="text-cyan-400 font-bold">{sum.activeMemberCount}</span><span className="text-neutral-500 ml-1 text-xs">명 활성</span></span>
          <span><span className="text-emerald-400 font-bold">{sum.avgCacheHitPct.toFixed(1)}%</span><span className="text-neutral-500 ml-1 text-xs">평균 cache hit</span></span>
          <span><span className="text-pink-400 font-bold">{Math.round(sum.avgOneShotRate * 100)}%</span><span className="text-neutral-500 ml-1 text-xs">평균 1-shot</span></span>
        </div>
      </div>

      <main className={`max-w-6xl mx-auto px-4 py-4 space-y-4 transition-opacity duration-150 ${loading ? "opacity-40 pointer-events-none" : "opacity-100"}`}>

        {/* 매니저 향 AX 척도 한 줄 banner — 5초 안에 "AX 잘 되고 있나" 답.
            인터뷰에서 매니저 자기 액션 후보 #1 "AX 가시화 즉각성" 반영.
            OKR / 분기 보고 시 그대로 복사 가능한 한 문장. */}
        {adminUser && data.teamScore && data.industryComparison && data.industryComparison.activeDayCount > 0 && (() => {
          const ic = data.industryComparison;
          const enterpriseAvg = 13;
          const multiplier = ic.activeDayAvg / enterpriseAvg;
          const memberActiveCount = data.teamSummary.activeMemberCount;
          const memberTotal = data.byEfficiency.length;
          return (
            <div data-testid="team-ax-banner" className="bg-emerald-950/30 border-l-4 border-l-emerald-500 border border-emerald-800/40 rounded px-4 py-2.5">
              <div className="flex items-center gap-3 flex-wrap text-sm font-mono">
                <span className="text-emerald-300 font-bold">🎯 AX 척도</span>
                <span className="text-neutral-400">·</span>
                <span className="text-neutral-200">
                  팀이 회사 도입 평균의 <span className="text-emerald-400 font-bold">{multiplier.toFixed(1)}×</span> 활용
                </span>
                <span className="text-neutral-400">·</span>
                <span className="text-neutral-200">
                  cache <span className="text-emerald-400 font-bold">{data.teamSummary.avgCacheHitPct.toFixed(0)}%</span>
                </span>
                <span className="text-neutral-400">·</span>
                <span className="text-neutral-200">
                  활성 <span className="text-emerald-400 font-bold">{memberActiveCount}/{memberTotal}</span>명
                </span>
                {data.teamPlanHealth && data.teamPlanHealth.monthlySavingsUsd > 0 && (
                  <>
                    <span className="text-neutral-400">·</span>
                    <span className="text-neutral-200">
                      Plan 최적화 시 <span className="text-emerald-400 font-bold">${data.teamPlanHealth.monthlySavingsUsd}</span>/월 절감 가능
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* Team Usage Hero — 팀 활용지수 + 토큰단가 (개인 화면 대응).
            page top 자리에 배치, 효율 점수 카드는 efficiency 위로 이동. */}
        {data.teamUsage && (
          <TeamUsageHero
            powerIndex={data.teamUsage.powerIndex}
            activeMembers={data.teamUsage.activeMembers}
            avgActiveDays={data.teamUsage.avgActiveDays}
            avgDailyTokens={data.teamUsage.avgDailyTokens}
            periodDays={data.teamUsage.periodDays}
            periodLabel={PERIOD_LABELS[period]}
            priceForPeriodSum={data.teamUsage.priceForPeriodSum}
            totalWindowTokensSum={data.teamUsage.totalWindowTokensSum}
          />
        )}

        {members.length === 0 ? (
          <div data-testid="team-empty" className="bg-neutral-900 border border-neutral-800 rounded-lg p-8 text-center text-neutral-500 text-sm font-mono">
            해당 기간에 활동 데이터가 없어요.
          </div>
        ) : (
          <>
            {/* Row 1: Daily Cost Trend — stacked (per-member) + total */}
            {(data.dailyByMember ?? []).length > 1 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Stacked per-member */}
                <div data-testid="team-card-by-member" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-cyan-500 rounded">
                  <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">By Member</span>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 justify-end">
                      {(data.memberNames ?? []).map((key, i) => (
                        <span key={key} className="flex items-center gap-1 text-[10px] font-mono text-neutral-400">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: MEMBER_COLORS[i % MEMBER_COLORS.length] }} />
                          {memberLabel(key)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="p-3">
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart
                        data={(data.dailyByMember ?? []).map((row) => ({
                          ...row,
                          date: fmtDate(String(row.date)),
                        }))}
                        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                      >
                        <defs>
                          {(data.memberNames ?? []).map((key, i) => (
                            <linearGradient key={key} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={MEMBER_COLORS[i % MEMBER_COLORS.length]} stopOpacity={0.4} />
                              <stop offset="95%" stopColor={MEMBER_COLORS[i % MEMBER_COLORS.length]} stopOpacity={0.05} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                        <XAxis dataKey="date" tick={{ fill: "#525252", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fill: "#525252", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={40} />
                        <Tooltip content={<MemberTooltip />} />
                        {(data.memberNames ?? []).map((key, i) => (
                          <Area key={key} type="monotone" dataKey={key} stroke={MEMBER_COLORS[i % MEMBER_COLORS.length]} strokeWidth={1.5} fill={`url(#grad-${i})`} dot={false} />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Total aggregated */}
                <div data-testid="team-card-total" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-cyan-500 rounded">
                  <div className="px-3 py-2 border-b border-neutral-800">
                    <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">Team Total</span>
                  </div>
                  <div className="p-3">
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart
                        data={dailyTotal.map((row) => ({
                          date: fmtDate(row.date),
                          cost: row.cost,
                        }))}
                        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="grad-total" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.03} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                        <XAxis dataKey="date" tick={{ fill: "#525252", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fill: "#525252", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={40} />
                        <Tooltip
                          contentStyle={{ background: "#171717", border: "1px solid #404040", borderRadius: 6, fontSize: 11, fontFamily: "monospace" }}
                          formatter={(v) => [`$${Number(v).toFixed(2)}`, "팀 합산"]}
                        />
                        <Area type="monotone" dataKey="cost" stroke="#06b6d4" strokeWidth={2} fill="url(#grad-total)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            )}

            {/* Row 2: Activity (tokens) + Cost */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Activity (tokens) */}
              <div data-testid="team-card-activity" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-cyan-500 rounded">
                <div className="px-3 py-2 border-b border-neutral-800">
                  <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">Activity</span>
                </div>
                <div className="p-3">
                  <div className="flex text-xs text-neutral-600 font-mono mb-1.5">
                    <span className="w-16 shrink-0" />
                    <span className="flex-1">member</span>
                    <span className="w-16 text-right">tokens</span>
                  </div>
                  <div className="space-y-1">
                    {byTokens.map((m) => {
                      const idx = members.findIndex((x) => x.userId === m.userId);
                      return (
                        <div key={m.userId} className="flex items-center gap-1.5 text-xs font-mono">
                          <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                            <div
                              className="h-full rounded"
                              style={{
                                width: `${(m.totalTokens / maxTokens) * 100}%`,
                                background: MEMBER_COLORS[idx % MEMBER_COLORS.length],
                              }}
                            />
                          </div>
                          <span className="flex-1 text-neutral-300 truncate flex items-center gap-1.5">
                            <span className="truncate">{m.name}</span>
                            <CcusageMissingBadge missing={m.ccusageMissing} userId={m.userId} />
                          </span>
                          <span className="w-16 text-cyan-300 text-right tabular-nums">{fmtTokens(m.totalTokens)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Cost */}
              <div data-testid="team-card-cost" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-yellow-500 rounded">
                <div className="px-3 py-2 border-b border-neutral-800">
                  <span className="text-xs font-mono font-bold text-yellow-400 uppercase tracking-wider">Cost</span>
                </div>
                <div className="p-3">
                  <div className="flex text-xs text-neutral-600 font-mono mb-1.5">
                    <span className="w-16 shrink-0" />
                    <span className="flex-1">member</span>
                    <span className="w-16 text-right">cost</span>
                    <span className="w-12 text-right">s</span>
                  </div>
                  <div className="space-y-1">
                    {byCost.map((m) => {
                      const idx = members.findIndex((x) => x.userId === m.userId);
                      return (
                        <div key={m.userId} className="flex items-center gap-1.5 text-xs font-mono">
                          <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                            <div
                              className="h-full rounded"
                              style={{
                                width: `${(m.totalCost / maxCost) * 100}%`,
                                background: MEMBER_COLORS[idx % MEMBER_COLORS.length],
                              }}
                            />
                          </div>
                          <span className="flex-1 text-neutral-300 truncate">{m.name}</span>
                          <span className="w-16 text-yellow-400 text-right tabular-nums">${m.totalCost.toFixed(2)}</span>
                          <span className="w-12 text-neutral-600 text-right tabular-nums">{m.sessionsCount}s</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2.5: 활용지수 순위 + 일별 토큰 단가 (멤버별) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* 활용지수 순위 — period 분모가 멤버 동일 → 직접 비교 정확 */}
              <div data-testid="team-card-power-rank" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-cyan-500 rounded">
                <div className="px-3 py-2 border-b border-neutral-800">
                  <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">활용 지수 순위</span>
                </div>
                <div className="p-3">
                  <div className="flex text-xs text-neutral-600 font-mono mb-1.5">
                    <span className="flex-1">member</span>
                    <span className="w-16 text-right">score</span>
                  </div>
                  <div className="space-y-1">
                    {(() => {
                      const rows = (data.memberUsage ?? [])
                        .filter((m) => m.powerIndex > 0)
                        .sort((a, b) => b.powerIndex - a.powerIndex);
                      if (rows.length === 0) {
                        return <p className="text-neutral-600 text-xs font-mono">no data</p>;
                      }
                      const maxScore = Math.max(...rows.map((r) => r.powerIndex), 1);
                      return rows.map((m) => {
                        const idx = (data.memberNames ?? []).indexOf(m.memberKey);
                        const color = MEMBER_COLORS[(idx >= 0 ? idx : 0) % MEMBER_COLORS.length];
                        return (
                          <div key={m.userId} className="flex items-center gap-1.5 text-xs font-mono">
                            <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                              <div className="h-full rounded" style={{ width: `${(m.powerIndex / maxScore) * 100}%`, background: color }} />
                            </div>
                            <span className="flex-1 text-neutral-300 truncate">{m.name}</span>
                            <span className="w-16 text-cyan-300 text-right tabular-nums font-bold">{m.powerIndex}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* 일별 토큰 단가 (멤버별) — 멤버별 plan 가치 / 일별 토큰 × 1M */}
              <div data-testid="team-card-daily-unit-cost" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-yellow-500 rounded">
                <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between flex-wrap gap-y-1">
                  <span className="text-xs font-mono font-bold text-yellow-400 uppercase tracking-wider">일별 토큰 단가 ($ / 1M)</span>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 justify-end">
                    {(data.memberUsage ?? []).filter((m) => m.monthlyPriceUsd).map((m) => {
                      const idx = (data.memberNames ?? []).indexOf(m.memberKey);
                      const color = MEMBER_COLORS[(idx >= 0 ? idx : 0) % MEMBER_COLORS.length];
                      return (
                        <span key={m.userId} className="flex items-center gap-1 text-[10px] font-mono text-neutral-400">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                          {m.name}{m.isEstimated && <span className="text-amber-400"> (추정)</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="p-3">
                  {(data.dailyUnitCostByMember ?? []).length === 0 ? (
                    <p className="text-neutral-600 text-xs font-mono">no data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart
                        data={(data.dailyUnitCostByMember ?? []).map((row) => ({
                          ...row,
                          date: fmtDate(String(row.date)),
                        }))}
                        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="date" stroke="#525252" fontSize={10} interval="preserveStartEnd" />
                        <YAxis stroke="#525252" fontSize={10} scale="log" domain={[0.001, "auto"]} tickFormatter={(v) => {
                          const n = Number(v);
                          if (n >= 1) return `$${n.toFixed(1)}`;
                          if (n >= 0.01) return `$${n.toFixed(2)}`;
                          return `$${n.toFixed(3)}`;
                        }} />
                        <Tooltip
                          contentStyle={{ background: "#0a0a0a", border: "1px solid #404040", fontSize: 11, fontFamily: "monospace" }}
                          formatter={(v, name) => {
                            if (v == null) return ["—", String(name)];
                            const n = Number(v);
                            const s = n >= 1 ? `$${n.toFixed(2)}` : n >= 0.01 ? `$${n.toFixed(3)}` : `$${n.toFixed(4)}`;
                            return [`${s} / 1M`, memberLabel(String(name))];
                          }}
                        />
                        {(data.memberUsage ?? []).filter((m) => m.monthlyPriceUsd).map((m) => {
                          const idx = (data.memberNames ?? []).indexOf(m.memberKey);
                          const color = MEMBER_COLORS[(idx >= 0 ? idx : 0) % MEMBER_COLORS.length];
                          return (
                            <Line
                              key={m.userId}
                              type="monotone"
                              dataKey={m.memberKey}
                              stroke={color}
                              strokeWidth={1.5}
                              strokeDasharray={m.isEstimated ? "4 3" : undefined}
                              dot={false}
                              connectNulls={false}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                  <p className="text-[10px] font-mono text-neutral-600 mt-1.5">
                    낮을수록 plan 잘 활용 · 점선 = tier 추정 멤버 · 활동 없는 날은 line 끊김 · log scale
                  </p>
                </div>
              </div>

            </div>

            {/* Team Headline — 효율 점수 + 업계 비교. page top 에서 Efficiency
                직전으로 이동 — TeamUsageHero (활용지수/단가) 가 page top 차지. */}
            {data.teamScore && data.industryComparison && data.industryComparison.activeDayCount > 0 && (() => {
              const ts = data.teamScore;
              const ic = data.industryComparison;
              const fmt = (n: number) => `$${n < 10 ? n.toFixed(2) : Math.round(n)}`;
              const enterpriseAvg = 13;
              const multiplier = ic.activeDayAvg / enterpriseAvg;
              const bulletMax = Math.max(102, ic.activeDayAvg * 1.2);
              const bulletRows: Array<{ label: string; value: number; star?: boolean; benchmark?: boolean }> = [
                { label: "일반 사용자 평균", value: 6 },
                { label: "일반 사용자 상위 10%", value: 12 },
                { label: "회사 도입 평균", value: 13, benchmark: true },
                { label: "회사 도입 상위 10%", value: 30 },
                { label: "전세계 상위 1% (추정)", value: 92 },
                { label: "PRIMUS 팀", value: ic.activeDayAvg, star: true },
              ];
              return (
                <div data-testid="team-card-headline" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-emerald-500 rounded">
                  <div className="px-3 py-2 border-b border-neutral-800">
                    <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                      Primus 팀 헤드라인 — 효율 점수 + 업계 비교 (최근 30일)
                    </span>
                  </div>
                  <div className="p-4 grid grid-cols-12 gap-x-6 gap-y-4 items-center">
                    <div data-testid="team-headline-score" className="col-span-12 sm:col-span-3 flex flex-col items-center">
                      <ScoreGauge score={ts.score} />
                      <div className="mt-1.5 text-[11px] font-mono">
                        <span className={`font-bold ${
                          ts.score === null ? "text-neutral-500" :
                          ts.score >= 90 ? "text-emerald-400" :
                          ts.score >= 70 ? "text-lime-400" :
                          ts.score >= 40 ? "text-orange-400" : "text-rose-400"
                        }`}>{scoreLabel(ts.score)}</span>
                        <span className="text-neutral-500"> · 팀 평균 (10명)</span>
                      </div>
                      <span className="text-[10px] font-mono text-neutral-600 mt-0.5">
                        cache {ts.cacheHitPct.toFixed(1)}% · ${ts.costPerCall.toFixed(3)}/call
                      </span>
                    </div>
                    <div data-testid="team-headline-multiplier" className="col-span-12 sm:col-span-3 flex flex-col items-center">
                      <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-mono font-bold text-emerald-400">
                          {multiplier.toFixed(1)}
                        </span>
                        <span className="text-2xl font-mono text-emerald-400">x</span>
                      </div>
                      <span className="text-[11px] font-mono text-neutral-400 mt-1.5 text-center">
                        회사 도입 평균 (${enterpriseAvg}) 대비
                      </span>
                      <span className="text-[10px] font-mono text-emerald-300 mt-0.5">
                        Claude Code 적극 활용 팀
                      </span>
                    </div>
                    <div data-testid="team-headline-bullet" className="col-span-12 sm:col-span-6">
                      <div className="text-[10px] font-mono text-neutral-500 mb-1.5 uppercase tracking-wider">
                        $/active day 비교
                      </div>
                      <div className="space-y-1 text-[11px] font-mono">
                        {bulletRows.map((row) => (
                          <div key={row.label} className="flex items-center gap-2">
                            <span className={`w-32 shrink-0 ${row.star ? "text-emerald-300 font-bold" : row.benchmark ? "text-yellow-300" : "text-neutral-400"}`}>
                              {row.star && "★ "}{row.label}
                            </span>
                            <div className="flex-1 h-2.5 bg-neutral-800 rounded overflow-hidden relative">
                              <div
                                className={`h-full rounded ${row.star ? "bg-emerald-500" : row.benchmark ? "bg-yellow-500/70" : "bg-neutral-600"}`}
                                style={{ width: `${Math.min(100, (row.value / bulletMax) * 100)}%` }}
                              />
                            </div>
                            <span className={`w-14 text-right tabular-nums ${row.star ? "text-emerald-300 font-bold" : "text-neutral-400"}`}>
                              {fmt(row.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[9px] font-mono text-neutral-700 mt-2">
                        as of 2026-05 · 출처 : Anthropic Claude Code 공식 통계 + 커뮤니티 헤비 사용자 보고
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Row 3: Efficiency (full-width) — 컬럼 6개 가독성 위해 1줄 차지. */}
            <div data-testid="team-card-efficiency" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-fuchsia-500 rounded">
                <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-fuchsia-400 uppercase tracking-wider">Efficiency</span>
                  {gradeSummary && (
                    <span className="text-[10px] font-mono text-neutral-500 shrink-0">{gradeSummary}</span>
                  )}
                </div>
                <div className="p-3 overflow-x-auto">
                  <table className="w-full text-xs font-mono border-collapse table-fixed">
                    <thead>
                      <tr className="border-b border-neutral-800">
                        <th className="text-left text-neutral-500 pb-2 pr-4 font-normal w-[24%]">멤버</th>
                        <th className="text-right text-neutral-500 pb-2 px-3 font-normal w-[15%]">cache</th>
                        <th className="text-right text-neutral-500 pb-2 px-3 font-normal w-[15%]">1-shot</th>
                        <th className="text-right text-neutral-500 pb-2 px-3 font-normal w-[15%]">$/sess</th>
                        <th className="text-right text-neutral-500 pb-2 px-3 font-normal w-[15%]" title="활성일 평균 total tokens (글로벌 10단계 anchor)">사용량</th>
                        <th className="text-right text-neutral-500 pb-2 pl-3 font-normal w-[16%]">종합</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // 팀 평균 계산 — 각 셀 hover tooltip 에서 "내가 팀 대비 어디?"
                        // 답하는 데 사용. 표시된 멤버 전원 단순 평균.
                        const N = members.length || 1;
                        const avgCache = members.reduce((s, m) => s + m.cacheHitPct, 0) / N;
                        const avgOneShot = members.reduce((s, m) => s + m.overallOneShot, 0) / N;
                        const avgCostPS = members.reduce((s, m) => s + (m.sessionsCount > 0 ? m.totalCost / m.sessionsCount : 0), 0) / N;
                        const avgTokensTeam = members.reduce((s, m) => s + m.avgDailyTokens, 0) / N;
                        const avgTokenLvl = computeTokenLevel(avgTokensTeam);
                        return members.map((m, i) => {
                        const costPerSession = m.sessionsCount > 0 ? m.totalCost / m.sessionsCount : 0;
                        const score = computeMemberScore(m);
                        const grade = scoreToGrade(score);
                        // 자기 row 강조 — 임원/팀 리더의 첫 시각 동선 "내 위치 어디?".
                        // session.user.name === m.name 매칭. 동명이인이면 둘 다 강조되는 quirk
                        // 있지만 visual nudge 로는 충분.
                        const isSelf = session?.user?.name === m.name;
                        // vs-팀-평균 tooltip 문자열 — 임원/리더 핵심 질문 "내가 팀 대비 어디?".
                        const cacheDelta = m.cacheHitPct - avgCache;
                        const cacheTooltip = `팀 평균 ${avgCache.toFixed(1)}% · 내 ${m.cacheHitPct.toFixed(1)}% (${cacheDelta >= 0 ? "+" : ""}${cacheDelta.toFixed(1)}%p)`;
                        const oneShotPct = m.overallOneShot * 100;
                        const oneShotDelta = oneShotPct - avgOneShot * 100;
                        const oneShotTooltip = `팀 평균 ${(avgOneShot * 100).toFixed(0)}% · 내 ${Math.round(oneShotPct)}% (${oneShotDelta >= 0 ? "+" : ""}${oneShotDelta.toFixed(0)}%p)`;
                        const costDelta = costPerSession - avgCostPS;
                        const costTooltip = `팀 평균 $${avgCostPS.toFixed(2)} · 내 $${costPerSession.toFixed(2)} (${costDelta >= 0 ? "+" : ""}$${costDelta.toFixed(2)})`;
                        const myTokenLvl = computeTokenLevel(m.avgDailyTokens);
                        const tokenTooltip = m.avgDailyTokens > 0
                          ? `팀 평균 ${avgTokenLvl}/10 (${fmtTokens(avgTokensTeam)}) · 내 ${myTokenLvl}/10 (${fmtTokens(m.avgDailyTokens)})`
                          : "활동 없음";
                        return (
                          <tr
                            key={m.userId}
                            data-testid={`team-eff-row-${m.userId}`}
                            data-self={isSelf || undefined}
                            className={`border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors ${
                              isSelf ? "bg-emerald-500/5 ring-1 ring-inset ring-emerald-500/30" : ""
                            }`}
                          >
                            <td className="py-2.5 pr-4">
                              <span className="flex items-center gap-2 text-neutral-300">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ background: MEMBER_COLORS[i % MEMBER_COLORS.length] }}
                                />
                                <span className={isSelf ? "font-bold text-emerald-300" : ""}>{m.name}</span>
                                {isSelf && <span className="text-[10px] font-mono text-emerald-400/80">(나)</span>}
                                <SyncBadge lastSyncedAt={m.lastSyncedAt} userId={m.userId} />
                                <CcusageMissingBadge missing={m.ccusageMissing} userId={m.userId} />
                              </span>
                            </td>
                            <GradeCell testid={`team-eff-cache-${m.userId}`} grade={cacheHitGrade(m.cacheHitPct)} tooltip={cacheTooltip}>
                              {m.cacheHitPct.toFixed(1)}%
                            </GradeCell>
                            <GradeCell testid={`team-eff-oneshot-${m.userId}`} grade={oneShotGrade(m.overallOneShot * 100)} tooltip={oneShotTooltip}>
                              {Math.round(m.overallOneShot * 100)}%
                            </GradeCell>
                            <GradeCell testid={`team-eff-cost-${m.userId}`} grade={costGrade(costPerSession)} tooltip={costTooltip}>
                              ${costPerSession.toFixed(2)}
                            </GradeCell>
                            <GradeCell testid={`team-eff-tokens-${m.userId}`} grade={tokenLevelGrade(myTokenLvl)} tooltip={tokenTooltip}>
                              {m.avgDailyTokens > 0 ? (
                                <span className="inline-flex items-baseline gap-1 justify-end">
                                  <span>{myTokenLvl}/10</span>
                                  <span className="text-[10px] opacity-70 font-normal">{fmtTokens(m.avgDailyTokens)}</span>
                                </span>
                              ) : "─"}
                            </GradeCell>
                            <td data-testid={`team-eff-overall-${m.userId}`} className="py-2.5 pl-3 text-right">
                              <span className="inline-flex items-center gap-1.5 justify-end">
                                <GradePill grade={grade} />
                                {score !== null && (
                                  <span className="text-[11px] font-mono text-neutral-400 tabular-nums w-7 text-right">{score}</span>
                                )}
                              </span>
                            </td>
                          </tr>
                        );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

            {/* Row 4: Team Activities + By Model — 분포 분석 묶음. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Team Activities */}
              <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-pink-500 rounded">
                <div className="px-3 py-2 border-b border-neutral-800">
                  <span className="text-xs font-mono font-bold text-pink-400 uppercase tracking-wider">Team Activities</span>
                </div>
                <div className="p-3">
                  {(data.teamActivities ?? []).length === 0 ? (
                    <p className="text-neutral-600 text-xs font-mono">no data</p>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex text-[10px] text-neutral-600 font-mono mb-1">
                        <span className="w-16 shrink-0" />
                        <span className="flex-1">activity</span>
                        <span className="w-14 text-right">turns</span>
                        <span className="w-10 text-right">m</span>
                      </div>
                      {(data.teamActivities ?? []).map((a) => (
                        <div key={a.name} className="flex items-center gap-1.5 text-xs font-mono">
                          <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                            <div className="h-full bg-pink-500 rounded" style={{ width: `${(a.totalTurns / maxActivity) * 100}%` }} />
                          </div>
                          <span className="flex-1 text-neutral-300 truncate">{a.name}</span>
                          <span className="w-14 text-neutral-400 text-right">{a.totalTurns.toLocaleString()}</span>
                          <span className="w-10 text-neutral-600 text-right">{a.memberCount}명</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* By Model */}
              <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-pink-500 rounded">
                <div className="px-3 py-2 border-b border-neutral-800">
                  <span className="text-xs font-mono font-bold text-pink-400 uppercase tracking-wider">By Model</span>
                </div>
                <div className="p-3">
                  {(data.teamModels ?? []).length === 0 ? (
                    <p className="text-neutral-600 text-xs font-mono">no data</p>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex text-[10px] text-neutral-600 font-mono mb-1">
                        <span className="w-16 shrink-0" />
                        <span className="flex-1">model</span>
                        <span className="w-16 text-right">cost</span>
                        <span className="w-14 text-right">cache</span>
                        <span className="w-14 text-right">calls</span>
                      </div>
                      {(() => {
                        const maxCost = Math.max(...(data.teamModels ?? []).map((m) => m.cost), 0.01);
                        return (data.teamModels ?? []).map((m) => (
                          <div key={m.name} className="flex items-center gap-1.5 text-xs font-mono">
                            <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                              <div className="h-full bg-pink-500 rounded" style={{ width: `${(m.cost / maxCost) * 100}%` }} />
                            </div>
                            <span className="flex-1 text-neutral-300 truncate">{m.name}</span>
                            <span className="w-16 text-yellow-400 text-right tabular-nums">${m.cost.toFixed(2)}</span>
                            <span className="w-14 text-emerald-400 text-right tabular-nums">{m.cacheHitPct.toFixed(1)}%</span>
                            <span className="w-14 text-neutral-500 text-right tabular-nums">{m.calls.toLocaleString()}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Row 5: Core Tools + Shell Commands */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Core Tools */}
              <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-teal-500 rounded">
                <div className="px-3 py-2 border-b border-neutral-800">
                  <span className="text-xs font-mono font-bold text-teal-400 uppercase tracking-wider">Core Tools</span>
                </div>
                <div className="p-3">
                  {(data.teamTools ?? []).length === 0 ? (
                    <p className="text-neutral-600 text-xs font-mono">no data</p>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex text-[10px] text-neutral-600 font-mono mb-1">
                        <span className="w-16 shrink-0" />
                        <span className="flex-1">tool</span>
                        <span className="w-16 text-right">calls</span>
                      </div>
                      {(() => {
                        const maxCalls = Math.max(...(data.teamTools ?? []).map((t) => t.calls), 1);
                        return (data.teamTools ?? []).map((t) => (
                          <div key={t.name} className="flex items-center gap-1.5 text-xs font-mono">
                            <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                              <div className="h-full bg-teal-500 rounded" style={{ width: `${(t.calls / maxCalls) * 100}%` }} />
                            </div>
                            <span className="flex-1 text-neutral-300 truncate">{t.name}</span>
                            <span className="w-16 text-blue-400 text-right tabular-nums">{t.calls.toLocaleString()}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Shell Commands */}
              <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-orange-500 rounded">
                <div className="px-3 py-2 border-b border-neutral-800">
                  <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-wider">Shell Commands</span>
                </div>
                <div className="p-3">
                  {(data.teamShellCommands ?? []).length === 0 ? (
                    <p className="text-neutral-600 text-xs font-mono">no data</p>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex text-[10px] text-neutral-600 font-mono mb-1">
                        <span className="w-16 shrink-0" />
                        <span className="flex-1">command</span>
                        <span className="w-16 text-right">calls</span>
                      </div>
                      {(() => {
                        const maxCalls = Math.max(...(data.teamShellCommands ?? []).map((s) => s.calls), 1);
                        return (data.teamShellCommands ?? []).map((s) => (
                          <div key={s.name} className="flex items-center gap-1.5 text-xs font-mono">
                            <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                              <div className="h-full bg-orange-500 rounded" style={{ width: `${(s.calls / maxCalls) * 100}%` }} />
                            </div>
                            <span className="flex-1 text-neutral-300 truncate">{s.name}</span>
                            <span className="w-16 text-blue-400 text-right tabular-nums">{s.calls.toLocaleString()}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Team Plan Health (admin only) — full width, 매니저 의사결정용 */}
            {adminUser && data.teamPlanHealth && (
              <TeamPlanHealthCard summary={data.teamPlanHealth} />
            )}

            {/* Row 6: Last Sync + Top Sessions (admin only) */}
            {adminUser && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div data-testid="team-card-engagement" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-slate-500 rounded">
                  <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Engagement</span>
                    <AdminBadge />
                  </div>
                  <div className="p-3">
                    <table className="w-full text-xs font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-800">
                          <th className="text-left text-neutral-500 pb-2 font-normal">멤버</th>
                          <th className="text-right text-neutral-500 pb-2 px-3 font-normal">마지막 수신</th>
                          <th className="text-right text-neutral-500 pb-2 px-3 font-normal" title="이번달 (UTC) 본 횟수">방문/달</th>
                          <th className="text-right text-neutral-500 pb-2 px-3 font-normal" title="이번달 평균 체류">평균체류</th>
                          <th className="w-12 text-right text-neutral-500 pb-2 pl-3 font-normal" />
                        </tr>
                      </thead>
                      <tbody>
                        {[...members]
                          .sort((a, b) => {
                            if (!a.lastSyncedAt && !b.lastSyncedAt) return 0;
                            if (!a.lastSyncedAt) return -1;
                            if (!b.lastSyncedAt) return 1;
                            return new Date(a.lastSyncedAt).getTime() - new Date(b.lastSyncedAt).getTime();
                          })
                          .map((m) => {
                            const { timeClass, badge } = syncStyle(m.lastSyncedAt);
                            const dwellMin = Math.floor(m.avgDwellSec / 60);
                            const dwellSec = m.avgDwellSec % 60;
                            const dwellLabel = m.monthVisits > 0
                              ? `${dwellMin}:${String(dwellSec).padStart(2, "0")}`
                              : "—";
                            const visitsClass = m.monthVisits === 0
                              ? "text-red-400"
                              : m.monthVisits < 4
                                ? "text-yellow-500"
                                : "text-neutral-300";
                            return (
                              <tr key={m.userId} data-testid={`team-eng-row-${m.userId}`} className="border-b border-neutral-800/40 hover:bg-neutral-800/20 transition-colors">
                                <td className="py-2 text-neutral-300">{m.name}</td>
                                <td className={`py-2 px-3 text-right tabular-nums ${timeClass}`}>
                                  {m.lastSyncedAt ? fmtSyncTime(m.lastSyncedAt) : "—"}
                                </td>
                                <td data-testid={`team-eng-visits-${m.userId}`} className={`py-2 px-3 text-right tabular-nums ${visitsClass}`}>
                                  {m.monthVisits}
                                </td>
                                <td className="py-2 px-3 text-right tabular-nums text-neutral-400">
                                  {dwellLabel}
                                </td>
                                <td className="py-2 pl-3 text-right">{badge}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Top Sessions (admin only) */}
                <div data-testid="team-card-top-sessions" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-red-500 rounded">
                  <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider">Top Sessions</span>
                    <AdminBadge />
                  </div>
                  <div className="p-3 overflow-x-auto">
                    {(data.topSessions ?? []).length === 0 ? (
                      <p className="text-neutral-600 text-xs font-mono">no data</p>
                    ) : (
                      <table className="w-full text-xs font-mono border-collapse">
                        <thead>
                          <tr className="border-b border-neutral-800">
                            <th className="text-left text-neutral-500 pb-2 pr-3 font-normal">멤버</th>
                            <th className="text-left text-neutral-500 pb-2 pr-3 font-normal">프로젝트</th>
                            <th className="text-right text-neutral-500 pb-2 pr-3 font-normal">date</th>
                            <th className="text-right text-neutral-500 pb-2 pr-3 font-normal">calls</th>
                            <th className="text-right text-neutral-500 pb-2 font-normal">cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.topSessions ?? []).map((s, i) => (
                            <tr key={`${s.userId}-${s.id}-${i}`} className="border-b border-neutral-800/40 hover:bg-neutral-800/30 transition-colors">
                              <td className="py-1.5 pr-3">
                                <span className="flex items-center gap-1.5 text-neutral-300">
                                  <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ background: memberColorMap[s.userName] ?? "#6b7280" }}
                                  />
                                  <span className="truncate max-w-[64px]">{s.userName}</span>
                                </span>
                              </td>
                              <td className="py-1.5 pr-3">
                                <div
                                  className="truncate max-w-[96px] text-neutral-400"
                                  style={{ direction: "rtl" }}
                                  title={s.project || undefined}
                                >
                                  {s.project || "—"}
                                </div>
                              </td>
                              <td className="py-1.5 pr-3 text-right text-neutral-500 tabular-nums">
                                {fmtDate(s.date)}
                              </td>
                              <td className="py-1.5 pr-3 text-right text-neutral-500 tabular-nums">
                                {s.calls}
                              </td>
                              <td className="py-1.5 text-right text-yellow-400 tabular-nums font-bold">
                                ${s.cost.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* (Row 7 Industry Comparison 카드는 page top "team-card-headline"
                 으로 흡수·이동 — Q1/Q2/Q3 일괄 해결) */}
          </>
        )}
      </main>
    </div>
  );
}
