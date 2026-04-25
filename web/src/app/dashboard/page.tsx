"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { Nav } from "@/components/nav";
import Link from "next/link";
import type { Suggestion } from "@/lib/rules";

type Period = "today" | "week" | "month" | "all";

interface DashboardData {
  user: { name: string; lastSyncedAt: string | null };
  summary: { totalTokens: number; totalCost: number; oneShotRate: number; cacheHitRate: number; sessionsCount: number; totalEdits: number };
  daily: Array<{ date: string; totalTokens: number; totalCost: number; cacheRead: number; cacheWrite: number }>;
  models: Record<string, { tokens: number; cost: number }>;
  suggestions: Suggestion[];
}

function fmtTokens(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function staleBanner(lastSyncedAt: string | null) {
  if (!lastSyncedAt) return false;
  return Date.now() - new Date(lastSyncedAt).getTime() > 24 * 60 * 60 * 1000;
}

function periodLabel(period: Period) {
  return period === "today" ? "오늘" : period === "week" ? "이번 주" : period === "month" ? "이번 달" : "전체";
}

function chartDayLabel(period: Period, totalDays: number) {
  if (period === "today") return "오늘 토큰";
  if (period === "week") return "일별 토큰 (7일)";
  if (period === "month") return "일별 토큰 (30일)";
  return `일별 토큰 (전체 ${totalDays}일)`;
}

// Recharts custom tooltip
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const display = val >= 1000 ? `${(val / 1000).toFixed(1)}B tok` : `${val}M tok`;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-indigo-300 font-semibold">{display}</p>
    </div>
  );
}

