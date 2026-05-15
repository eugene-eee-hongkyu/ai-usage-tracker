"use client";

import { useMemo } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { computeTokenLevel } from "@/lib/rules";

export type DrilldownPeriod = "8days" | "month" | "30days" | "all";

export interface DailyScoreEntry {
  date: string;
  score: number | null;
  cacheHitPct: number | null;
  oneShotRate: number | null;
  costPerCall: number | null;
  totalTokens: number | null;
}

interface Props {
  daily: DailyScoreEntry[];
  period: DrilldownPeriod;
}

const CHANGE_THRESHOLD = 15;
const CHANGE_TOP_N = 3;
const DOWNSAMPLE_THRESHOLD_DAYS = 60;

function startOfPeriod(period: DrilldownPeriod): string {
  const today = new Date();
  switch (period) {
    case "8days": {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      return d.toISOString().slice(0, 10);
    }
    case "month": {
      return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
        .toISOString().slice(0, 10);
    }
    case "30days": {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      return d.toISOString().slice(0, 10);
    }
    case "all":
      return "0000-01-01";
  }
}

function scoreColorHex(score: number): string {
  if (score >= 90) return "#10b981";
  if (score >= 70) return "#65a30d";
  if (score >= 40) return "#9a3412";
  return "#7f1d1d";
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

interface ChartDatum {
  label: string;     // X축 표시 (MM/DD or "Wk N")
  score: number | null;
  ma7: number | null;
  date: string;
  bucket: "daily" | "weekly";
}

interface ChangeEvent {
  date: string;
  prevDate: string;
  prevScore: number;
  curScore: number;
  delta: number;
  causes: { label: string; from: string; to: string; weight: number }[];
}

function isoWeekKey(d: Date): string {
  // ISO week year-week (YYYY-Www). Mon-based.
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604_800_000);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function movingAverage(values: (number | null)[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    const slice = values.slice(i - window + 1, i + 1);
    const valid = slice.filter((v): v is number => v !== null);
    if (valid.length < Math.ceil(window / 2)) return null;
    return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
  });
}

function buildChangeAnalysis(entries: DailyScoreEntry[]): ChangeEvent[] {
  const events: ChangeEvent[] = [];
  for (let i = 1; i < entries.length; i++) {
    const cur = entries[i];
    const prev = entries[i - 1];
    if (cur.score === null || prev.score === null) continue;
    const delta = cur.score - prev.score;
    if (Math.abs(delta) < CHANGE_THRESHOLD) continue;

    const causes: ChangeEvent["causes"] = [];

    // 점수 기여도 변화량(가중치 적용 후 점수 단위) 기준으로 정렬.
    // cache: 42 * Δ(cacheNorm), one-shot: 18 * Δ(oneShotNorm), cost: 10 * Δ(costNorm), token: 30 * Δ(tokenNorm)
    if (cur.cacheHitPct !== null && prev.cacheHitPct !== null) {
      const norm = (v: number) => Math.max(0, Math.min(1, (v - 60) / (96 - 60)));
      const w = 42 * (norm(cur.cacheHitPct) - norm(prev.cacheHitPct));
      if (Math.abs(w) >= 3) {
        causes.push({
          label: "캐시 적중률",
          from: `${prev.cacheHitPct.toFixed(0)}%`,
          to: `${cur.cacheHitPct.toFixed(0)}%`,
          weight: w,
        });
      }
    }

    if (cur.oneShotRate !== null && prev.oneShotRate !== null) {
      const norm = (v: number) => Math.max(0, Math.min(1, v / 100));
      const w = 18 * (norm(cur.oneShotRate) - norm(prev.oneShotRate));
      if (Math.abs(w) >= 3) {
        causes.push({
          label: "한 번에 끝낸 비율",
          from: `${prev.oneShotRate.toFixed(0)}%`,
          to: `${cur.oneShotRate.toFixed(0)}%`,
          weight: w,
        });
      }
    }

    if (cur.costPerCall !== null && prev.costPerCall !== null) {
      const norm = (v: number) => Math.max(0, Math.min(1, (0.40 - v) / (0.40 - 0.06)));
      const w = 10 * (norm(cur.costPerCall) - norm(prev.costPerCall));
      if (Math.abs(w) >= 3) {
        causes.push({
          label: "호출당 비용",
          from: `$${prev.costPerCall.toFixed(3)}`,
          to: `$${cur.costPerCall.toFixed(3)}`,
          weight: w,
        });
      }
    }

    if (cur.totalTokens !== null && prev.totalTokens !== null) {
      const w = 30 * ((computeTokenLevel(cur.totalTokens) - computeTokenLevel(prev.totalTokens)) / 10);
      if (Math.abs(w) >= 3) {
        causes.push({
          label: "총 사용량",
          from: fmtTokens(prev.totalTokens),
          to: fmtTokens(cur.totalTokens),
          weight: w,
        });
      }
    }

    causes.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

    events.push({
      date: cur.date,
      prevDate: prev.date,
      prevScore: prev.score,
      curScore: cur.score,
      delta,
      causes: causes.slice(0, 2),
    });
  }

  events.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return events.slice(0, CHANGE_TOP_N);
}

