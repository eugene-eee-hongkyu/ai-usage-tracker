"use client";

import { useState } from "react";
import { useMessages } from "@/lib/use-i18n";
import type { Messages } from "@/lib/i18n";

function tmpl(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

function tierOptions(m: Messages): Array<{ value: string; label: string }> {
  return [
    { value: "",               label: m.planHealth.tierUnknown },
    { value: "pro",            label: "Pro ($20/mo)" },
    { value: "max5",           label: "Max 5x ($100/mo)" },
    { value: "max20",          label: "Max 20x ($200/mo)" },
    { value: "team_standard",  label: "Team Standard ($25/mo · annual $20)" },
    { value: "team_premium",   label: "Team Premium ($125/mo · annual $100)" },
    { value: "api",            label: m.planHealth.tierApi },
  ];
}

function tierLabel(t: string, m: Messages): string {
  switch (t) {
    case "pro": return "Pro";
    case "max5": return "Max 5x";
    case "max20": return "Max 20x";
    case "team_standard": return "Team Std";
    case "team_premium": return "Team Prem";
    case "team": return "Team";
    case "api": return "API";
    default: return m.planHealth.tierUnknown;
  }
}

function verdictStyle(verdict: PlanHealthResult["verdict"], m: Messages) {
  switch (verdict) {
    case "downgrade": return { color: "text-sky-300",     bg: "bg-sky-950/40 border-sky-800/60",       icon: "▼",  label: m.planHealth.verdictDowngrade };
    case "fit":       return { color: "text-emerald-300", bg: "bg-emerald-950/30 border-emerald-800/60", icon: "✓",  label: m.planHealth.verdictFit };
    case "tight":     return { color: "text-amber-300",   bg: "bg-amber-950/40 border-amber-800/60",     icon: "▲",  label: m.planHealth.verdictTight };
    case "over":      return { color: "text-rose-300",    bg: "bg-rose-950/40 border-rose-800/60",       icon: "▲▲", label: m.planHealth.verdictOver };
    case "unknown":   return { color: "text-slate-300",   bg: "bg-slate-900 border-slate-800",           icon: "?",  label: m.planHealth.verdictUnknown };
  }
}

// API 응답 PlanHealthResult 와 일치. lib/plan-health.ts 의 PlanHealthResult 와 sync.
export interface PlanHealthResult {
  estimatedTier: "pro" | "max5" | "max20" | "unknown";
  p90Tokens: number;
  blockCount: number;
  activeDays: number;
  declaredTier: "pro" | "max5" | "max20" | "team" | "api" | null;
  declaredLimits: {
    tier: string;
    label: string;
    monthlyPriceUsd: number;
    estimated5hTokenLimit: number;
  } | null;
  utilizationPct: number;
  hitCount: number;
  verdict: "downgrade" | "fit" | "tight" | "over" | "unknown";
  recommendedTier: "pro" | "max5" | "max20" | "team" | "api" | null;
  recommendedSavingsUsd: number;
  actionFirst: boolean;
  reasoning: string[];
  activationPct: number | null;
  totalWindowTokens: number;
  // 캐시 제외 토큰 사용률 — dashboard route 에서 period cacheHitPct 로 분해해 추가.
  nonCacheTotalWindowTokens: number | null;
  realUsagePct: number | null;   // 0~100 cap. null 이면 데이터 부족.
  blockCountInPeriod: number;
  cacheHitPctForPeriod: number | null;
  // period 비례 plan 가치 (UsageHero 단가 계산용)
  priceForPeriod: number | null;
  periodDays: number;
  // declaredLimits 가 null 이면 추정 tier 로 effectiveLimits 채움 + 표시.
  isEstimatedTier?: boolean;
}

export function PlanHealthCard({ planHealth, declaredTier: initialDeclaredTier }: {
  planHealth: PlanHealthResult;
  declaredTier: string | null;
}) {
  const { m } = useMessages();
  const [declaredTier, setDeclaredTier] = useState<string>(initialDeclaredTier ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const TIER_OPTIONS = tierOptions(m);

  const onChangeTier = async (value: string) => {
    setDeclaredTier(value);
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/user/plan-tier", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier: value || null }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        // 새 plan health 분석 결과를 받으려면 페이지 reload — 가장 단순한 방법
        setTimeout(() => window.location.reload(), 500);
      }
    } finally {
      setSaving(false);
    }
  };

  const v = verdictStyle(planHealth.verdict, m);
  const estimatedLabel = tierLabel(planHealth.estimatedTier, m);

  return (
    <div data-testid="plan-health-card" className={`rounded-lg p-4 space-y-3 border ${v.bg}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-200">
          {m.planHealth.cardTitle}
        </p>
        <span className="text-[10px] font-mono text-slate-500">
          {tmpl(m.planHealth.p90Suffix, { n: planHealth.p90Tokens.toLocaleString() })}
        </span>
      </div>

      <div className="text-xs font-mono text-slate-400">
        <span className="text-slate-500">{m.planHealth.autoEstimated}</span>
        <span className="text-slate-200">{estimatedLabel}</span>
        <span className="text-slate-600 ml-2">{tmpl(m.planHealth.estimatedDetails, { blocks: planHealth.blockCount, days: planHealth.activeDays })}</span>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-[11px] font-mono text-slate-500 shrink-0">{m.planHealth.yourTier}</label>
        <select
          data-testid="plan-tier-select"
          value={declaredTier}
          onChange={(e) => onChangeTier(e.target.value)}
          disabled={saving}
          className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded px-2 py-1 font-mono focus:outline-none focus:border-indigo-500"
        >
          {TIER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {saved && <span className="text-emerald-400 text-[10px] font-mono shrink-0">{m.planHealth.saved}</span>}
      </div>

      {planHealth.verdict !== "unknown" && planHealth.declaredLimits && (
        <div className={`text-xs ${v.color} flex items-baseline gap-2 pt-1 border-t border-slate-800/60`}>
          <span className="font-bold">{v.icon}</span>
          <span className="font-medium">{v.label}</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-300">{tmpl(m.planHealth.utilizationLine, { label: planHealth.declaredLimits.label, n: planHealth.utilizationPct })}</span>
          {planHealth.recommendedSavingsUsd > 0 && (
            <>
              <span className="text-slate-500">·</span>
              <span className="text-emerald-400 font-mono">{tmpl(m.planHealth.monthlySavings, { n: planHealth.recommendedSavingsUsd })}</span>
            </>
          )}
          {planHealth.recommendedSavingsUsd < 0 && (
            <>
              <span className="text-slate-500">·</span>
              <span className="text-amber-400 font-mono">{tmpl(m.planHealth.monthlyExtra, { n: Math.abs(planHealth.recommendedSavingsUsd) })}</span>
            </>
          )}
        </div>
      )}

      {planHealth.actionFirst && (
        <div className="text-xs text-amber-300 bg-amber-950/30 border border-amber-800/40 rounded px-2 py-1.5">
          {m.planHealth.actionFirst}
        </div>
      )}

      <details className="text-[11px] font-mono text-slate-500">
        <summary className="cursor-pointer hover:text-slate-300">{m.planHealth.reasoningSummary}</summary>
        <ul className="mt-2 space-y-1 text-slate-400 list-disc list-inside">
          {planHealth.reasoning.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
        <p className="mt-2 text-[10px] text-slate-600">
          {m.planHealth.reasoningFootnote}
        </p>
      </details>
    </div>
  );
}
