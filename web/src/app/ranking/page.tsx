// /ranking — 4개 metric 을 한 화면에 grid 로 배치 (대시보드 스타일).
// 옛 동작: 탭 전환. 새 동작: 2x2 grid (desktop) / 1col (mobile). 각 카드 내부에
// metric 이름 + 본인 hero + Top 10 + 본인이 top 10 밖이면 마지막 행에 본인.

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { track, EVENTS } from "@/lib/analytics/mixpanel";
import { useTrackScrollDepth } from "@/lib/analytics/use-track-scroll-depth";
import { ProviderSegmentedControl } from "@/components/provider-segmented-control";
import { useProviderPreference } from "@/lib/use-provider-preference";

type Metric = "cost" | "tokens" | "cacheHit" | "streak" | "saving";

interface RankedUser {
  rank: number;
  userId: number;
  name: string;
  cost: number;
  tokens: number;
  cacheHit: number;
  streak: number;
  saving: number;
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
  hasCodexData?: boolean;
  hasClaudeData?: boolean;
}

// 비용은 wide (전체 width) 강조. 그 아래 2x2 grid 에 나머지 4개.
const GRID_METRICS: Array<{ value: Metric; label: string }> = [
  { value: "tokens", label: "사용량" },
  { value: "streak", label: "연속 활성일" },
  { value: "cacheHit", label: "캐시 히트" },
  { value: "saving", label: "캐시 절약액" },
];

const ALL_METRICS: Metric[] = ["cost", "tokens", "cacheHit", "saving", "streak"];

// Claude Max20 플랜 월 가격 (회수율 산출 분모)
const MAX20_MONTHLY_USD = 200;

function fmtValue(metric: Metric, value: number): string {
  switch (metric) {
    case "cost":
      return `$${value.toFixed(2)}`;
    case "tokens":
      if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
      return String(Math.round(value));
    case "cacheHit":
      return `${value.toFixed(1)}%`;
    case "streak":
      return `${value}일`;
    case "saving":
      return `$${value.toFixed(2)}`;
  }
}

const VALUE_COLOR_BY_METRIC: Record<Metric, string> = {
  cost: "text-yellow-400",
  tokens: "text-cyan-400",
  cacheHit: "text-violet-400",
  streak: "text-orange-400",
  saving: "text-emerald-400",
};

