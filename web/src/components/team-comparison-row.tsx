// /platform-admin/all-teams 행 단위 컴포넌트.
// 팀당 4개 위젯만 렌더: 활용지수(hero) · 업계비교 · cost(멤버별) · by-member(stacked cost).
// team-view.tsx 의 const block 4개를 복붙해서 독립화. teamName 은 prop.
// session 의존(예: "← 나" 표시) 제거 — 어드민 비교 화면이라 무의미.

"use client";

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { TeamUsageHero } from "@/components/team-usage-hero";
import { useMessages } from "@/lib/use-i18n";
import type { Messages } from "@/lib/i18n";

type Period = "today" | "8days" | "month" | "30days" | "all";

const MEMBER_COLORS = [
  "#4f46e5", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
];

function memberLabel(key: string): string {
  return key.replace(/__\d+$/, "");
}

function fmtDate(d: string): string {
  const m = d.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${parseInt(m[1])}/${parseInt(m[2])}` : d;
}

function tmpl(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

function periodLabelFn(p: Period, m: Messages): string {
  switch (p) {
    case "today":  return m.common.today;
    case "8days":  return m.common.eightDays;
    case "month":  return m.common.thisMonth;
    case "30days": return m.common.thirtyDays;
    case "all":    return m.common.all;
  }
}

interface MemberStat {
  userId: number;
  tokenId: number | null;
  deviceLabel: string | null;
  name: string;
  totalCost: number;
  totalTokens: number;
  sessionsCount: number;
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

export interface TeamRowData {
  byEfficiency: MemberStat[];
  memberNames: string[];
  dailyByMember: Array<Record<string, number | string>>;
  industryComparison?: IndustryComparison;
  teamUsage?: {
    periodDays: number;
    powerIndex: number;
    activeMembers: number;
    avgActiveDays: number;
    avgDailyTokens: number;
    priceForPeriodSum: number | null;
    totalWindowTokensSum: number;
  };
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

export function TeamComparisonRow({
  teamName,
  data,
  period,
}: {
  teamName: string;
  data: TeamRowData;
  period: Period;
}) {
  const { m: t } = useMessages();

  const members = data.byEfficiency;
  const byCost = [...members].sort((a, b) => b.totalCost - a.totalCost);
  const maxCost = Math.max(...byCost.map((m) => m.totalCost), 0.01);

  const heroBlock = data.teamUsage ? (
    <TeamUsageHero
      powerIndex={data.teamUsage.powerIndex}
      activeMembers={data.teamUsage.activeMembers}
      avgActiveDays={data.teamUsage.avgActiveDays}
      avgDailyTokens={data.teamUsage.avgDailyTokens}
      periodDays={data.teamUsage.periodDays}
      periodLabel={periodLabelFn(period, t)}
      priceForPeriodSum={data.teamUsage.priceForPeriodSum}
      totalWindowTokensSum={data.teamUsage.totalWindowTokensSum}
    />
  ) : (
    <div className="bg-neutral-900 border border-neutral-800 rounded p-4 text-xs font-mono text-neutral-500">
      활용지수 데이터 없음
    </div>
  );

  // 업계 비교 — team-view.tsx headlineBlock 의 복붙. teamName 은 prop.
  const headlineBlock = data.industryComparison && data.industryComparison.activeDayCount > 0 ? (() => {
    const ic = data.industryComparison!;
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
      { label: tmpl(t.teamView.teamLabel, { team: teamName }), value: ic.activeDayAvg, star: true },
    ];
    return (
      <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-emerald-500 rounded">
        <div className="px-3 py-2 border-b border-neutral-800">
          <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
            {tmpl(t.teamView.headlineTitle, { team: teamName })}
          </span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-3xl font-mono font-bold text-emerald-400">
              {multiplier.toFixed(1)}<span className="text-xl ml-0.5">x</span>
            </span>
            <span className="text-[11px] font-mono text-neutral-400">
              {tmpl(t.teamView.vsEnterpriseAvg, { n: enterpriseAvg })}
            </span>
          </div>
          <div>
            <div className="text-[10px] font-mono text-neutral-500 mb-1.5 uppercase tracking-wider">
              {t.teamView.perActiveDayCompare}
            </div>
            <div className="space-y-1 text-[11px] font-mono">
              {bulletRows.map((row) => (
                <div key={row.label} className="flex items-center gap-2">
                  <span className={`w-28 shrink-0 truncate ${row.star ? "text-emerald-300 font-bold" : row.benchmark ? "text-yellow-300" : "text-neutral-400"}`}>
                    {row.star && "★ "}{row.label}
                  </span>
                  <div className="flex-1 h-2 bg-neutral-800 rounded overflow-hidden relative min-w-0">
                    <div
                      className={`h-full rounded ${row.star ? "bg-emerald-500" : row.benchmark ? "bg-yellow-500/70" : "bg-neutral-600"}`}
                      style={{ width: `${Math.min(100, (row.value / bulletMax) * 100)}%` }}
                    />
                  </div>
                  <span className={`w-12 text-right tabular-nums shrink-0 ${row.star ? "text-emerald-300 font-bold" : "text-neutral-400"}`}>
                    {fmt(row.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  })() : (
    <div className="bg-neutral-900 border border-neutral-800 rounded p-4 text-xs font-mono text-neutral-500">
      업계 비교 데이터 없음
    </div>
  );

  // Cost — 멤버별 cost 막대. team-view.tsx costBlock 복붙, "← 나" 제거.
  const costBlock = (
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
            const idx = members.findIndex((x) => x.userId === m.userId && x.tokenId === m.tokenId);
            return (
              <div
                key={`${m.userId}-${m.tokenId ?? "null"}`}
                className="flex items-center gap-1.5 text-xs font-mono"
              >
                <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${(m.totalCost / maxCost) * 100}%`,
                      background: MEMBER_COLORS[idx % MEMBER_COLORS.length],
                    }}
                  />
                </div>
                <span className="flex-1 text-neutral-300 truncate">
                  {m.name}{m.deviceLabel ? ` · ${m.deviceLabel}` : ""}
                </span>
                <span className="w-16 text-yellow-400 text-right tabular-nums">${m.totalCost.toFixed(2)}</span>
                <span className="w-12 text-neutral-600 text-right tabular-nums">{m.sessionsCount}s</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // By Member (cost) — 일별 stacked area. team-view.tsx byMemberBlock 복붙.
  // gradient id 가 페이지 내 unique 해야 — teamName slug 로 prefix.
  const slug = teamName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const byMemberBlock = (
    <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-cyan-500 rounded">
      <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between flex-wrap gap-1">
        <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">By Member (cost)</span>
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
                <linearGradient key={key} id={`grad-${slug}-${i}`} x1="0" y1="0" x2="0" y2="1">
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
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={MEMBER_COLORS[i % MEMBER_COLORS.length]}
                strokeWidth={1.5}
                fill={`url(#grad-${slug}-${i})`}
                dot={(data.dailyByMember ?? []).length === 1
                  ? { r: 3, fill: MEMBER_COLORS[i % MEMBER_COLORS.length], stroke: "none" }
                  : false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <section className="space-y-3" data-testid={`team-row-${slug}`}>
      <header className="flex items-baseline gap-3 border-b border-neutral-800 pb-2">
        <h2 className="text-lg font-bold text-slate-100">{teamName}</h2>
        {data.teamUsage && (
          <span className="text-xs font-mono text-neutral-500">
            활용지수 <span className="text-emerald-400 font-bold">{data.teamUsage.powerIndex.toFixed(1)}</span>
            <span className="text-neutral-700 mx-2">·</span>
            활성 {data.teamUsage.activeMembers}명
          </span>
        )}
      </header>

      {/* Row 1: hero + headline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {heroBlock}
        {headlineBlock}
      </div>

      {/* Row 2: cost (멤버별) + by-member stacked area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {costBlock}
        {byMemberBlock}
      </div>
    </section>
  );
}
