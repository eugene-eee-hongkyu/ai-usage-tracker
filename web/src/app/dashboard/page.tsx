"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { Nav } from "@/components/nav";
import Link from "next/link";

type Period = "today" | "week" | "month" | "all";

interface Activity { name: string; sessions: number; cost: number; oneShotRate: number }
interface Project { name: string; cost: number; sessions: number; avgCost: number }
interface TopSession { id: string; date: string; project: string; cost: number; turns: number }
interface DailyRow { date: string; cost: number; sessions: number }

interface DashboardData {
  user: { name: string; lastSyncedAt: string | null };
  summary: {
    totalCost: number;
    sessionsCount: number;
    activeDays: number;
    cacheHitPct: number;
    overallOneShot: number;
    avgTurns: number;
    allTimeCost: number;
    allTimeSessions: number;
  } | null;
  daily: DailyRow[];
  activities: Activity[];
  projects: Project[];
  topSessions: TopSession[];
}

function staleBanner(lastSyncedAt: string | null) {
  if (!lastSyncedAt) return false;
  return Date.now() - new Date(lastSyncedAt).getTime() > 24 * 60 * 60 * 1000;
}

function periodLabel(period: Period) {
  return period === "today" ? "오늘" : period === "week" ? "이번 주" : period === "month" ? "이번 달" : "전체";
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { cost: number; sessions: number } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const { cost, sessions } = payload[0].payload;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-lg space-y-1">
      <p className="text-slate-400">{label}</p>
      <p className="text-indigo-300 font-semibold">${cost.toFixed(3)}</p>
      {sessions > 0 && <p className="text-slate-300">{sessions}회 세션</p>}
    </div>
  );
}

