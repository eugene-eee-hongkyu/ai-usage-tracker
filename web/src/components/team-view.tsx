"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useLocalMode } from "@/lib/use-local-mode";
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
import { useMessages } from "@/lib/use-i18n";
import type { Messages } from "@/lib/i18n";

type Period = "today" | "8days" | "month" | "30days" | "all";
type GradeLevel = "exemplary" | "good" | "moderate" | "insufficient" | "warning";

function periodLabel(p: Period, m: Messages): string {
  switch (p) {
    case "today":  return m.common.today;
    case "8days":  return m.common.eightDays;
    case "month":  return m.common.thisMonth;
    case "30days": return m.common.thirtyDays;
    case "all":    return m.common.all;
  }
}

function gradeLabel(g: GradeLevel, m: Messages): string {
  switch (g) {
    case "exemplary":    return m.grades.exemplary;
    case "good":         return m.grades.good;
    case "moderate":     return m.grades.moderate;
    case "insufficient": return m.grades.insufficient;
    case "warning":      return m.grades.warning;
  }
}

function tmpl(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

const GRADE_STYLES: Record<GradeLevel, string> = {
  exemplary:    "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40",
  good:         "bg-green-500/15 text-green-400 border border-green-500/40",
  moderate:     "bg-yellow-500/15 text-yellow-400 border border-yellow-500/40",
  insufficient: "bg-orange-500/15 text-orange-400 border border-orange-500/40",
  warning:      "bg-red-500/15 text-red-400 border border-red-500/40",
};

const GRADE_VALUE_COLOR: Record<GradeLevel, string> = {
  exemplary:    "text-emerald-400",
  good:         "text-green-400",
  moderate:     "text-yellow-400",
  insufficient: "text-orange-400",
  warning:      "text-red-400",
};

const GRADE_CELL_BG: Record<GradeLevel, string> = {
  exemplary:    "bg-emerald-500/25",
  good:         "bg-green-500/20",
  moderate:     "bg-slate-600/25",
  insufficient: "bg-amber-500/25",
  warning:      "bg-red-500/30",
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
  dailyVisits30d?: {
    dates: string[];
    byUser: Record<string, { name: string; counts: number[] }>;
  };
}

function AdminBadge() {
  return (
    <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 leading-none">ADMIN</span>
  );
}

function SyncBadge({ lastSyncedAt, userId, m }: { lastSyncedAt: string | null; userId?: string | number; m: Messages }) {
  const tid = userId !== undefined ? `team-sync-badge-${userId}` : undefined;
  if (!lastSyncedAt) return <span data-testid={tid} className="text-[10px] text-red-400 font-mono">{m.teamView.noSync}</span>;
  const days = Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 86_400_000);
  if (days >= 5) return <span data-testid={tid} className="text-[10px] text-red-400 font-mono" title={m.teamView.loadFailed}>{tmpl(m.teamView.daysWarn, { n: days })}</span>;
  if (days >= 2) return <span data-testid={tid} className="text-[10px] text-yellow-500 font-mono">{tmpl(m.teamView.daysAgoN, { n: days })}</span>;
  return null;
}

function CcusageMissingBadge({ missing, userId }: { missing: boolean | undefined; userId?: string | number }) {
  if (!missing) return null;
  const tid = userId !== undefined ? `team-ccusage-badge-${userId}` : undefined;
  return (
    <span
      data-testid={tid}
      className="text-[10px] text-orange-400 font-mono px-1 py-0.5 rounded bg-orange-500/10 border border-orange-500/40 leading-none"
      title="ccusage not installed — token/cost data not collected. Run npm install -g ccusage then repair."
    >
      ccusage❌
    </span>
  );
}