export function ScoreDrilldown({ daily, period }: Props) {
  const { chartData, activeDays, totalDays, isWeekly, changeEvents } = useMemo(() => {
    const start = startOfPeriod(period);
    const windowEntries = daily.filter((d) => d.date >= start);
    const allEntries = period === "all" ? daily.filter((d) => d.score !== null || d.cacheHitPct !== null || true) : windowEntries;

    const span = allEntries.length;
    const weekly = period === "all" && span > DOWNSAMPLE_THRESHOLD_DAYS;

    let data: ChartDatum[];

    if (weekly) {
      const buckets = new Map<string, { scores: number[]; firstDate: string }>();
      for (const e of allEntries) {
        if (e.score === null) continue;
        const key = isoWeekKey(new Date(e.date + "T00:00:00Z"));
        const b = buckets.get(key) ?? { scores: [], firstDate: e.date };
        b.scores.push(e.score);
        buckets.set(key, b);
      }
      const weekRows = [...buckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([wk, b]) => ({
          label: wk.slice(5),
          date: b.firstDate,
          score: Math.round(b.scores.reduce((s, v) => s + v, 0) / b.scores.length),
          ma7: null as number | null,
          bucket: "weekly" as const,
        }));
      const maInput = weekRows.map((r) => r.score);
      const ma = movingAverage(maInput, 4);
      weekRows.forEach((r, i) => { r.ma7 = ma[i]; });
      data = weekRows;
    } else {
      const maInput = allEntries.map((e) => e.score);
      const showMA = allEntries.length >= 7;
      const ma = showMA ? movingAverage(maInput, 7) : maInput.map(() => null);
      data = allEntries.map((e, i) => ({
        label: fmtDate(e.date),
        date: e.date,
        score: e.score,
        ma7: ma[i],
        bucket: "daily" as const,
      }));
    }

    const activeDays = allEntries.filter((e) => e.score !== null).length;
    const events = buildChangeAnalysis(allEntries);

    return {
      chartData: data,
      activeDays,
      totalDays: allEntries.length,
      isWeekly: weekly,
      changeEvents: events,
    };
  }, [daily, period]);

  const lowActivity = totalDays > 0 && activeDays / totalDays < 0.5;

  return (
    <div data-testid="score-drilldown" className="bg-neutral-950 border-t border-neutral-800/60 px-4 py-4">
      <div className="max-w-6xl mx-auto space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
            {isWeekly ? "주간 평균 효율 점수" : "일별 효율 점수"} · {totalDays}{isWeekly ? "주" : "일"}
          </span>
          {lowActivity && (
            <span className="text-[10px] font-mono text-amber-400">
              활동일 {activeDays}/{totalDays}일
            </span>
          )}
        </div>

        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#525252"
                tick={{ fontSize: 10, fontFamily: "monospace" }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                stroke="#525252"
                tick={{ fontSize: 10, fontFamily: "monospace" }}
                tickCount={6}
              />
              <Tooltip
                contentStyle={{ background: "#171717", border: "1px solid #404040", borderRadius: 6, fontSize: 11, fontFamily: "monospace" }}
                labelStyle={{ color: "#a3a3a3" }}
                formatter={(value, name) => {
                  const label = name === "score" ? "점수" : "7일 평균";
                  if (value === null || value === undefined) return ["—", label];
                  return [value, label];
                }}
              />
              <Bar dataKey="score" radius={[2, 2, 0, 0]} maxBarSize={28}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.score === null ? "transparent" : scoreColorHex(d.score)} />
                ))}
              </Bar>
              {!isWeekly && chartData.some((d) => d.ma7 !== null) && (
                <Line
                  type="monotone"
                  dataKey="ma7"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              )}
              {isWeekly && (
                <Line
                  type="monotone"
                  dataKey="ma7"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center gap-3 text-[10px] font-mono text-neutral-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />90+</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-lime-600" />70–89</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-700" />40–69</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-900" />&lt;40</span>
          {!isWeekly && chartData.some((d) => d.ma7 !== null) && (
            <span className="flex items-center gap-1 ml-2">
              <span className="w-3 h-0.5 bg-blue-400" /> 7일 이동평균
            </span>
          )}
          {isWeekly && (
            <span className="flex items-center gap-1 ml-2">
              <span className="w-3 h-0.5 bg-blue-400" /> 4주 이동평균
            </span>
          )}
        </div>

        <div className="pt-2 border-t border-neutral-800/60">
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">변동이 컸던 날 (전일 대비 ±{CHANGE_THRESHOLD}점 이상)</span>
          {changeEvents.length === 0 ? (
            <p data-testid="score-drilldown-no-events" className="text-xs text-neutral-500 mt-2 font-mono">
              ✓ 지난 {totalDays}{isWeekly ? "주" : "일"} 효율 점수는 안정적이었습니다.
            </p>
          ) : (
            <ul data-testid="score-drilldown-events" className="mt-2 space-y-2">
              {changeEvents.map((e) => (
                <li
                  key={e.date}
                  data-testid={`score-drilldown-event-${e.date}`}
                  className="text-xs font-mono bg-neutral-900/60 border border-neutral-800 rounded px-3 py-2"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-neutral-300">{fmtDate(e.date)}</span>
                    <span className="text-neutral-500">
                      {e.prevScore}점 → {e.curScore}점
                    </span>
                    <span className={e.delta > 0 ? "text-emerald-400" : "text-rose-400"}>
                      {e.delta > 0 ? `▲ +${e.delta}` : `▼ ${e.delta}`}
                    </span>
                  </div>
                  {e.causes.length > 0 ? (
                    <div className="mt-1 text-[11px] text-neutral-400 leading-relaxed">
                      주 원인:{" "}
                      {e.causes.map((c, i) => (
                        <span key={i}>
                          {i > 0 && <span className="text-neutral-600"> · </span>}
                          <span className="text-neutral-300">{c.label}</span>{" "}
                          <span className="text-neutral-500">
                            {c.from} → {c.to} ({c.weight > 0 ? "+" : ""}{c.weight.toFixed(1)}점)
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-neutral-500">
                      각 지표 변화가 작아 특정 원인을 짚기 어렵습니다.
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
