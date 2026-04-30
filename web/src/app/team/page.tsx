"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/nav";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

type Period = "today" | "week" | "month" | "all";
type GradeLevel = "탁월" | "양호" | "보통" | "부족" | "경고";

const PERIOD_LABELS: Record<Period, string> = {
  today: "오늘", week: "이번주", month: "이번달", all: "전체",
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
}

function AdminBadge() {
  return (
    <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 leading-none">ADMIN</span>
  );
}

function SyncBadge({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  if (!lastSyncedAt) return <span className="text-[10px] text-red-400 font-mono">미수신</span>;
  const days = Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 86_400_000);
  if (days >= 5) return <span className="text-[10px] text-red-400 font-mono" title="데이터 수신 없음">⚠{days}일</span>;
  if (days >= 2) return <span className="text-[10px] text-yellow-500 font-mono">{days}일전</span>;
  return null;
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
  if (v >= 90) return "탁월"; if (v >= 80) return "양호"; if (v >= 70) return "보통"; if (v >= 60) return "부족"; return "경고";
}
function costGrade(v: number): GradeLevel {
  if (v < 10) return "탁월"; if (v < 25) return "양호"; if (v < 50) return "보통"; if (v < 100) return "부족"; return "경고";
}
function outputInputGrade(v: number): GradeLevel {
  if (v >= 30) return "탁월"; if (v >= 15) return "양호"; if (v >= 8) return "보통"; if (v >= 3) return "부족"; return "경고";
}
function overallGrade(cacheHitPct: number, oneShotRate: number, costPerSession: number): GradeLevel {
  const cacheScore = cacheHitPct / 100;
  const oneShotScore = oneShotRate;
  const costScore = costPerSession <= 1 ? 1 : costPerSession <= 3 ? 0.8 : costPerSession <= 7 ? 0.6 : costPerSession <= 15 ? 0.4 : 0.2;
  const composite = cacheScore * 0.4 + oneShotScore * 0.4 + costScore * 0.2;
  if (composite >= 0.88) return "탁월"; if (composite >= 0.72) return "양호"; if (composite >= 0.52) return "보통"; if (composite >= 0.32) return "부족"; return "경고";
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

function GradeCell({ grade, children }: { grade: GradeLevel; children: React.ReactNode }) {
  return (
    <td title={grade} className={`py-2.5 px-3 text-right whitespace-nowrap tabular-nums ${GRADE_CELL_BG[grade]}`}>
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

export default function TeamPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("all");
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetch(`/api/team?period=${period}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [session, period]);

  if (!data) return (
    <div className="min-h-screen bg-neutral-950">
      <Nav />
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-neutral-500 text-sm font-mono">로딩 중...</div>
      </div>
    </div>
  );

  const adminUser = data.isAdminUser;
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
      const cps = m.sessionsCount > 0 ? m.totalCost / m.sessionsCount : 0;
      const g = overallGrade(m.cacheHitPct, m.overallOneShot, cps);
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
      <Nav />

      {/* Period Tabs */}
      <div className="border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 pt-3 pb-2 flex gap-1">
          {(["today", "week", "month", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`w-16 text-center py-1 rounded text-xs font-mono transition-colors ${period === p ? "bg-indigo-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"}`}
            >{PERIOD_LABELS[p]}</button>
          ))}
        </div>
      </div>

      {/* Team Summary Bar */}
      <div className="bg-neutral-900 border-b border-neutral-800">
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

        {members.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-8 text-center text-neutral-500 text-sm font-mono">
            해당 기간에 활동 데이터가 없어요.
          </div>
        ) : (
          <>
            {/* Row 1: Daily Cost Trend — stacked (per-member) + total */}
            {(data.dailyByMember ?? []).length > 1 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Stacked per-member */}
                <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-cyan-500 rounded">
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
                <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-cyan-500 rounded">
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
              <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-cyan-500 rounded">
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
                          <span className="flex-1 text-neutral-300 truncate">{m.name}</span>
                          <span className="w-16 text-cyan-300 text-right tabular-nums">{fmtTokens(m.totalTokens)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Cost */}
              <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-yellow-500 rounded">
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

            {/* Row 3: Efficiency + Team Activities */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Efficiency Table */}
              <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-fuchsia-500 rounded">
                <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-fuchsia-400 uppercase tracking-wider">Efficiency</span>
                  {gradeSummary && (
                    <span className="text-[10px] font-mono text-neutral-500 shrink-0">{gradeSummary}</span>
                  )}
                </div>
                <div className="p-3 overflow-x-auto">
                  <table className="w-full text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800">
                        <th className="text-left text-neutral-500 pb-2 pr-4 font-normal">멤버</th>
                        <th className="text-right text-neutral-500 pb-2 px-3 font-normal">cache</th>
                        <th className="text-right text-neutral-500 pb-2 px-3 font-normal">1-shot</th>
                        <th className="text-right text-neutral-500 pb-2 px-3 font-normal">$/sess</th>
                        <th className="text-right text-neutral-500 pb-2 px-3 font-normal">out/in</th>
                        <th className="text-right text-neutral-500 pb-2 pl-3 font-normal">종합</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m, i) => {
                        const costPerSession = m.sessionsCount > 0 ? m.totalCost / m.sessionsCount : 0;
                        const grade = overallGrade(m.cacheHitPct, m.overallOneShot, costPerSession);
                        return (
                          <tr key={m.userId} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                            <td className="py-2.5 pr-4">
                              <Link href={`/team/${m.userId}`} className="flex items-center gap-2 hover:text-neutral-200 text-neutral-300">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ background: MEMBER_COLORS[i % MEMBER_COLORS.length] }}
                                />
                                <span>{m.name}</span>
                                <SyncBadge lastSyncedAt={m.lastSyncedAt} />
                              </Link>
                            </td>
                            <GradeCell grade={cacheHitGrade(m.cacheHitPct)}>
                              {m.cacheHitPct.toFixed(1)}%
                            </GradeCell>
                            <GradeCell grade={oneShotGrade(m.overallOneShot * 100)}>
                              {Math.round(m.overallOneShot * 100)}%
                            </GradeCell>
                            <GradeCell grade={costGrade(costPerSession)}>
                              ${costPerSession.toFixed(2)}
                            </GradeCell>
                            <GradeCell grade={outputInputGrade(m.outputInputRatio)}>
                              {m.outputInputRatio.toFixed(1)}×
                            </GradeCell>
                            <td className="py-2.5 pl-3 text-right">
                              <GradePill grade={grade} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

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
            </div>

            {/* Row 4: Core Tools + Shell Commands */}
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

            {/* Row 5: By Model + (empty) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

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

              {/* placeholder right column to keep grid alignment */}
              <div />
            </div>

            {/* Row 6: Last Sync + Top Sessions (admin only) */}
            {adminUser && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-slate-500 rounded">
                  <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Last Sync</span>
                    <AdminBadge />
                  </div>
                  <div className="p-3">
                    <table className="w-full text-xs font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-800">
                          <th className="text-left text-neutral-500 pb-2 font-normal">멤버</th>
                          <th className="text-right text-neutral-500 pb-2 font-normal">마지막 수신</th>
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
                            return (
                              <tr key={m.userId} className="border-b border-neutral-800/40 hover:bg-neutral-800/20 transition-colors">
                                <td className="py-2 text-neutral-300">{m.name}</td>
                                <td className={`py-2 text-right tabular-nums ${timeClass}`}>
                                  {m.lastSyncedAt ? fmtSyncTime(m.lastSyncedAt) : "—"}
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
                <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-red-500 rounded">
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
          </>
        )}
      </main>
    </div>
  );
}