const ACCENT_BY_METRIC: Record<Metric, { bg: string; border: string; text: string }> = {
  cost: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-300" },
  tokens: { bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-300" },
  cacheHit: { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-300" },
  streak: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-300" },
  saving: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-300" },
};

export default function RankingPage() {
  const { status } = useSession();
  const router = useRouter();
  const [byMetric, setByMetric] = useState<Partial<Record<Metric, RankingResponse>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Multi-provider — 마지막 선택 localStorage 기억 (dashboard / team 과 공유).
  const [provider, setProvider] = useProviderPreference();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // ranking_view — 인증된 사용자 진입 시 1회.
  useEffect(() => {
    if (status === "authenticated") track(EVENTS.RANKING_VIEW);
  }, [status]);

  // 스크롤 깊이 마일스톤
  useTrackScrollDepth("ranking");

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    setError(null);
    Promise.all(
      ALL_METRICS.map((mt) =>
        fetch(`/api/ranking?metric=${mt}${provider === "codex" ? "&provider=codex" : ""}`)
          .then((r) => {
            if (!r.ok) throw new Error(String(r.status));
            return r.json();
          })
          .then((d: RankingResponse) => ({ metric: mt, data: d }))
      )
    )
      .then((results) => {
        const next: Partial<Record<Metric, RankingResponse>> = {};
        for (const { metric, data } of results) next[metric] = data;
        setByMetric(next);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, [status, provider]);

  if (status === "loading") return null;

  const totalParticipants = byMetric.cost?.totalParticipants ?? 0;

  return (
    <div className="min-h-screen bg-neutral-950">
      <Nav />
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* 2026-05-30 reorder: dashboard / team 과 동일 — provider segmented control 이 최상단.
            "랭킹" h1 제거 (사용자 피드백: nav 가 이미 [랭킹] 활성). 부제는 컨텍스트 (30일 / 익명 / 참여자 수) 라 유지. */}
        <ProviderSegmentedControl
          value={provider}
          // provider 토글 시 옛 byMetric 즉시 폐기 — fetch 응답 도착 전까지 옛 scope 데이터가
          // 잔상으로 보이는 버그 방지. team-view 와 동일 패턴.
          onChange={(p) => {
            if (p !== provider) setByMetric({});
            setProvider(p);
          }}
          hasClaudeData={byMetric.cost?.hasClaudeData ?? true}
          hasCodexData={byMetric.cost?.hasCodexData ?? false}
          testIdPrefix="ranking-provider"
        />
        <p className="text-xs text-slate-500">
          최근 30일 (UTC) 기준 전체 참여자 순위. 이름은 익명 처리됩니다. 동점은 같은 순위.
          {totalParticipants > 0 && (
            <span className="text-slate-400 ml-2">전체 {totalParticipants}명 참여</span>
          )}
        </p>

        {error && <p className="text-sm text-rose-400 font-mono">로드 실패: {error}</p>}
        {loading && <p className="text-sm text-neutral-500 font-mono">loading…</p>}

        {!loading && !error && (
          <div className="space-y-4">
            {/* 비용 — 가장 중요. 전체 width. row 에 Max20 회수율 컬럼 추가 */}
            {byMetric.cost && (
              <MetricCard metric="cost" label="비용" data={byMetric.cost} />
            )}
            {/* 나머지 4 metric — 2x2 grid (사용량/streak/캐시히트/캐시절약액) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {GRID_METRICS.map((mt) => (
                <MetricCard
                  key={mt.value}
                  metric={mt.value}
                  label={mt.label}
                  data={byMetric[mt.value] ?? null}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  metric,
  label,
  data,
}: {
  metric: Metric;
  label: string;
  data: RankingResponse | null;
}) {
  if (!data) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <p className="text-xs font-mono text-slate-500">{label} — 데이터 없음</p>
      </div>
    );
  }

  const accent = ACCENT_BY_METRIC[metric];
  const valueColor = VALUE_COLOR_BY_METRIC[metric];
  const top = data.top.slice(0, 10);
  const myInTop = data.myRank && top.some((r) => r.userId === data.myRank!.userId);

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <span className="text-base font-bold text-slate-100">
          {label}
        </span>
        <span className="text-[10px] font-mono text-slate-500">Top {top.length}</span>
      </div>

      {/* 본인 hero — 카드 내부 상단 */}
      {data.myRank ? (
        <div className={`px-4 py-3 ${accent.bg} border-b ${accent.border}`}>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={`text-2xl font-mono font-bold ${accent.text}`}>
              #{data.myRank.rank}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              / {data.totalParticipants}명 중
            </span>
            <span className={`ml-auto text-base font-mono font-bold ${valueColor}`}>
              {fmtValue(metric, data.myRank[metric])}
            </span>
          </div>
        </div>
      ) : (
        <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-800 text-[11px] font-mono text-slate-500">
          데이터 없음 — 본인 순위 미표시
        </div>
      )}

      {/* Top 10 — cost 카드만 Max20 회수율 컬럼 추가 */}
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-slate-600 border-b border-slate-800">
            <th className="text-left px-3 py-1.5 w-10">#</th>
            <th className="text-left px-3 py-1.5">이름</th>
            <th className="text-right px-3 py-1.5 w-16 whitespace-nowrap">활성일</th>
            <th className="text-right px-3 py-1.5 w-20 whitespace-nowrap">{label}</th>
            {metric === "cost" && (
              <th className="text-right px-3 py-1.5 w-20 whitespace-nowrap">Max20 회수</th>
            )}
          </tr>
        </thead>
        <tbody>
          {top.map((r) => (
            <RankRow key={r.userId} row={r} metric={metric} valueColor={valueColor} />
          ))}
          {/* 본인이 Top 10 밖이면 별도 마지막 행 */}
          {!myInTop && data.myRank && (
            <>
              <tr>
                <td colSpan={metric === "cost" ? 5 : 4} className="text-center text-slate-700 text-[10px] py-1">⋯</td>
              </tr>
              <RankRow row={data.myRank} metric={metric} valueColor={valueColor} />
            </>
          )}
        </tbody>
      </table>
    </section>
  );
}

function RankRow({
  row,
  metric,
  valueColor,
}: {
  row: RankedUser;
  metric: Metric;
  valueColor: string;
}) {
  return (
    <tr
      className={`border-b border-slate-800/50 ${
        row.isMe
          ? "bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/30"
          : "hover:bg-slate-800/30"
      }`}
    >
      <td className="px-3 py-1.5 text-slate-500 tabular-nums">
        {row.rank <= 3 ? (
          <span
            className={
              row.rank === 1
                ? "text-yellow-400 font-bold"
                : row.rank === 2
                ? "text-slate-300 font-bold"
                : "text-amber-600 font-bold"
            }
          >
            {row.rank}
          </span>
        ) : (
          row.rank
        )}
      </td>
      <td className="px-3 py-1.5">
        <span className={row.isMe ? "text-emerald-300 font-bold" : "text-slate-300"}>
          {row.name}
        </span>
        {row.isMe && <span className="text-[10px] text-emerald-400 ml-1.5">← 나</span>}
      </td>
      <td className="px-3 py-1.5 text-right text-slate-500 tabular-nums">{row.activeDays}d</td>
      <td className={`px-3 py-1.5 text-right tabular-nums ${valueColor}`}>
        {fmtValue(metric, row[metric])}
      </td>
      {metric === "cost" && (
        <td className="px-3 py-1.5 text-right tabular-nums text-yellow-300/80">
          {row.cost > 0 ? `${Math.round((row.cost / MAX20_MONTHLY_USD) * 100)}%` : "—"}
        </td>
      )}
    </tr>
  );
}