function MetricStatus({ value, thresholdGood, thresholdOk, inverse = false }: {
  value: number; thresholdGood: number; thresholdOk: number; inverse?: boolean;
}) {
  const good = inverse ? value <= thresholdGood : value >= thresholdGood;
  const ok = inverse ? value <= thresholdOk : value >= thresholdOk;
  if (good) return <span className="text-green-400 text-xs">● 좋음</span>;
  if (ok) return <span className="text-yellow-400 text-xs">● 보통</span>;
  return <span className="text-slate-500 text-xs">● 낮음</span>;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("week");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetch(`/api/dashboard?period=${period}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [session, period]);

  useEffect(() => {
    if (!session || !data || data.user.lastSyncedAt) return;
    const timer = setInterval(() => {
      fetch(`/api/dashboard?period=${period}`)
        .then((r) => r.json())
        .then((d) => { if (d.user?.lastSyncedAt) setData(d); });
    }, 4000);
    return () => clearInterval(timer);
  }, [session, data, period]);

  if (status === "loading" || !data) return (
    <div className="min-h-screen">
      <Nav />
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-500">로딩 중...</div>
      </div>
    </div>
  );

  const neverSynced = !data.user.lastSyncedAt;
  if (neverSynced) {
    return (
      <div className="min-h-screen">
        <Nav />
        <main className="max-w-xl mx-auto px-4 py-20 text-center space-y-6">
          <div className="text-4xl animate-pulse">⏳</div>
          <h1 className="text-2xl font-bold text-slate-100">데이터 수집 중...</h1>
          <p className="text-slate-400">
            CLI가 과거 사용량을 백그라운드에서 수집하고 있습니다.<br />
            잠시 후 자동으로 대시보드가 표시됩니다.
          </p>
          <p className="text-xs text-slate-600">
            CLI가 아직 설치되지 않았다면 →{" "}
            <Link href="/setup" className="underline hover:text-slate-400">CLI 설치하기</Link>
          </p>
        </main>
      </div>
    );
  }

  const s = data.summary!;
  const chartData = data.daily.map((d) => ({
    date: d.date.slice(5),
    cost: d.cost,
    sessions: d.sessions,
  }));

  const costPerSession = s.allTimeSessions > 0 ? s.allTimeCost / s.allTimeSessions : 0;
  const oneShotPct = Math.round(s.overallOneShot * 100);
  const periodTotalDays = period === "today" ? 1 : period === "week" ? 7 : period === "month" ? 30
    : data.daily.length > 0
    ? Math.round((Date.now() - new Date(data.daily[0].date + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  return (
    <div className="min-h-screen">
      <Nav />

      {staleBanner(data.user.lastSyncedAt) && (
        <div className="bg-yellow-950 border-b border-yellow-800 px-4 py-2 flex items-center text-sm text-yellow-300">
          <span>
            마지막 수집: {new Date(data.user.lastSyncedAt!).toLocaleDateString("ko")} ·{" "}
            <Link href="/setup-status" className="underline">셋업 확인 →</Link>
          </span>
        </div>
      )}

      <main className={`max-w-3xl mx-auto px-4 py-6 space-y-6 transition-opacity duration-150 ${loading ? "opacity-40 pointer-events-none" : "opacity-100"}`}>

        {/* Summary line */}
        <div>
          <div className="text-lg font-semibold text-slate-200">
            {periodLabel(period)} ${s.totalCost.toFixed(2)} · {s.sessionsCount}회 세션
          </div>
          <p className="text-xs text-slate-600 mt-0.5">기간 집계 (일별 합산)</p>
        </div>

        {/* Period tabs */}
        <div className="flex gap-2">
          {(["today", "week", "month", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-sm transition-colors ${period === p ? "bg-slate-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"}`}
            >
              {p === "today" ? "오늘" : p === "week" ? "이번주" : p === "month" ? "이번달" : "전체"}
            </button>
          ))}
        </div>

        {/* Daily cost chart */}
        <div className="bg-slate-900 rounded-lg p-4">
          <p className="text-sm text-slate-400 mb-3">일별 비용 ({periodLabel(period)})</p>
          {loading ? (
            <div className="h-32 bg-slate-800 animate-pulse rounded" />
          ) : chartData.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-slate-600 text-sm">이 기간에 데이터가 없습니다</div>
          ) : (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(99,102,241,0.1)" }} />
                <Bar dataKey="cost" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Efficiency metrics (all-time from snapshot) */}
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-400">효율 지표 <span className="text-xs text-slate-600">(전체 기간)</span></p>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Cache hit</p>
              <p className="text-xl font-semibold text-slate-200">{Math.round(s.cacheHitPct)}%</p>
              <MetricStatus value={s.cacheHitPct} thresholdGood={80} thresholdOk={50} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">세션당 비용</p>
              <p className="text-xl font-semibold text-slate-200">${costPerSession.toFixed(2)}</p>
              <MetricStatus value={costPerSession} thresholdGood={0.5} thresholdOk={2} inverse />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">One-shot rate</p>
              <p className="text-xl font-semibold text-slate-200">{oneShotPct}%</p>
              <MetricStatus value={oneShotPct} thresholdGood={70} thresholdOk={40} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">평균 턴/세션</p>
              <p className="text-xl font-semibold text-slate-200">{s.avgTurns.toFixed(1)}</p>
              <MetricStatus value={s.avgTurns} thresholdGood={3} thresholdOk={7} inverse />
            </div>
          </div>
          <div className="mt-3 flex justify-between text-xs text-slate-600">
            <span>활성 {s.activeDays}/{periodTotalDays}일</span>
            <Link href="/dashboard/detail" className="text-indigo-500 hover:text-indigo-400">상세 →</Link>
          </div>
        </div>

        {/* Activities */}
        {data.activities.length > 0 && (
          <div className="bg-slate-900 rounded-lg p-4 space-y-2">
            <p className="text-sm text-slate-400 mb-3">활동별 one-shot rate</p>
            {data.activities.map((a) => {
              const pct = Math.round(a.oneShotRate * 100);
              return (
                <div key={a.name} className="flex items-center gap-3 text-sm">
                  <span className="w-28 text-slate-300 truncate">{a.name}</span>
                  <div className="flex-1 bg-slate-800 rounded h-2">
                    <div className="bg-indigo-500 h-2 rounded" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-10 text-slate-400 text-right">{pct}%</span>
                  <span className="w-8 text-slate-500 text-right text-xs">{a.sessions}회</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Projects */}
        {data.projects.length > 0 && (
          <div className="bg-slate-900 rounded-lg p-4 space-y-2">
            <p className="text-sm text-slate-400 mb-3">프로젝트별 비용</p>
            {data.projects.slice(0, 8).map((p) => (
              <div key={p.name} className="flex items-center justify-between text-sm py-1 border-b border-slate-800 last:border-0">
                <span className="text-slate-200 flex-1 truncate">{p.name}</span>
                <span className="text-slate-400 w-16 text-right">${p.cost.toFixed(2)}</span>
                <span className="text-slate-500 w-14 text-right">{p.sessions}회</span>
                <span className="text-slate-600 w-18 text-right text-xs">${p.avgCost.toFixed(2)}/회</span>
              </div>
            ))}
            {data.projects.length > 8 && (
              <p className="text-xs text-slate-600 pt-1">+{data.projects.length - 8}개 더 · <Link href="/dashboard/detail" className="text-indigo-500">상세 보기</Link></p>
            )}
          </div>
        )}

        {/* Top sessions */}
        {data.topSessions.length > 0 && (
          <div className="bg-slate-900 rounded-lg p-4 space-y-2">
            <p className="text-sm text-slate-400 mb-3">Top sessions</p>
            {data.topSessions.slice(0, 5).map((s, i) => (
              <div key={s.id ?? i} className="flex items-center justify-between text-sm py-1 border-b border-slate-800 last:border-0">
                <span className="text-slate-500 w-5 text-xs">{i + 1}.</span>
                <span className="text-slate-400 w-20 text-xs">{s.date}</span>
                <span className="text-slate-300 flex-1 truncate">{s.project}</span>
                <span className="text-slate-400 w-16 text-right">${s.cost.toFixed(2)}</span>
                <span className="text-slate-600 w-12 text-right text-xs">{s.turns}턴</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