function GradePill({ grade, m }: { grade: GradeLevel; m: Messages }) {
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono ${GRADE_STYLES[grade]}`}>
      {gradeLabel(grade, m)}
    </span>
  );
}

function cacheHitGrade(v: number): GradeLevel {
  if (v >= 96) return "exemplary"; if (v >= 90) return "good"; if (v >= 80) return "moderate"; if (v >= 60) return "insufficient"; return "warning";
}
function oneShotGrade(v: number): GradeLevel {
  if (v >= 80) return "exemplary"; if (v >= 40) return "moderate"; return "warning";
}
function costGrade(v: number): GradeLevel {
  if (v < 25) return "exemplary"; if (v < 100) return "moderate"; return "warning";
}
// 사용량 (token volume) → 5-level GradeLevel.
function tokenLevelGrade(level: number): GradeLevel {
  if (level >= 8) return "exemplary";
  if (level >= 6) return "good";
  if (level >= 3) return "moderate";
  if (level >= 1) return "insufficient";
  return "warning";
}

// 종합 점수 — 개인 EFFICIENCY 와 동일 공식.
function computeMemberScore(m: MemberStat): number | null {
  if (m.sessionsCount === 0) return null;
  const cpc = m.callsCount > 0 ? m.totalCost / m.callsCount : 0;
  return computeDailyEfficiencyScore(m.cacheHitPct, cpc, m.overallOneShot * 100, m.avgDailyTokens);
}
function scoreToGrade(score: number | null): GradeLevel {
  if (score === null) return "warning";
  if (score >= 90) return "exemplary";
  if (score >= 75) return "good";
  if (score >= 55) return "moderate";
  if (score >= 35) return "insufficient";
  return "warning";
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

function syncStyle(lastSyncedAt: string | null, m: Messages): { timeClass: string; badge: React.ReactNode } {
  if (!lastSyncedAt) return { timeClass: "text-red-400", badge: <span className="text-[10px] text-red-400">{m.teamView.noSync}</span> };
  const days = Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 86_400_000);
  if (days >= 5) return { timeClass: "text-red-400", badge: <span className="text-[10px] text-red-400">{tmpl(m.teamView.daysWarn, { n: days })}</span> };
  if (days >= 2) return { timeClass: "text-yellow-500", badge: <span className="text-[10px] text-yellow-500">{tmpl(m.teamView.daysAgoN, { n: days })}</span> };
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
  const { m: t } = useMessages();
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
  const isLocalMode = useLocalMode();

  // 자세히 보기 토글 — efficiency · Row 4 (Team Activities + By Model) ·
  // Row 5 (Core Tools + Shell) 묶음. dashboard-view 와 동일 패턴.
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDetailsOpen(localStorage.getItem("team_details_open") === "1");
  }, []);
  const toggleDetails = () => {
    setDetailsOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem("team_details_open", next ? "1" : "0"); } catch {}
      return next;
    });
  };
  // 기본 팀정보 토글 (admin only) — TeamUsageHero · Row 1·2·2.5 · headline 묶음.
  // 멤버도 볼 수 있는 정보라 admin 한테는 default 닫혀있고, 누르면 펼침.
  // 비-admin 은 토글 없이 항상 펼쳐진 상태.
  const [basicInfoOpen, setBasicInfoOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setBasicInfoOpen(localStorage.getItem("team_basic_info_open") === "1");
  }, []);
  const toggleBasicInfo = () => {
    setBasicInfoOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem("team_basic_info_open", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (isLocalMode === null) return;
    if (isLocalMode) return;
    if (status === "unauthenticated") router.push("/login");
  }, [status, router, isLocalMode]);

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
        <p className="text-neutral-400 font-mono text-sm">{t.teamView.loadFailed}</p>
        <button
          data-testid="team-retry"
          onClick={() => setReloadKey((k) => k + 1)}
          className="px-4 py-1.5 bg-neutral-800 rounded text-sm text-neutral-200 hover:bg-neutral-700 font-mono"
        >{t.teamView.retry}</button>
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-neutral-950">
      <NavComponent />
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-neutral-500 text-sm font-mono">{t.teamView.loading}</div>
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
    { exemplary: 0, good: 0, moderate: 0, insufficient: 0, warning: 0 }
  );
  const gradeSummary = (["exemplary", "good", "moderate", "insufficient", "warning"] as GradeLevel[])
    .filter((g) => gradeCounts[g] > 0)
    .map((g) => tmpl(t.teamView.gradeBadge, { g: gradeLabel(g, t), n: gradeCounts[g] }))
    .join(" · ");

  // Stacked per-member
  const byMemberBlock = (
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
  );

  // Total aggregated
  const totalBlock = (
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
              formatter={(v) => [`$${Number(v).toFixed(2)}`, t.teamView.teamSum]}
            />
            <Area type="monotone" dataKey="cost" stroke="#06b6d4" strokeWidth={2} fill="url(#grad-total)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // Activity (tokens)
  const activityBlock = (
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
  );

  // Cost
  const costBlock = (
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
  );

  // 활용지수 순위 — period 분모가 멤버 동일 → 직접 비교 정확
  const powerRankBlock = (
    <div data-testid="team-card-power-rank" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-cyan-500 rounded">
      <div className="px-3 py-2 border-b border-neutral-800">
        <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">{t.teamView.powerRankCard}</span>
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
  );

  // 일별 토큰 단가 (멤버별) — 멤버별 plan 가치 / 일별 토큰 × 1M
  const dailyUnitCostBlock = (
    <div data-testid="team-card-daily-unit-cost" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-yellow-500 rounded">
      <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between flex-wrap gap-y-1">
        <span className="text-xs font-mono font-bold text-yellow-400 uppercase tracking-wider">
          {t.teamView.unitCostCardLabel}
          <span className="ml-1.5 text-neutral-500 normal-case font-normal">(log)</span>
        </span>
        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-end">
          {(data.memberUsage ?? []).filter((m) => m.monthlyPriceUsd).map((m) => {
            const idx = (data.memberNames ?? []).indexOf(m.memberKey);
            const color = MEMBER_COLORS[(idx >= 0 ? idx : 0) % MEMBER_COLORS.length];
            return (
              <span key={m.userId} className="flex items-center gap-1 text-[10px] font-mono text-neutral-400">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                {m.name}{m.isEstimated && <span className="text-amber-400">{t.teamView.estimateBadge}</span>}
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
                // 자리수 통일 — $0.01 / $0.10 / $1.00 / $10.00 / $100.00 일관 정렬
                return n >= 0.01 ? `$${n.toFixed(2)}` : `$${n.toFixed(3)}`;
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
          {t.teamView.unitCostFootnote}
        </p>
      </div>
    </div>
  );

  // Team Headline — 효율 점수 + 업계 비교. page top 에서 Efficiency
  // 직전으로 이동 — TeamUsageHero (활용지수/단가) 가 page top 차지.
  const headlineBlock = data.teamScore && data.industryComparison && data.industryComparison.activeDayCount > 0 ? (() => {
    const ts = data.teamScore;
    const ic = data.industryComparison;
    const fmt = (n: number) => `$${n < 10 ? n.toFixed(2) : Math.round(n)}`;
    const enterpriseAvg = 13;
    const multiplier = ic.activeDayAvg / enterpriseAvg;
    const bulletMax = Math.max(102, ic.activeDayAvg * 1.2);
    const bulletRows: Array<{ label: string; value: number; star?: boolean; benchmark?: boolean }> = [
      { label: t.teamView.industryUser, value: 6 },
      { label: t.teamView.industryUserTop10, value: 12 },
      { label: t.teamView.industryEnterpriseAvg, value: 13, benchmark: true },
      { label: t.teamView.industryEnterpriseTop10, value: 30 },
      { label: t.teamView.industryTop1, value: 92 },
      { label: t.teamView.teamLabel, value: ic.activeDayAvg, star: true },
    ];
    return (
      <div data-testid="team-card-headline" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-emerald-500 rounded">
        <div className="px-3 py-2 border-b border-neutral-800">
          <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
            {t.teamView.headlineTitle}
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
              }`}>{scoreLabel(ts.score, t)}</span>
              <span className="text-neutral-500">{tmpl(t.teamView.teamAvgN, { n: data.byEfficiency.length })}</span>
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
              {tmpl(t.teamView.vsEnterpriseAvg, { n: enterpriseAvg })}
            </span>
            <span className="text-[10px] font-mono text-emerald-300 mt-0.5">
              {t.teamView.activeUsageDescription}
            </span>
          </div>
          <div data-testid="team-headline-bullet" className="col-span-12 sm:col-span-6">
            <div className="text-[10px] font-mono text-neutral-500 mb-1.5 uppercase tracking-wider">
              {t.teamView.perActiveDayCompare}
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
              {t.teamView.sourceFootnote}
            </p>
          </div>
        </div>
      </div>
    );
  })() : null;

  // Team Plan Savings — 모든 멤버 API 환산 비용 합 vs 모든 멤버 plan 가격 합.
  // 개인 dashboard 의 planSavingsBlock 팀 합산 버전. admin only.
  // data.teamSummary.totalCost = ccusage 합산 (API 환산), data.teamUsage.priceForPeriodSum
  // = tier 선언/추정된 멤버들의 monthlyPrice × periodDays/30 합.
  const teamPlanSavingsBlock = adminUser && data.teamUsage ? (() => {
    const apiCost = data.teamSummary.totalCost;
    const planCost = data.teamUsage.priceForPeriodSum;
    if (planCost == null || planCost <= 0 || apiCost <= 0) return null;
    const saved = apiCost - planCost;
    const savedPct = apiCost > 0 ? Math.round((saved / apiCost) * 100) : null;
    const positive = saved > 0;
    const fmt = (v: number) =>
      v >= 100 ? `$${v.toFixed(0)}` : v >= 1 ? `$${v.toFixed(1)}` : `$${v.toFixed(2)}`;
    const memberCount = data.teamSummary.activeMemberCount;
    return (
      <div data-testid="team-card-plan-savings" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-amber-500 rounded">
        <div className="px-3 py-2 border-b border-neutral-800">
          <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
            {t.dashboard.cards.planSavings} · {tmpl(t.teamView.teamAvgN, { n: memberCount })}
          </span>
        </div>
        <div className="p-3">
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <div className="flex-1">
                <p className="text-[12px] font-mono text-neutral-500 uppercase tracking-wider">
                  {t.dashboard.cards.planSavingsApiLabel}
                </p>
                <p className="text-2xl font-mono font-bold text-amber-300">{fmt(apiCost)}</p>
              </div>
              <span className="text-neutral-600 text-xl font-mono">→</span>
              <div className="flex-1">
                <p className="text-[12px] font-mono text-neutral-500 uppercase tracking-wider">
                  {t.dashboard.cards.planSavingsPlanLabel}
                </p>
                <p className="text-2xl font-mono font-bold text-neutral-200">{fmt(planCost)}</p>
              </div>
              <span className="text-neutral-600 text-xl font-mono">→</span>
              <div className="flex-1 text-right">
                <p className="text-[12px] font-mono text-neutral-500 uppercase tracking-wider">
                  {t.dashboard.cards.planSavingsSavedLabel}
                </p>
                {savedPct !== null && positive && (
                  <>
                    <p className="text-2xl font-mono font-bold text-emerald-400">▼ {savedPct}%</p>
                    <p className="text-[10px] font-mono text-neutral-500 mt-0.5">({fmt(saved)})</p>
                  </>
                )}
                {savedPct !== null && !positive && (
                  <>
                    <p className="text-2xl font-mono font-bold text-rose-400">▲ {Math.abs(savedPct)}%</p>
                    <p className="text-[10px] font-mono text-neutral-500 mt-0.5">({fmt(Math.abs(saved))})</p>
                  </>
                )}
                {savedPct === null && (
                  <p className="text-2xl font-mono text-neutral-600">—</p>
                )}
              </div>
            </div>
            <p className="text-[12px] font-mono text-neutral-600 pt-1">
              {t.dashboard.cards.planSavingsHint}
            </p>
          </div>
        </div>
      </div>
    );
  })() : null;

  // Row 3: Efficiency (full-width) — 컬럼 6개 가독성 위해 1줄 차지.
  const efficiencyBlock = (
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
              <th className="text-left text-neutral-500 pb-2 pr-4 font-normal w-[24%]">{t.teamView.columnMember}</th>
              <th className="text-right text-neutral-500 pb-2 px-3 font-normal w-[15%]">cache</th>
              <th className="text-right text-neutral-500 pb-2 px-3 font-normal w-[15%]">1-shot</th>
              <th className="text-right text-neutral-500 pb-2 px-3 font-normal w-[15%]">$/sess</th>
              <th className="text-right text-neutral-500 pb-2 px-3 font-normal w-[15%]" title={t.teamView.tooltipUsageAvgMy.split(":")[0]}>{t.teamView.columnUsage}</th>
              <th className="text-right text-neutral-500 pb-2 pl-3 font-normal w-[16%]">{t.teamView.columnOverall}</th>
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
              const cacheTooltip = tmpl(t.teamView.tooltipTeamAvgMyValue, { avg: `${avgCache.toFixed(1)}%`, mine: `${m.cacheHitPct.toFixed(1)}%`, delta: `${cacheDelta >= 0 ? "+" : ""}${cacheDelta.toFixed(1)}%p` });
              const oneShotPct = m.overallOneShot * 100;
              const oneShotDelta = oneShotPct - avgOneShot * 100;
              const oneShotTooltip = tmpl(t.teamView.tooltipTeamAvgMyValue, { avg: `${(avgOneShot * 100).toFixed(0)}%`, mine: `${Math.round(oneShotPct)}%`, delta: `${oneShotDelta >= 0 ? "+" : ""}${oneShotDelta.toFixed(0)}%p` });
              const costDelta = costPerSession - avgCostPS;
              const costTooltip = tmpl(t.teamView.tooltipTeamAvgMyValue, { avg: `$${avgCostPS.toFixed(2)}`, mine: `$${costPerSession.toFixed(2)}`, delta: `${costDelta >= 0 ? "+" : ""}$${costDelta.toFixed(2)}` });
              const myTokenLvl = computeTokenLevel(m.avgDailyTokens);
              const tokenTooltip = m.avgDailyTokens > 0
                ? tmpl(t.teamView.tooltipUsageAvgMy, { avgLvl: avgTokenLvl, avgTok: fmtTokens(avgTokensTeam), myLvl: myTokenLvl, myTok: fmtTokens(m.avgDailyTokens) })
                : t.grades.noActivity;
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
                      {isSelf && <span className="text-[10px] font-mono text-emerald-400/80">{t.teamView.selfMark}</span>}
                      <SyncBadge lastSyncedAt={m.lastSyncedAt} userId={m.userId} m={t} />
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
                      <GradePill grade={grade} m={t} />
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
  );

  // Team Activities
  const teamActivitiesBlock = (
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
                <span className="w-10 text-neutral-600 text-right">{tmpl(t.teamView.activitiesMembersCount, { n: a.memberCount })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // By Model
  const byModelBlock = (
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
  );

  // Core Tools
  const coreToolsBlock = (
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
  );

  // Shell Commands
  const shellCommandsBlock = (
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
  );

  // Engagement (admin only)
  // engagementBlock 삭제 — dailyVisitsBlock 에 통합됨 (멤버 행 + engagement
  // 컬럼 + 30일 visit 셀).

  // Top Sessions (admin only)
  const topSessionsBlock = (
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
                <th className="text-left text-neutral-500 pb-2 pr-3 font-normal">{t.teamView.planMember}</th>
                <th className="text-left text-neutral-500 pb-2 pr-3 font-normal">{t.teamView.columnProject}</th>
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
  );

  // Row 6.5: 일별 방문 매트릭스 (full-width, admin only) — ENGAGEMENT +
  // TOP SESSIONS 행 아래. 멤버 × 30일 방문 횟수 그리드 + 하단 날짜 라벨.
  // 모든 셀 너비 균일 (w-6) · 월 시작 셀 (DD=01) 에 좌측 border 로 시각 구분.
  // Engagement + 일별 방문 통합 — 멤버별 1행. 기존 engagement 카드의 컬럼
  // (last sync · visits/mo · avg dwell · badge) + 30일 visit 셀을 한 표로.
  // 정렬: lastSyncedAt asc (오래 sync 안 한 멤버 우선 — admin actionable).
  const dailyVisitsBlock = adminUser && data.dailyVisits30d ? (() => {
    const grid = data.dailyVisits30d;
    const fmtDay = (ymd: string) => ymd.slice(8);    // "DD"
    const isMonthStart = (ymd: string) => ymd.endsWith("-01");
    const monthOf = (ymd: string) => ymd.slice(5, 7); // "MM"
    const sortedMembers = [...members].sort((a, b) => {
      if (!a.lastSyncedAt && !b.lastSyncedAt) return 0;
      if (!a.lastSyncedAt) return -1;
      if (!b.lastSyncedAt) return 1;
      return new Date(a.lastSyncedAt).getTime() - new Date(b.lastSyncedAt).getTime();
    });
    const ENG_COLS = 5; // member · last sync · visits · dwell · badge
    return (
      <div data-testid="team-card-daily-visits" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-slate-500 rounded">
        <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">{t.teamView.monthlyVisitsTitle}</span>
          <AdminBadge />
        </div>
        <div className="p-3 overflow-x-auto">
          <table className="text-[11px] font-mono border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "10rem" }} />     {/* member name */}
              <col style={{ width: "5rem" }} />      {/* last sync */}
              <col style={{ width: "4rem" }} />      {/* visits/mo */}
              <col style={{ width: "4rem" }} />      {/* avg dwell */}
              <col style={{ width: "3rem" }} />      {/* sync badge */}
              {grid.dates.map((_, i) => (
                <col key={i} style={{ width: "1.5rem" }} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left text-neutral-500 pb-2 font-normal">{t.teamView.planMember}</th>
                <th className="text-right text-neutral-500 pb-2 px-2 font-normal whitespace-nowrap">{t.teamView.planLastReceived}</th>
                <th className="text-right text-neutral-500 pb-2 px-2 font-normal whitespace-nowrap" title={t.teamView.planVisitsMonth}>{t.teamView.planVisitsMonth}</th>
                <th className="text-right text-neutral-500 pb-2 px-2 font-normal whitespace-nowrap" title={t.teamView.planAvgDwell}>{t.teamView.planAvgDwell}</th>
                <th />
                {grid.dates.map((d, i) => {
                  const showLabel = i % 5 === 0 || isMonthStart(d) || i === grid.dates.length - 1;
                  return (
                    <th
                      key={i}
                      className={`text-center py-1 text-[10px] tabular-nums font-normal ${
                        isMonthStart(d) ? "border-l border-l-neutral-700 text-amber-400" : "text-neutral-600"
                      }`}
                    >
                      {showLabel ? fmtDay(d) : ""}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map((m) => {
                const { timeClass, badge } = syncStyle(m.lastSyncedAt, t);
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
                const dailyRow = grid.byUser[String(m.userId)] ?? null;
                return (
                  <tr key={m.userId} data-testid={`team-eng-row-${m.userId}`} className="border-b border-neutral-800/40 hover:bg-neutral-800/30 transition-colors">
                    <td className="py-1.5 text-neutral-300 whitespace-nowrap overflow-hidden text-ellipsis">{m.name}</td>
                    <td className={`py-1.5 px-2 text-right tabular-nums whitespace-nowrap ${timeClass}`}>
                      {m.lastSyncedAt ? fmtSyncTime(m.lastSyncedAt) : "—"}
                    </td>
                    <td data-testid={`team-eng-visits-${m.userId}`} className={`py-1.5 px-2 text-right tabular-nums whitespace-nowrap ${visitsClass}`}>
                      {m.monthVisits}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-neutral-400 whitespace-nowrap">{dwellLabel}</td>
                    <td className="py-1.5 text-right">{badge}</td>
                    {grid.dates.map((d, i) => {
                      const c = dailyRow?.counts[i] ?? 0;
                      return (
                        <td
                          key={i}
                          className={`text-center py-1 tabular-nums ${
                            isMonthStart(d) ? "border-l border-l-neutral-700" : ""
                          } ${
                            c === 0 ? "text-neutral-700" :
                            c >= 10 ? "text-cyan-400 font-bold" :
                            "text-neutral-200"
                          }`}
                          title={tmpl(t.teamView.visitsOfDay, { date: d, n: c })}
                        >
                          {c === 0 ? "·" : c}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {/* 월 표시 행 — 월 시작 셀에 "M월" 표시. */}
              <tr>
                <td className="pr-3 py-0.5 text-[10px] text-neutral-500 text-right" colSpan={ENG_COLS}>{t.teamView.monthRow}</td>
                {grid.dates.map((d, i) => {
                  const isStart = isMonthStart(d);
                  const isFirst = i === 0;  // 윈도우 첫 셀 (월 중간 시작)
                  return (
                    <td key={i} className={`text-center py-0.5 text-[10px] tabular-nums ${
                      isStart ? "text-amber-400 font-bold" :
                      isFirst ? "text-neutral-500" : "text-neutral-700"
                    }`}>
                      {isStart || isFirst ? tmpl(t.teamView.monthLabel, { n: parseInt(monthOf(d), 10) }) : ""}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  })() : null;

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
            >{periodLabel(p as Period, t)}</button>
          ))}
        </div>
      </div>

      {/* Team Summary Bar 는 기본 토글 안 첫 child 로 이동 — 사용자 피드백:
          토큰·비용·세션 등 합산도 admin 한테는 기본 정보 함께 접혀 있어야 함. */}

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
                <span className="text-emerald-300 font-bold">{t.teamView.axHeadline}</span>
                <span className="text-neutral-400">·</span>
                <span className="text-neutral-200">
                  {tmpl(t.teamView.teamMultiplier, { x: multiplier.toFixed(1) })}
                </span>
                <span className="text-neutral-400">·</span>
                <span className="text-neutral-200">
                  {tmpl(t.teamView.activeMembers, { n: memberActiveCount, total: memberTotal })}
                </span>
                {data.teamPlanHealth && data.teamPlanHealth.monthlySavingsUsd > 0 && (
                  <>
                    <span className="text-neutral-400">·</span>
                    <span className="text-neutral-200">
                      {tmpl(t.teamView.planSavings, { n: data.teamPlanHealth.monthlySavingsUsd })}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {teamPlanSavingsBlock}

        {members.length === 0 ? (
          <div data-testid="team-empty" className="bg-neutral-900 border border-neutral-800 rounded-lg p-8 text-center text-neutral-500 text-sm font-mono">
            {t.teamView.noActivityPeriod}
          </div>
        ) : (
          <>
            {/* 기본 팀정보 자세히 보기 토글 (admin only) — TeamUsageHero +
                Row 1·2·2.5 + headline 묶음. 멤버도 보는 정보라 admin 에게는
                default 닫힘. 비-admin 은 토글 없이 항상 펼쳐짐. */}
            {adminUser && (
              <div className="pt-2 pb-1">
                <div className="flex items-center gap-3">
                  <hr className="flex-1 border-t border-neutral-800" />
                  <button
                    type="button"
                    onClick={toggleBasicInfo}
                    data-testid="team-toggle-basic-info"
                    className="text-sm font-mono text-neutral-400 hover:text-neutral-200 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-600 rounded px-4 py-2 transition-colors shrink-0"
                  >
                    {basicInfoOpen ? t.teamView.collapseDetails : t.teamView.moreBasicDetails}
                  </button>
                  <hr className="flex-1 border-t border-neutral-800" />
                </div>
                {!basicInfoOpen && (
                  <p className="text-center text-xs font-mono text-neutral-600 mt-2">
                    {t.teamView.moreBasicDetailsHint}
                  </p>
                )}
              </div>
            )}

            {(!adminUser || basicInfoOpen) && (<>

            {/* Team Summary Bar — 합산 KPI (총토큰·총비용·세션·활성·cache·1-shot). */}
            <div data-testid="team-summary-bar" className="bg-neutral-900 border border-neutral-800 rounded px-4 py-2.5 flex flex-wrap gap-x-5 gap-y-1 text-sm font-mono">
              <span><span className="text-cyan-400 font-bold">{fmtTokens(members.reduce((s, m) => s + m.totalTokens, 0))}</span><span className="text-neutral-500 ml-1 text-xs">{t.teamView.summaryTotalTokens}</span></span>
              <span><span className="text-yellow-400 font-bold">${sum.totalCost.toFixed(2)}</span><span className="text-neutral-500 ml-1 text-xs">{t.teamView.summaryTotalCost}</span></span>
              <span><span className="text-blue-400 font-bold">{sum.totalSessions.toLocaleString()}</span><span className="text-neutral-500 ml-1 text-xs">{t.teamView.summarySessions}</span></span>
              <span><span className="text-cyan-400 font-bold">{sum.activeMemberCount}</span><span className="text-neutral-500 ml-1 text-xs">{t.teamView.summaryActiveMembers}</span></span>
              <span><span className="text-emerald-400 font-bold">{sum.avgCacheHitPct.toFixed(1)}%</span><span className="text-neutral-500 ml-1 text-xs">{t.teamView.summaryAvgCacheHit}</span></span>
              <span><span className="text-pink-400 font-bold">{Math.round(sum.avgOneShotRate * 100)}%</span><span className="text-neutral-500 ml-1 text-xs">{t.teamView.summaryAvgOneShot}</span></span>
            </div>

            {/* Team Usage Hero — 팀 활용지수 + 토큰단가 (개인 화면 대응). */}
            {data.teamUsage && (
              <TeamUsageHero
                powerIndex={data.teamUsage.powerIndex}
                activeMembers={data.teamUsage.activeMembers}
                avgActiveDays={data.teamUsage.avgActiveDays}
                avgDailyTokens={data.teamUsage.avgDailyTokens}
                periodDays={data.teamUsage.periodDays}
                periodLabel={periodLabel(period, t)}
                priceForPeriodSum={data.teamUsage.priceForPeriodSum}
                totalWindowTokensSum={data.teamUsage.totalWindowTokensSum}
              />
            )}

            {/* Row 1: Daily Cost Trend — stacked (per-member) + total */}
            {(data.dailyByMember ?? []).length > 1 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Stacked per-member */}
                {byMemberBlock}

                {/* Total aggregated */}
                {totalBlock}

              </div>
            )}

            {/* Row 2: Activity (tokens) + Cost */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Activity (tokens) */}
              {activityBlock}

              {/* Cost */}
              {costBlock}
            </div>

            {/* Row 2.5: 활용지수 순위 + 일별 토큰 단가 (멤버별) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* 활용지수 순위 — period 분모가 멤버 동일 → 직접 비교 정확 */}
              {powerRankBlock}

              {/* 일별 토큰 단가 (멤버별) — 멤버별 plan 가치 / 일별 토큰 × 1M */}
              {dailyUnitCostBlock}

            </div>

            {headlineBlock}

            </>)}  {/* basicInfoOpen 토글 닫기 — TeamUsageHero · Row 1·2·2.5 · headline */}

            {/* 세부 팀정보 자세히 보기 토글 — efficiency + Row 4 + Row 5 묶음.
                admin 에게는 위 기본 토글과 구분되도록 '세부' 라벨 사용. */}
            <div className="pt-4 pb-1">
              <div className="flex items-center gap-3">
                <hr className="flex-1 border-t border-neutral-800" />
                <button
                  type="button"
                  onClick={toggleDetails}
                  data-testid="team-toggle-details"
                  className="text-sm font-mono text-neutral-400 hover:text-neutral-200 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-600 rounded px-4 py-2 transition-colors shrink-0"
                >
                  {detailsOpen
                    ? t.teamView.collapseDetails
                    : (adminUser ? t.teamView.moreDetailedDetailsAdmin : t.teamView.moreDetails)}
                </button>
                <hr className="flex-1 border-t border-neutral-800" />
              </div>
              {!detailsOpen && (
                <p className="text-center text-xs font-mono text-neutral-600 mt-2">
                  {t.teamView.moreDetailsHint}
                </p>
              )}
            </div>

            {detailsOpen && (<>

            {/* Row 3: Efficiency (full-width) — 컬럼 6개 가독성 위해 1줄 차지. */}
            {efficiencyBlock}

            {/* Row 4: Team Activities + By Model — 분포 분석 묶음. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Team Activities */}
              {teamActivitiesBlock}

              {/* By Model */}
              {byModelBlock}
            </div>

            {/* Row 5: Core Tools + Shell Commands */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Core Tools */}
              {coreToolsBlock}

              {/* Shell Commands */}
              {shellCommandsBlock}
            </div>

            {/* Row 5.5: Top Sessions (admin only) — half-width + 빈 칸.
                dashboard Active Blocks 와 동일 단독 row 패턴. */}
            {adminUser && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {topSessionsBlock}
                <div />
              </div>
            )}

            </>)}  {/* detailsOpen 토글 닫기 — efficiency · Row 4 · Row 5 · Top Sessions */}

            {/* Team Plan Health (admin only) — full width, 매니저 의사결정용 */}
            {adminUser && data.teamPlanHealth && (
              <TeamPlanHealthCard summary={data.teamPlanHealth} />
            )}

            {dailyVisitsBlock}

            {/* (Row 7 Industry Comparison 카드는 page top "team-card-headline"
                 으로 흡수·이동 — Q1/Q2/Q3 일괄 해결) */}
          </>
        )}
      </main>
    </div>
  );
}
