// /ranking — 전체 개인 랭킹 페이지.
// 4축 탭 (cost / tokens / 활용지수 / cacheHit). 상위 50명 + 내 위치 중심.
// 이름은 익명 마스킹 (서버에서 처리). 내 행은 하이라이트.

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { useMessages } from "@/lib/use-i18n";

type Metric = "cost" | "tokens" | "powerIndex" | "cacheHit";

interface RankedUser {
  rank: number;
  userId: number;
  name: string;
  cost: number;
  tokens: number;
  powerIndex: number;
  cacheHit: number;
  activeDays: number;
  isMe: boolean;
}

interface RankingResponse {
  metric: Metric;
  totalParticipants: number;
  top: RankedUser[];
  around: RankedUser[];
  myRank: RankedUser | null;
  period: string;
}

const METRICS: Array<{ value: Metric; labelKo: string; labelEn: string }> = [
  { value: "cost", labelKo: "비용", labelEn: "Cost" },
  { value: "tokens", labelKo: "사용량", labelEn: "Tokens" },
  { value: "powerIndex", labelKo: "활용지수", labelEn: "Utilization" },
  { value: "cacheHit", labelKo: "캐시 히트", labelEn: "Cache Hit" },
];

function fmtValue(metric: Metric, value: number): string {
  switch (metric) {
    case "cost":
      return `$${value.toFixed(2)}`;
    case "tokens":
      if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
      return String(Math.round(value));
    case "powerIndex":
      return value.toFixed(1);
    case "cacheHit":
      return `${value.toFixed(1)}%`;
  }
}

export default function RankingPage() {
  const { status } = useSession();
  const router = useRouter();
  const { m } = useMessages();
  const [metric, setMetric] = useState<Metric>("cost");
  const [data, setData] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    setError(null);
    fetch(`/api/ranking?metric=${metric}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: RankingResponse) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, [metric, status]);

  if (status === "loading") return null;

  return (
    <div className="min-h-screen bg-neutral-950">
      <Nav />
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <header>
          <h1 className="text-lg font-bold text-slate-100">{m.nav.ranking ?? "랭킹"}</h1>
          <p className="text-xs text-slate-500 mt-1">
            최근 30일 (UTC) 기준 전체 참여자 순위. 이름은 익명 처리됩니다. 동점은 같은 순위.
          </p>
        </header>

        {/* Metric Tabs */}
        <div className="flex gap-1">
          {METRICS.map((mt) => (
            <button
              key={mt.value}
              onClick={() => setMetric(mt.value)}
              className={`text-xs px-3 py-1.5 rounded font-mono transition-colors ${
                metric === mt.value
                  ? "bg-slate-700 text-slate-100"
                  : "bg-slate-900 text-slate-500 hover:text-slate-300"
              }`}
            >
              {mt.labelKo}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-rose-400 font-mono">로드 실패: {error}</p>}
        {loading && <p className="text-sm text-neutral-500 font-mono">loading…</p>}

        {data && !loading && (
          <div className="space-y-6">
            {/* My Rank Summary */}
            {data.myRank && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-3xl font-mono font-bold text-emerald-400">
                    #{data.myRank.rank}
                  </span>
                  <span className="text-sm font-mono text-slate-400">
                    / {data.totalParticipants}명 중
                  </span>
                  <span className="text-lg font-mono font-bold text-slate-100 ml-auto">
                    {fmtValue(metric, data.myRank[metric])}
                  </span>
                </div>
                <p className="text-xs font-mono text-emerald-300/70 mt-1">
                  활성일 {data.myRank.activeDays}일 · 최근 30일
                </p>
              </div>
            )}

            {!data.myRank && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-xs font-mono text-slate-500">
                랭킹 참여 데이터가 없습니다. 데이터가 수집되면 여기에 내 순위가 표시됩니다.
              </div>
            )}

            {/* Top 50 Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-800">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                  상위 {Math.min(50, data.totalParticipants)}명
                </span>
              </div>
              <RankTable rows={data.top} metric={metric} />
            </div>

            {/* Around Me */}
            {data.around.length > 0 && data.myRank && data.myRank.rank > 50 && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-800">
                  <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                    내 주변 순위
                  </span>
                </div>
                <RankTable rows={data.around} metric={metric} />
              </div>
            )}

            <p className="text-[10px] font-mono text-slate-600 text-center">
              전체 {data.totalParticipants}명 참여 · 최근 30일 · {metric === "cacheHit" ? "높을수록" : metric === "powerIndex" ? "높을수록" : "많을수록"} 상위
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function RankTable({ rows, metric }: { rows: RankedUser[]; metric: Metric }) {
  return (
    <table className="w-full text-xs font-mono">
      <thead>
        <tr className="text-slate-600 border-b border-slate-800">
          <th className="text-left px-4 py-2 w-16">#</th>
          <th className="text-left px-4 py-2">이름</th>
          <th className="text-right px-4 py-2 w-20">활성일</th>
          <th className="text-right px-4 py-2 w-24">
            {metric === "cost" ? "비용" : metric === "tokens" ? "토큰" : metric === "powerIndex" ? "활용지수" : "캐시히트"}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.userId}
            className={`border-b border-slate-800/50 ${
              r.isMe
                ? "bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/30"
                : "hover:bg-slate-800/30"
            }`}
          >
            <td className="px-4 py-2.5 text-slate-500 tabular-nums">
              {r.rank <= 3 ? (
                <span className={r.rank === 1 ? "text-yellow-400 font-bold" : r.rank === 2 ? "text-slate-300 font-bold" : "text-amber-600 font-bold"}>
                  {r.rank}
                </span>
              ) : (
                r.rank
              )}
            </td>
            <td className="px-4 py-2.5">
              <span className={r.isMe ? "text-emerald-300 font-bold" : "text-slate-300"}>
                {r.name}
              </span>
              {r.isMe && <span className="text-[10px] text-emerald-400 ml-2">← 나</span>}
            </td>
            <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">{r.activeDays}d</td>
            <td className="px-4 py-2.5 text-right tabular-nums">
              <span className={
                metric === "cost" ? "text-yellow-400" :
                metric === "tokens" ? "text-cyan-400" :
                metric === "powerIndex" ? "text-emerald-400" :
                "text-emerald-400"
              }>
                {fmtValue(metric, r[metric])}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