// Status badge for efficiency metrics
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
          <div className="text-4xl">🚀</div>
          <h1 className="text-2xl font-bold text-slate-100">시작해볼까요?</h1>
          <p className="text-slate-400">
            Claude Code 사용량을 자동으로 수집하려면<br />
            CLI를 한 번만 설치하면 됩니다.
          </p>
          <Link
            href="/setup"
            className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
          >
            CLI 설치하기 →
          </Link>
          <p className="text-xs text-slate-600">
            설치 후 Claude Code 세션을 종료하면 자동으로 이 화면이 채워집니다
          </p>
        </main>
      </div>
    );
  }

  // Chart: include cache tokens, unit = M
  const chartData = data.daily.map((d) => ({
    date: d.date.slice(5),
    tokensM: Math.round(((d.totalTokens ?? 0) + (d.cacheRead ?? 0) + (d.cacheWrite ?? 0)) / 1_000_000),
    cost: d.totalCost ?? 0,
  }));

  const totalTokens = data.summary.totalTokens;
  const { cacheHitRate, oneShotRate, sessionsCount, totalEdits } = data.summary;
  const activeDays = data.daily.filter((d) =>
    ((d.totalTokens ?? 0) + (d.cacheRead ?? 0) + (d.cacheWrite ?? 0)) > 0
  ).length;

  return (
    <div className="min-h-screen">
      <Nav />

      {staleBanner(data.user.lastSyncedAt) && (
        <div className="bg-yellow-950 border-b border-yellow-800 px-4 py-2 flex items-center justify-between text-sm text-yellow-300">
          <span>
            마지막 수집: {new Date(data.user.lastSyncedAt!).toLocaleDateString("ko")} ·{" "}
            <Link href="/setup-status" className="underline">셋업 확인 →</Link>
          </span>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Summary line */}
        <div>
          <div className="text-lg font-semibold text-slate-200">
            {periodLabel(period)}{" "}
            {fmtTokens(totalTokens)} tok · ${data.summary.totalCost.toFixed(2)} · {sessionsCount}회 세션
          </div>
          <p className="text-xs text-slate-600 mt-0.5">캐시 포함 토큰 총계 (입력 + 출력 + 캐시 읽기/쓰기)</p>
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

        {/* Daily token chart */}
        <div className="bg-slate-900 rounded-lg p-4">
          <p className="text-sm text-slate-400 mb-3">{chartDayLabel(period, chartData.length)}</p>
          {loading ? (
            <div className="h-32 bg-slate-800 animate-pulse rounded" />
          ) : (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(99,102,241,0.1)" }} />
                <Bar dataKey="tokensM" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Model breakdown */}
        <div className="bg-slate-900 rounded-lg p-4 space-y-2">
          <p className="text-sm text-slate-400 mb-2">
            모델별 ({periodLabel(period)})
          </p>
          {Object.entries(data.models)
            .sort(([, a], [, b]) => b.tokens - a.tokens)
            .map(([model, stat]) => {
              const pct = totalTokens > 0 ? Math.round((stat.tokens / totalTokens) * 100) : 0;
              return (
                <div key={model} className="flex items-center gap-3 text-sm">
                  <span className="w-14 text-slate-300">{model}</span>
                  <div className="flex-1 bg-slate-800 rounded h-2">
                    <div className="bg-indigo-500 h-2 rounded" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-slate-400 text-right">{pct}%</span>
                  <span className="w-12 text-slate-400 text-right">${stat.cost.toFixed(2)}</span>
                </div>
              );
            })}
        </div>

        {/* Metrics */}
        <div className="bg-slate-900 rounded-lg p-4">
          <p className="text-sm text-slate-400 mb-4">사용 지표</p>
          <div className="grid grid-cols-3 gap-4">
            {/* One-shot rate */}
            <div className="space-y-1">
              <p className="text-xs text-slate-500">One-shot rate</p>
              {totalEdits > 0 ? (
                <>
                  <p className="text-xl font-semibold text-slate-200">{oneShotRate}%</p>
                  <MetricStatus value={oneShotRate} thresholdGood={70} thresholdOk={40} />
                  <p className="text-xs text-slate-600 leading-relaxed mt-1">
                    첫 번째 코드 편집 시도가 바로 성공하는 비율.<br />
                    높을수록 AI가 요구사항을 정확히 파악한다는 신호.<br />
                    <span className="text-slate-500">목표 70%+</span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xl font-semibold text-slate-500">측정 불가</p>
                  <p className="text-xs text-slate-600 leading-relaxed mt-1">
                    현재 버전에서는 편집 성공 여부를<br />
                    ccusage가 수집하지 않습니다.
                  </p>
                </>
              )}
            </div>
            {/* Cache hit */}
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Cache hit</p>
              <p className="text-xl font-semibold text-slate-200">{cacheHitRate}%</p>
              <MetricStatus value={cacheHitRate} thresholdGood={80} thresholdOk={50} />
              <p className="text-xs text-slate-600 leading-relaxed mt-1">
                이전에 처리한 내용을 재사용한 비율.<br />
                높을수록 API 비용이 절감됨.<br />
                CLAUDE.md를 짧게 유지하면 올라감.<br />
                <span className="text-slate-500">목표 80%+</span>
              </p>
            </div>
            {/* Active days */}
            <div className="space-y-1">
              <p className="text-xs text-slate-500">활성 일수</p>
              <p className="text-xl font-semibold text-slate-200">{activeDays}일</p>
              <p className="text-xs text-slate-600 leading-relaxed mt-1">
                이 기간 중 실제로<br />
                사용한 날 수.<br />
                <span className="text-slate-500">(전체 {sessionsCount}회 수집)</span>
              </p>
            </div>
          </div>
        </div>

        {/* Suggestions */}
        {data.suggestions.length > 0 && (
          <div className="bg-slate-900 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">💡 절감 제안 ({data.suggestions.length}건)</p>
              <Link href="/dashboard/detail" className="text-xs text-indigo-400 hover:text-indigo-300">더보기 →</Link>
            </div>
            {data.suggestions.slice(0, 3).map((s, i) => (
              <div key={i} className="border-l-2 border-slate-700 pl-3 space-y-1">
                <div className="flex items-start gap-2 text-sm">
                  <span className="text-slate-200 font-medium">{s.title}</span>
                  {s.confidence === "low" && (
                    <span className="shrink-0 text-xs text-yellow-600 bg-yellow-950 px-1.5 py-0.5 rounded">신뢰도 낮음</span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{s.detail}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
