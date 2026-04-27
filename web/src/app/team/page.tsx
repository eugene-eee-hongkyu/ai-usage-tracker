"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/nav";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid,
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

interface MemberStat {
  userId: number;
  name: string;
  avatarUrl: string | null;
  lastSyncedAt: string | null;
  totalCost: number;
  sessionsCount: number;
  cacheHitPct: number;
  overallOneShot: number;
  efficiencyScore: number;
  topProject: string;
  callsCount: number;
  outputInputRatio: number;
}

interface TeamData {
  byEfficiency: MemberStat[];
  bySessions: MemberStat[];
  teamSummary: {
    totalCost: number;
    totalSessions: number;
    activeMemberCount: number;
    avgCacheHitPct: number;
    avgOneShotRate: number;
  };
  daily: Array<{ date: string; cost: number }>;
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
function costPerCallGrade(v: number): GradeLevel {
  if (v < 0.04) return "탁월"; if (v < 0.06) return "양호"; if (v < 0.10) return "보통"; if (v < 0.20) return "부족"; return "경고";
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

function fmtDate(d: string): string {
  const m = d.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${parseInt(m[1])}/${parseInt(m[2])}` : d;
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
    <div className="min-h-screen">
      <Nav />
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-neutral-500 text-sm font-mono">로딩 중...</div>
      </div>
    </div>
  );

  const members = data.byEfficiency;
  const sum = data.teamSummary;
  const byCost = [...members].sort((a, b) => b.totalCost - a.totalCost);

  return (
    <div className="min-h-screen">
      <Nav />

      {/* Period Tabs */}
      <div className="border-b border-neutral-800">
        <div className="max-w-5xl mx-auto px-4 pt-3 pb-2 flex gap-1">
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
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex flex-wrap gap-x-5 gap-y-1 text-sm font-mono">
          <span><span className="text-yellow-400 font-bold">${sum.totalCost.toFixed(2)}</span><span className="text-neutral-500 ml-1 text-xs">총비용</span></span>
          <span><span className="text-blue-400 font-bold">{sum.totalSessions.toLocaleString()}</span><span className="text-neutral-500 ml-1 text-xs">세션</span></span>
          <span><span className="text-cyan-400 font-bold">{sum.activeMemberCount}</span><span className="text-neutral-500 ml-1 text-xs">명 활성</span></span>
          <span><span className="text-emerald-400 font-bold">{sum.avgCacheHitPct.toFixed(1)}%</span><span className="text-neutral-500 ml-1 text-xs">평균 cache hit</span></span>
          <span><span className="text-violet-400 font-bold">{Math.round(sum.avgOneShotRate * 100)}%</span><span className="text-neutral-500 ml-1 text-xs">평균 1-shot</span></span>
        </div>
      </div>

      <main className={`max-w-5xl mx-auto px-4 py-6 space-y-8 transition-opacity duration-150 ${loading ? "opacity-40 pointer-events-none" : "opacity-100"}`}>

        {members.length === 0 ? (
          <div className="bg-neutral-900 rounded-lg p-8 text-center text-neutral-500 text-sm font-mono">
            해당 기간에 활동 데이터가 없어요.
          </div>
        ) : (
          <>
            {/* Efficiency Table */}
            <section>
              <h2 className="text-xs font-mono text-neutral-500 uppercase tracking-wider mb-3">효율</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800">
                      <th className="text-left text-neutral-500 pb-2 pr-4 font-normal">멤버</th>
                      <th className="text-right text-neutral-500 pb-2 px-3 font-normal">cache hit</th>
                      <th className="text-right text-neutral-500 pb-2 px-3 font-normal">1-shot</th>
                      <th className="text-right text-neutral-500 pb-2 px-3 font-normal">$/session</th>
                      <th className="text-right text-neutral-500 pb-2 px-3 font-normal">$/call</th>
                      <th className="text-right text-neutral-500 pb-2 px-3 font-normal">out/in</th>
                      <th className="text-right text-neutral-500 pb-2 pl-3 font-normal">종합</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => {
                      const costPerSession = m.sessionsCount > 0 ? m.totalCost / m.sessionsCount : 0;
                      const calls = m.callsCount > 0 ? m.callsCount : m.sessionsCount;
                      const costPerCall = calls > 0 ? m.totalCost / calls : 0;
                      const grade = overallGrade(m.cacheHitPct, m.overallOneShot, costPerSession);
                      return (
                        <tr key={m.userId} className="border-b border-neutral-800/50 hover:bg-neutral-900/60 transition-colors">
                          <td className="py-2.5 pr-4">
                            <Link href={`/team/${m.userId}`} className="flex items-center gap-2 hover:text-neutral-200 text-neutral-300">
                              <span>{m.name}</span>
                              <SyncBadge lastSyncedAt={m.lastSyncedAt} />
                            </Link>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <span className="text-neutral-300 mr-1.5">{m.cacheHitPct.toFixed(1)}%</span>
                            <GradePill grade={cacheHitGrade(m.cacheHitPct)} />
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <span className="text-neutral-300 mr-1.5">{Math.round(m.overallOneShot * 100)}%</span>
                            <GradePill grade={oneShotGrade(m.overallOneShot * 100)} />
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <span className="text-neutral-300 mr-1.5">${costPerSession.toFixed(2)}</span>
                            <GradePill grade={costGrade(costPerSession)} />
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <span className="text-neutral-300 mr-1.5">${costPerCall.toFixed(3)}</span>
                            <GradePill grade={costPerCallGrade(costPerCall)} />
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <span className="text-neutral-300 mr-1.5">{m.outputInputRatio.toFixed(1)}×</span>
                            <GradePill grade={outputInputGrade(m.outputInputRatio)} />
                          </td>
                          <td className="py-2.5 pl-3 text-right">
                            <GradePill grade={grade} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Usage Bar Chart */}
            <section>
              <h2 className="text-xs font-mono text-neutral-500 uppercase tracking-wider mb-3">사용량</h2>
              <div className="bg-neutral-900 rounded-lg p-4">
                <ResponsiveContainer width="100%" height={Math.max(160, byCost.length * 40)}>
                  <BarChart
                    layout="vertical"
                    data={byCost.map((m) => ({
                      name: m.name,
                      cost: parseFloat(m.totalCost.toFixed(2)),
                      세션: m.sessionsCount,
                    }))}
                    margin={{ top: 0, right: 64, left: 0, bottom: 0 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fill: "#525252", fontSize: 10, fontFamily: "monospace" }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <YAxis
                      type="category" dataKey="name"
                      tick={{ fill: "#a3a3a3", fontSize: 11, fontFamily: "monospace" }}
                      axisLine={false} tickLine={false} width={90}
                    />
                    <Tooltip
                      contentStyle={{ background: "#171717", border: "1px solid #404040", borderRadius: 6, fontSize: 11, fontFamily: "monospace" }}
                      labelStyle={{ color: "#e5e5e5" }}
                      formatter={(v, name) =>
                        name === "cost" ? [`$${Number(v).toFixed(2)}`, "비용"] : [v, "세션"]
                      }
                    />
                    <Bar
                      dataKey="cost" fill="#4f46e5" radius={[0, 3, 3, 0]}
                      label={{ position: "right", fill: "#fbbf24", fontSize: 10, fontFamily: "monospace", formatter: (v: unknown) => `$${Number(v).toFixed(0)}` }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Daily Trend */}
            {data.daily.length > 1 && (
              <section>
                <h2 className="text-xs font-mono text-neutral-500 uppercase tracking-wider mb-3">일별 비용 추이</h2>
                <div className="bg-neutral-900 rounded-lg p-4">
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart
                      data={data.daily.map((d) => ({
                        date: fmtDate(d.date),
                        cost: parseFloat(d.cost.toFixed(2)),
                      }))}
                      margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#525252", fontSize: 10, fontFamily: "monospace" }}
                        axisLine={false} tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fill: "#525252", fontSize: 10, fontFamily: "monospace" }}
                        axisLine={false} tickLine={false}
                        tickFormatter={(v) => `$${v}`}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={{ background: "#171717", border: "1px solid #404040", borderRadius: 6, fontSize: 11, fontFamily: "monospace" }}
                        formatter={(v) => [`$${Number(v).toFixed(2)}`, "팀 비용"]}
                      />
                      <Area type="monotone" dataKey="cost" stroke="#4f46e5" strokeWidth={2} fill="url(#costGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
