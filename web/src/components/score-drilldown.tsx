"use client";

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, LabelList,
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

// 5단계 — 게이지 라벨(탁월/양호/보통/부족/경고) 과 점수 구간 통일.
function scoreColorHex(score: number): string {
  if (score >= 90) return "#10b981"; // emerald-500 — 탁월
  if (score >= 75) return "#65a30d"; // lime-600  — 양호
  if (score >= 55) return "#ca8a04"; // yellow-600 — 보통
  if (score >= 35) return "#ea580c"; // orange-600 — 부족
  return "#b91c1c";                  // red-700   — 경고
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
  date: string;
  bucket: "daily" | "weekly";
  isToday: boolean;
}

const LABEL_THRESHOLD = 31; // 막대 이하면 데이터 라벨 노출 (8일/이번달/30일 커버). 주간 모드는 자체적으로 ≤14주.

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

function buildChangeAnalysis(entries: DailyScoreEntry[], todayKey: string): ChangeEvent[] {
  const events: ChangeEvent[] = [];
  for (let i = 1; i < entries.length; i++) {
    const cur = entries[i];
    const prev = entries[i - 1];
    // 오늘은 진행 중이라 partial-day 점수 → 변동 이벤트로 보면 가짜 신호 가능. 제외.
    if (cur.date === todayKey) continue;
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
  const todayKey = new Date().toISOString().slice(0, 10);

  const { chartData, activeDays, totalDays, isWeekly, changeEvents } = useMemo(() => {
    const start = startOfPeriod(period);
    const windowEntries = daily.filter((d) => d.date >= start);
    const allEntries = period === "all" ? daily.filter(() => true) : windowEntries;

    const span = allEntries.length;
    const weekly = period === "all" && span > DOWNSAMPLE_THRESHOLD_DAYS;

    let data: ChartDatum[];

    if (weekly) {
      const buckets = new Map<string, { scores: number[]; firstDate: string; hasToday: boolean }>();
      for (const e of allEntries) {
        if (e.score === null) continue;
        const key = isoWeekKey(new Date(e.date + "T00:00:00Z"));
        const b = buckets.get(key) ?? { scores: [], firstDate: e.date, hasToday: false };
        b.scores.push(e.score);
        if (e.date === todayKey) b.hasToday = true;
        buckets.set(key, b);
      }
      data = [...buckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([wk, b]) => ({
          label: wk.slice(5),
          date: b.firstDate,
          score: Math.round(b.scores.reduce((s, v) => s + v, 0) / b.scores.length),
          bucket: "weekly" as const,
          isToday: b.hasToday,
        }));
    } else {
      data = allEntries.map((e) => ({
        label: fmtDate(e.date),
        date: e.date,
        score: e.score,
        bucket: "daily" as const,
        isToday: e.date === todayKey,
      }));
    }

    const activeDays = allEntries.filter((e) => e.score !== null).length;
    const events = buildChangeAnalysis(allEntries, todayKey);

    return {
      chartData: data,
      activeDays,
      totalDays: allEntries.length,
      isWeekly: weekly,
      changeEvents: events,
    };
  }, [daily, period, todayKey]);

  const lowActivity = totalDays > 0 && activeDays / totalDays < 0.5;
  const showLabels = chartData.length <= LABEL_THRESHOLD;

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
            <BarChart data={chartData} margin={{ top: 18, right: 10, left: -20, bottom: 0 }}>
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
              <Bar dataKey="score" radius={[2, 2, 0, 0]} maxBarSize={28} isAnimationActive={false}>
                {chartData.map((d, i) => {
                  // 오늘 막대 = 진행 중(partial-day) → 점수 색 카테고리에서 분리.
                  // 회색 + 낮은 불투명도로 "완료일과 비교 불가" 시각 메시지.
                  if (d.isToday && !isWeekly) {
                    return <Cell key={i} fill="#525252" fillOpacity={0.5} />;
                  }
                  const fill = d.score === null ? "transparent" : scoreColorHex(d.score);
                  return <Cell key={i} fill={fill} />;
                })}
                {showLabels && (
                  <LabelList
                    dataKey="score"
                    position="top"
                    fontSize={10}
                    fontFamily="monospace"
                    fill="#a3a3a3"
                    formatter={(v) => (v === null || v === undefined ? "" : String(v))}
                  />
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center gap-2.5 text-[10px] font-mono text-neutral-500 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />탁월 90+</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-lime-600" />양호 75–89</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-600" />보통 55–74</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-600" />부족 35–54</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-700" />경고 &lt;35</span>
          {chartData.some((d) => d.isToday) && !isWeekly && (
            <span className="flex items-center gap-1 ml-2 text-neutral-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-neutral-600 opacity-50" /> 오늘 (진행 중 · 비교 제외)
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
