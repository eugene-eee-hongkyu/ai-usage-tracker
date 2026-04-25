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
  summary: { totalTokens: number; totalCost: number; oneShotRate: number; cacheHitRate: number; sessionsCount: number };
  daily: Array<{ date: string; total_tokens: number; total_cost: number }>;
  models: Record<string, { tokens: number; cost: number }>;
  suggestions: Suggestion[];
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function staleBanner(lastSyncedAt: string | null) {
  if (!lastSyncedAt) return false;
  const diff = Date.now() - new Date(lastSyncedAt).getTime();
  return diff > 24 * 60 * 60 * 1000;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("week");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);

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

  const chartData = data.daily.map((d) => ({
    date: d.date.slice(5),
    tokens: Math.round(d.total_tokens / 1000),
  }));

  const totalTokens = data.summary.totalTokens;
  const activeHours = Math.round(data.summary.sessionsCount * 0.8);

  return (
    <div className="min-h-screen">
      <Nav />

      {!bannerDismissed && !data.user.lastSyncedAt && (
        <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between text-sm text-slate-300">
          <span>ⓘ 과거 데이터 수집 중 · 잠시 후 추가됩니다</span>
          <button onClick={() => setBannerDismissed(true)} className="text-slate-500 hover:text-slate-300">✕</button>
        </div>
      )}

      {staleBanner(data.user.lastSyncedAt) && (
        <div className="bg-yellow-950 border-b border-yellow-800 px-4 py-2 flex items-center justify-between text-sm text-yellow-300">
          <span>마지막 수집: {data.user.lastSyncedAt ? new Date(data.user.lastSyncedAt).toLocaleDateString("ko") : "없음"} · <Link href="/setup-status" className="underline">셋업 확인 →</Link></span>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Summary line */}
        <div className="text-lg font-semibold text-slate-200">
          {period === "today" ? "오늘" : period === "week" ? "이번 주" : period === "month" ? "이번 달" : "전체"}{" "}
          {fmtTokens(totalTokens)} tok · ${data.summary.totalCost.toFixed(2)} · {activeHours}시간 활동
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
          <p className="text-sm text-slate-400 mb-3">일별 토큰 (7일)</p>
          {loading ? (
            <div className="h-32 bg-slate-800 animate-pulse rounded" />
          ) : (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={chartData}>
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6 }}
                  labelStyle={{ color: "#94a3b8" }}
                  formatter={(v) => [`${v}K tok`]}
                />
                <Bar dataKey="tokens" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Model breakdown */}
        <div className="bg-slate-900 rounded-lg p-4 space-y-2">
          <p className="text-sm text-slate-400 mb-2">모델별 ({period === "week" ? "이번 주" : period})</p>
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

        {/* Efficiency metrics */}
        <div className="bg-slate-900 rounded-lg p-4 space-y-2">
          <p className="text-sm text-slate-400 mb-2">효율 지표</p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs">One-shot rate</p>
              <p className="text-slate-200 font-semibold">{data.summary.oneShotRate}%</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Cache hit</p>
              <p className="text-slate-200 font-semibold">{data.summary.cacheHitRate}%</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">세션</p>
              <p className="text-slate-200 font-semibold">{data.summary.sessionsCount}회</p>
            </div>
          </div>
        </div>

        {/* Suggestions preview */}
        {data.suggestions.length > 0 && (
          <div className="bg-slate-900 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">💡 제안 ({data.suggestions.length}건)</p>
              <Link href="/dashboard/detail" className="text-xs text-indigo-400 hover:text-indigo-300">더보기 →</Link>
            </div>
            {data.suggestions.slice(0, 3).map((s, i) => (
              <div key={i} className="text-sm text-slate-300 flex items-start gap-2">
                <span className="text-slate-500">•</span>
                <span>
                  {s.title}
                  {s.confidence === "low" && <span className="ml-2 text-xs text-yellow-500">[신뢰도:낮음]</span>}
                </span>
              </div>
            ))}
          </div>
        )}

        {data.summary.sessionsCount === 0 && (
          <div className="bg-slate-900 rounded-lg p-8 text-center text-slate-400">
            <p>아직 Claude Code 세션이 없네요.</p>
            <p className="text-sm mt-1">한 번 사용 후 종료해보세요.</p>
            <Link href="/setup" className="text-indigo-400 text-sm mt-2 block hover:underline">셋업 가이드 →</Link>
          </div>
        )}
      </main>
    </div>
  );
}
