"use client";

import { useEffect, useState } from "react";
import {
  POWER_FREQUENCY_TARGET_DAYS,
  targetWorkdaysForPeriod,
  hardworkerThresholdForPeriod,
  computeUnitCostLevel,
  computeTokenLevel,
} from "@/lib/rules";
import { useMessages } from "@/lib/use-i18n";
import type { Messages } from "@/lib/i18n";
import { track, EVENTS } from "@/lib/analytics/mixpanel";

// 사용량 zone hero — Power Index + 토큰 단가 동등 크기 2-card.
// period 비례 정규화 — 30일 anchor 를 기준으로 8days/today/all 어느 윈도우에서도
// 의미 일관. 토큰 단가는 (월 요금 × periodDays/30) / period 토큰 으로 계산.
// 활용지수 frequency 분모도 23 × periodDays/30 으로 비례.

interface UsageHeroProps {
  powerIndex: number;             // 0-100
  activeDays: number;             // period 활성일
  avgDailyTokens: number;
  periodDays: number;             // 1 / 8 / month-current / 30 / 90 등
  periodLabel: string;            // i18n 처리된 라벨 (caller 에서 m.common.today 등 전달)
  declaredTier: string | null;
  declaredTierLabel: string | null;
  priceForPeriod: number | null;  // monthlyPriceUsd × periodDays/30
  totalWindowTokens: number;
  nonCacheTotalWindowTokens: number | null;
  cacheHitPctForPeriod: number | null;
  // viewOnly = 어드민이 멤버 dashboard 봄. tier select / hint 숨기고 read-only 라벨만.
  viewOnly?: boolean;
  // tier 미입력 + activity 0 케이스 — 팝업 메시지 분기.
  // false 이면 tier 입력 권유보다 CLI sync 확인 안내가 우선 actionable.
  hasActivity?: boolean;
  // main 컨테이너 안쪽 (Row 2 위치) 에 카드로 렌더할 때 full-bleed 배경/패딩
  // 제거. dashboard 첫 진입 시 "활용지수/토큰단가" 가 Daily Cost/Plan 절감
  // 아래로 내려가는 새 레이아웃에서 사용.
  embedded?: boolean;
  // Phase 3a-2 (2026-05-30): Codex 탭일 때 활용지수 카드 안에 한 줄로 모델 fallback
  // 카운트 표시. null/undefined 면 Claude 탭 (또는 데이터 없음) — 표시 안 함.
  codexFallbackCount?: number | null;
  // Phase 2 (2026-05-30): provider — modal 옵션 / 저장 컬럼 분기. default 'claude' (호환).
  provider?: "claude" | "codex";
}

function tierOptions(m: Messages, provider: "claude" | "codex"): Array<{ value: string; label: string }> {
  // 첫 옵션은 placeholder (강제 선택 유도) — value="" 일 때 "확인" 버튼 disabled.
  // Phase 2 (2026-05-30): Codex provider 분기. AI 추정 제거 → 사용자 무조건 선택.
  if (provider === "codex") {
    // ChatGPT Free 는 Codex CLI 사용 불가라 의도적으로 제외 (2026-05-30 사용자 결정).
    return [
      { value: "",            label: m.usageHero.tierModalPickPlaceholder },
      { value: "plus",        label: "ChatGPT Plus ($20/mo)" },
      { value: "business",    label: "ChatGPT Business ($30/mo)" },
      { value: "pro",         label: "ChatGPT Pro ($200/mo)" },
      { value: "team",        label: "ChatGPT Team ($30/user/mo)" },
      { value: "enterprise",  label: "Enterprise (협의 · 추정 $200/mo)" },
      { value: "api",         label: "OpenAI API (PAYG)" },
    ];
  }
  return [
    { value: "",               label: m.usageHero.tierModalPickPlaceholder },
    { value: "pro",            label: "Pro ($20/mo)" },
    { value: "max5",           label: "Max 5x ($100/mo)" },
    { value: "max20",          label: "Max 20x ($200/mo)" },
    { value: "team_standard",  label: "Team Standard ($25/mo · annual $20)" },
    { value: "team_premium",   label: "Team Premium ($125/mo · annual $100)" },
    { value: "api",            label: m.usageHero.tierApi },
  ];
}

function fmtTokens(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtCostPerMTok(usdPerMTok: number): string {
  if (!Number.isFinite(usdPerMTok)) return "—";
  if (usdPerMTok >= 10) return `$${usdPerMTok.toFixed(1)}`;
  if (usdPerMTok >= 1) return `$${usdPerMTok.toFixed(2)}`;
  if (usdPerMTok >= 0.01) return `$${usdPerMTok.toFixed(3)}`;
  return `$${usdPerMTok.toFixed(4)}`;
}

function fmtPrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return `$${n}`;
  return `$${n.toFixed(2)}`;
}

// 문자열 내 {key} 치환.
function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

function powerGrade(score: number, m: Messages): { label: string; color: string } {
  if (score >= 80) return { label: m.grades.exemplary, color: "text-emerald-400" };
  if (score >= 60) return { label: m.grades.good, color: "text-lime-400" };
  if (score >= 40) return { label: m.grades.moderate, color: "text-yellow-400" };
  if (score >= 20) return { label: m.grades.low, color: "text-orange-400" };
  return { label: m.grades.start, color: "text-rose-400" };
}

function unitCostGradeFromLevel(level: number, m: Messages): { label: string; color: string } {
  if (level >= 9) return { label: m.grades.exemplary, color: "text-emerald-400" };
  if (level >= 7) return { label: m.grades.good, color: "text-lime-400" };
  if (level >= 5) return { label: m.grades.moderate, color: "text-yellow-400" };
  if (level >= 3) return { label: m.grades.low, color: "text-orange-400" };
  return { label: m.grades.unused, color: "text-rose-400" };
}

// 사용량 11단계 — 위가 높은 점수 (best).
function tokenLevelRows(m: Messages, perDay: string): Array<{ level: number; range: string; anchor?: string }> {
  return [
    { level: 10, range: `> 300M${perDay}` },
    { level: 9,  range: `≤ 300M${perDay}` },
    { level: 8,  range: `≤ 150M${perDay}` },
    { level: 7,  range: `≤ 80M${perDay}` },
    { level: 6,  range: `≤ 40M${perDay}`, anchor: m.usageHero.tokenLevelAnchorEnterprise },
    { level: 5,  range: `≤ 25M${perDay}` },
    { level: 4,  range: `≤ 15M${perDay}`, anchor: m.usageHero.tokenLevelAnchorAnthropicP90 },
    { level: 3,  range: `≤ 8M${perDay}`,  anchor: m.usageHero.tokenLevelAnchorAnthropicAvg },
    { level: 2,  range: `≤ 3M${perDay}` },
    { level: 1,  range: `≤ 1M${perDay}` },
    { level: 0,  range: m.usageHero.tokenLevelNoActivity },
  ];
}

// 토큰 단가 10단계 — anchor 는 "동일 토큰을 API 직접 호출했을 때 비용" 대비.
function unitCostLevelRows(m: Messages): Array<{ level: number; range: string; anchor?: string }> {
  return [
    { level: 10, range: "≤ $0.003 / 1M", anchor: m.usageHero.unitCostAnchorPlanX1000 },
    { level: 9,  range: "≤ $0.01 / 1M",  anchor: m.usageHero.unitCostAnchorPlanX300 },
    { level: 8,  range: "≤ $0.03 / 1M",  anchor: m.usageHero.unitCostAnchorPlanX100Heavy },
    { level: 7,  range: "≤ $0.1 / 1M",   anchor: m.usageHero.unitCostAnchorPlanX30 },
    { level: 6,  range: "≤ $0.3 / 1M",   anchor: m.usageHero.unitCostAnchorPlanX10CacheRead },
    { level: 5,  range: "≤ $1 / 1M",     anchor: m.usageHero.unitCostAnchorPlanX3 },
    { level: 4,  range: "≤ $3 / 1M",     anchor: m.usageHero.unitCostAnchorEqualApi },
    { level: 3,  range: "≤ $10 / 1M",    anchor: m.usageHero.unitCostAnchorWasted3x },
    { level: 2,  range: "≤ $30 / 1M",    anchor: m.usageHero.unitCostAnchorWasted10x },
    { level: 1,  range: "> $30 / 1M",    anchor: m.usageHero.unitCostAnchorWastedHeavy },
    { level: 0,  range: m.usageHero.unitCostNoData },
  ];
}

export function UsageHero({
  powerIndex,
  activeDays,
  avgDailyTokens,
  periodDays,
  periodLabel,
  declaredTier,
  declaredTierLabel,
  priceForPeriod,
  totalWindowTokens,
  hasActivity = true,
  nonCacheTotalWindowTokens,
  cacheHitPctForPeriod,
  viewOnly = false,
  embedded = false,
  provider = "claude",
  codexFallbackCount = null,
}: UsageHeroProps) {
  const { m } = useMessages();
  const power = powerGrade(powerIndex, m);
  const hardworkerThreshold = hardworkerThresholdForPeriod(periodDays);
  const targetWorkdays = targetWorkdaysForPeriod(periodDays);
  const isHardworker = periodDays >= 8 && activeDays >= hardworkerThreshold;
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const canShowUnitCost =
    priceForPeriod !== null && priceForPeriod > 0 && totalWindowTokens > 0;
  const usdPerMTok = canShowUnitCost
    ? (priceForPeriod! / totalWindowTokens) * 1_000_000
    : 0;
  const unitLevel = canShowUnitCost ? computeUnitCostLevel(usdPerMTok) : 0;
  const unitGrade = canShowUnitCost ? unitCostGradeFromLevel(unitLevel, m) : null;

  const [tierValue, setTierValue] = useState<string>(declaredTier ?? "");
  const [saving, setSaving] = useState(false);
  const [tierHintOpen, setTierHintOpen] = useState(false);

  const [tierModalOpen, setTierModalOpen] = useState(false);
  // declaredTier prop 이 mount 후 바뀌어도 (예: API refetch 후 null 로 update)
  // tierValue 가 stale 한 max20 같은 값 안 잡고 있도록 sync. placeholder 표시 보장.
  useEffect(() => {
    setTierValue(declaredTier ?? "");
  }, [declaredTier]);
  // 추정 사용자에게 항상 표시 — localStorage dismissed 플래그 제거.
  // tier 실제 선택하면 declaredTier 가 non-null 이 되어 자동으로 안 뜸.
  useEffect(() => {
    if (viewOnly) return;
    if (declaredTier && declaredTier !== "") return;
    setTierModalOpen(true);
  }, [viewOnly, declaredTier]);
  // 명시 선택 후 저장 — placeholder ("") 면 호출 금지 (버튼 disabled 가 1차 방어).
  const saveTier = async () => {
    if (!tierValue) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/plan-tier", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier: tierValue, provider }),
      });
      if (res.ok) {
        setTimeout(() => window.location.reload(), 300);
      }
    } finally {
      setSaving(false);
    }
  };
  // Inline tier select (모달 밖, hero panel 안) — 이미 tier 입력된 사용자가
  // 변경할 때 사용. 즉시 저장 + reload (기존 동작 유지).
  const onChangeTier = async (value: string) => {
    setTierValue(value);
    setSaving(true);
    try {
      const res = await fetch("/api/user/plan-tier", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier: value || null, provider }),
      });
      if (res.ok) {
        setTimeout(() => window.location.reload(), 300);
      }
    } finally {
      setSaving(false);
    }
  };

  const TIER_OPTIONS = tierOptions(m, provider);
  const perDayUnit = m.common.perDay;
  const TOKEN_LEVEL_ROWS = tokenLevelRows(m, perDayUnit);
  const UNIT_COST_LEVEL_ROWS = unitCostLevelRows(m);
  const daysSfx = m.common.daysSuffix;

  return (
    <>
    {tierModalOpen && (
      <div
        data-testid="tier-modal-overlay"
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
      >
        <div
          data-testid="tier-modal-card"
          className="bg-neutral-900 border-2 border-yellow-500/70 rounded-lg shadow-2xl max-w-md w-full p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <span className="text-3xl">{hasActivity ? "📊" : "🔌"}</span>
            <h2 className="text-lg font-mono font-bold text-yellow-300">{m.usageHero.tierModalTitle}</h2>
          </div>
          <p className="text-sm font-mono text-neutral-300 leading-relaxed">
            {hasActivity ? m.usageHero.tierModalLead : m.usageHero.tierModalLeadNoActivity}
          </p>
          <div className="space-y-2">
            <label className="text-xs font-mono text-neutral-500 block">{m.usageHero.tierModalSelectLabel}</label>
            <select
              data-testid="tier-modal-select"
              value={tierValue}
              onChange={(e) => setTierValue(e.target.value)}
              disabled={saving}
              className="w-full bg-neutral-800 border border-neutral-700 text-neutral-100 text-sm font-mono rounded px-3 py-2 focus:outline-none focus:border-yellow-500"
            >
              {TIER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {provider === "codex" ? (
            <div className="text-xs font-mono text-neutral-400 bg-neutral-950 border border-neutral-800 rounded p-3 space-y-1.5 leading-relaxed">
              <p className="text-neutral-300">정확한 가격·한도가 헷갈리면 OpenAI billing 페이지에서 직접 확인하세요.</p>
              <p>
                <a
                  href="https://platform.openai.com/account/billing/overview"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-300 underline hover:text-yellow-200"
                >platform.openai.com/account/billing</a>
                <span className="text-neutral-600"> — OpenAI API / ChatGPT 구독 상태</span>
              </p>
              <p className="text-neutral-500">OpenAI 가 가격·한도를 자주 조정하므로 본 화면 정보는 참고용. 실제 결제 정보 우선.</p>
            </div>
          ) : (
            <div className="text-xs font-mono text-neutral-400 bg-neutral-950 border border-neutral-800 rounded p-3 space-y-1 leading-relaxed">
              <p className="text-neutral-300">{m.usageHero.tierModalHintToggle}</p>
              <p>{m.usageHero.tierModalStep1.split("{claudeAi}").map((part, i, arr) => (
                i < arr.length - 1
                  ? <span key={i}>{part}<span className="text-neutral-200">claude.ai</span></span>
                  : <span key={i}>{part.split("{sub}").map((p2, j, arr2) => j < arr2.length - 1 ? <span key={j}>{p2}<span className="text-neutral-200">Subscription</span></span> : <span key={j}>{p2}</span>)}</span>
              ))}</p>
              <p>{m.usageHero.tierModalStep2.split("{cmd}").map((part, i, arr) => (
                i < arr.length - 1
                  ? <span key={i}>{part}<span className="text-neutral-200">claude</span></span>
                  : <span key={i}>{part.split("{slash}").map((p2, j, arr2) => j < arr2.length - 1 ? <span key={j}>{p2}<span className="text-neutral-200">/usage</span></span> : <span key={j}>{p2}</span>)}</span>
              ))}</p>
              <p>{m.usageHero.tierModalStep3}</p>
              <p className="pt-1 border-t border-neutral-800 mt-2">
                <a
                  href="https://console.anthropic.com/settings/billing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-300 underline hover:text-yellow-200"
                >console.anthropic.com/settings/billing</a>
                <span className="text-neutral-600"> — API tier 결제 정보</span>
              </p>
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              data-testid="tier-modal-confirm"
              onClick={saveTier}
              disabled={!tierValue || saving}
              className="text-sm font-mono font-bold bg-yellow-500 hover:bg-yellow-400 text-neutral-900 px-5 py-2 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-yellow-500"
            >
              {m.usageHero.tierModalConfirm}
            </button>
          </div>
        </div>
      </div>
    )}
    <div
      data-testid="dash-usage-hero"
      className={embedded ? "" : "bg-neutral-950 border-b border-neutral-800"}
    >
      <div className={embedded ? "" : "max-w-6xl mx-auto px-4 py-5"}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Power Index */}
          <div data-testid="usage-hero-power" data-track-dwell="power_index" className="bg-neutral-900 border-l-2 border-l-cyan-500 border border-neutral-800 rounded p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">{m.usageHero.powerLabel}</span>
                <span className="text-[12px] font-mono text-neutral-600">{m.common.powerIndexShort} · {periodLabel}</span>
              </div>
              <button
                type="button"
                data-testid="usage-hero-power-info"
                onClick={() => {
                  if (!breakdownOpen) track(EVENTS.INFO_CLICK, { screen: "dashboard", target: "power_index_score" });
                  setBreakdownOpen((v) => !v);
                }}
                className="text-[11px] font-mono text-neutral-500 hover:text-cyan-300 border border-neutral-700 hover:border-cyan-500/60 rounded px-1.5 py-0.5 transition-colors"
                title={m.usageHero.powerInfoTooltip}
              >
                {breakdownOpen ? m.usageHero.powerInfoTitleOpen : m.usageHero.powerInfoTitleClosed}
              </button>
            </div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-5xl font-bold tabular-nums text-cyan-300 leading-none">{powerIndex}</span>
              <span className="text-sm text-neutral-500 font-mono">/ 100</span>
              <span className={`text-sm font-mono font-bold ml-1 ${power.color}`}>{power.label}</span>
              {isHardworker && (
                <span
                  data-testid="usage-hero-hardworker"
                  className="text-[10px] font-mono font-bold text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded px-1.5 py-0.5"
                  title={fmt(m.usageHero.hardworkerTooltip, { period: periodLabel, n: Math.round(hardworkerThreshold) })}
                >
                  {m.usageHero.hardworkerBadge}
                </span>
              )}
            </div>
            <div className="mt-3 text-xs font-mono text-neutral-500 space-y-0.5">
              <p>
                {m.common.activeShort} <span className="text-neutral-300">{activeDays}/{periodDays}{daysSfx}</span>
                {" · "}{m.common.dailyAvg} <span className="text-neutral-300">{fmtTokens(Math.round(avgDailyTokens))}</span> {m.common.tokens}
              </p>
              <p className="text-[12px] text-neutral-600">{m.usageHero.powerFormula}</p>
              {/* Phase 3a-2: Codex 탭일 때 활용지수 카드 안 한 줄로 모델 fallback 정보. */}
              {codexFallbackCount != null && (
                <p className="text-[12px] text-amber-400/80" title="OpenAI overload 등으로 의도한 모델 안 받고 다른 모델로 라우팅된 횟수">
                  🔁 모델 fallback <span className="text-amber-300">{codexFallbackCount.toLocaleString()}회</span>
                </p>
              )}
            </div>

            {breakdownOpen && (() => {
              const frequencyScore = Math.round(Math.min(1, activeDays / targetWorkdays) * 40);
              const tokenLevel = computeTokenLevel(avgDailyTokens);
              const targetStr = targetWorkdays.toFixed(targetWorkdays >= 10 ? 0 : 1);
              const hwStr = hardworkerThreshold.toFixed(hardworkerThreshold >= 10 ? 0 : 1);
              return (
                <div data-testid="usage-hero-power-breakdown" className="mt-3 pt-3 border-t border-neutral-800 space-y-3 text-[13px] font-mono">
                  <div>
                    <p className="text-cyan-400 mb-1">{m.usageHero.breakdownActiveTitle}</p>
                    <p className="text-neutral-400 leading-relaxed">
                      <span className="text-neutral-200">{fmt(m.usageHero.breakdownActiveFormula, { target: targetStr })}</span>
                      <span className="text-neutral-600"> {fmt(m.usageHero.breakdownActiveNote, { period: periodLabel, anchor: POWER_FREQUENCY_TARGET_DAYS })}</span>
                    </p>
                    <p className="text-neutral-500 mt-0.5">
                      {fmt(m.usageHero.breakdownActiveMaxLine, { target: targetStr })}
                      {periodDays >= 8 && fmt(m.usageHero.breakdownActiveHardworkerSuffix, { n: hwStr })}
                    </p>
                    <div className="mt-1.5 pl-3 -ml-1.5 border-l-2 border-l-cyan-500 bg-cyan-900/20 py-0.5">
                      <span className="text-cyan-300 font-bold">
                        {fmt(m.usageHero.breakdownMyLine, { a: activeDays, p: periodDays, s: frequencyScore })}
                      </span>
                      {isHardworker && <span className="text-rose-300 ml-2">🔥</span>}
                    </div>
                  </div>
                  <div>
                    <p className="text-cyan-400 mb-1">{m.usageHero.breakdownUsageTitle}</p>
                    <div className="space-y-0.5">
                      {TOKEN_LEVEL_ROWS.map((r) => {
                        const isCurrent = r.level === tokenLevel;
                        return (
                          <div
                            key={r.level}
                            className={`flex items-center gap-2 ${isCurrent ? "bg-cyan-900/30 border-l-2 border-l-cyan-500 pl-1.5 -ml-1.5" : "text-neutral-400"}`}
                          >
                            <span className={`w-10 ${isCurrent ? "text-cyan-300 font-bold" : "text-neutral-500"}`}>
                              {r.level * 6}{m.common.points}
                            </span>
                            <span className={`w-28 ${isCurrent ? "text-cyan-200 font-bold" : "text-neutral-200"}`}>
                              {r.range}
                            </span>
                            {r.anchor && (
                              <span className={`text-[10px] ${isCurrent ? "text-cyan-400" : "text-neutral-600"}`}>
                                {r.anchor}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-neutral-600 mt-1">{m.usageHero.breakdownUsageCache}</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 우측 카드 — 토큰 단가. */}
          <div data-testid="usage-hero-unit-cost" className="bg-neutral-900 border-l-2 border-l-yellow-500 border border-neutral-800 rounded p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold text-yellow-400 uppercase tracking-wider">{m.usageHero.unitCostLabel}</span>
                <span className="text-[12px] font-mono text-neutral-600">{fmt(m.usageHero.unitCostSubtitle, { period: periodLabel })}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {viewOnly ? (
                  <span data-testid="plan-tier-readonly" className="bg-neutral-800 border border-neutral-700 text-neutral-300 text-[11px] font-mono rounded px-1.5 py-0.5">
                    {declaredTierLabel ?? m.usageHero.tierReadonlyNoTier}
                  </span>
                ) : (
                  <select
                    data-testid="plan-tier-select"
                    value={tierValue}
                    onChange={(e) => onChangeTier(e.target.value)}
                    disabled={saving}
                    className="bg-neutral-800 border border-neutral-700 text-neutral-200 text-[11px] font-mono rounded px-1.5 py-0.5 focus:outline-none focus:border-yellow-500"
                    title={m.usageHero.tierTitleTooltip}
                  >
                    {TIER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  data-testid="usage-hero-unit-info"
                  onClick={() => {
                    if (!breakdownOpen) track(EVENTS.INFO_CLICK, { screen: "dashboard", target: "unit_cost_score" });
                    setBreakdownOpen((v) => !v);
                  }}
                  className="text-[11px] font-mono text-neutral-500 hover:text-yellow-300 border border-neutral-700 hover:border-yellow-500/60 rounded px-1.5 py-0.5 transition-colors"
                  title={m.usageHero.powerInfoTooltip}
                >
                  {breakdownOpen ? m.usageHero.powerInfoTitleOpen : m.usageHero.powerInfoTitleClosed}
                </button>
              </div>
            </div>

            {!viewOnly && (
              <div className="-mt-1 mb-2 text-[10px] font-mono">
                <button
                  type="button"
                  data-testid="usage-hero-tier-hint"
                  onClick={() => {
                    if (!tierHintOpen) track(EVENTS.INFO_CLICK, { screen: "dashboard", target: "find_my_tier" });
                    setTierHintOpen((v) => !v);
                  }}
                  className="text-neutral-500 hover:text-yellow-300 transition-colors"
                >
                  {tierHintOpen ? m.usageHero.tierHintCloseLabel : m.usageHero.tierHintOpenLabel}
                </button>
                {tierHintOpen && (
                  <div data-testid="usage-hero-tier-hint-body" className="mt-1.5 pl-3 border-l-2 border-l-neutral-800 space-y-0.5 text-neutral-400 leading-relaxed">
                    <p>{m.usageHero.tierHintStep1Prefix}</p>
                    <p>{m.usageHero.tierHintStep2Prefix}</p>
                    <p>{m.usageHero.tierHintStep3}</p>
                  </div>
                )}
              </div>
            )}

            {!canShowUnitCost ? (
              <div className="space-y-1">
                <span className="text-2xl font-bold text-neutral-500 font-mono">—</span>
                <p className="text-xs font-mono text-neutral-500">
                  {priceForPeriod === null
                    ? (viewOnly ? m.usageHero.tierMemberNoTier : m.usageHero.tierSelectPrompt)
                    : priceForPeriod === 0
                      ? m.usageHero.tierApiNoPrice
                      : fmt(m.usageHero.periodTokenInsufficient, { period: periodLabel })}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-4xl font-bold tabular-nums text-yellow-300 leading-none">{fmtCostPerMTok(usdPerMTok)}</span>
                  <span className="text-sm text-neutral-500 font-mono">/ 1M tokens</span>
                  {unitGrade && (
                    <>
                      <span className={`text-sm font-mono font-bold ml-1 ${unitGrade.color}`}>
                        {unitGrade.label}
                      </span>
                      <span className="text-[12px] font-mono text-neutral-500">
                        L{unitLevel} / 10
                      </span>
                    </>
                  )}
                </div>
                <div className="mt-3 text-xs font-mono text-neutral-500 space-y-0.5">
                  <p>
                    <span className="text-neutral-300">{declaredTierLabel ?? "—"}</span>
                    <span className="text-neutral-600"> · {periodLabel} {fmtPrice(priceForPeriod!)}</span>
                  </p>
                  <p>
                    {periodLabel}: <span className="text-neutral-300">{fmtTokens(totalWindowTokens)}</span> {m.common.tokens}
                  </p>
                  {nonCacheTotalWindowTokens !== null && (
                    <p data-testid="usage-hero-real-usage" className="pt-1 border-t border-neutral-800/60 mt-1">
                      <span className="text-neutral-600">
                        non-cache <span className="text-neutral-400">{fmtTokens(nonCacheTotalWindowTokens)}</span>
                        {cacheHitPctForPeriod !== null && (
                          <> · cache hit {cacheHitPctForPeriod.toFixed(1)}%</>
                        )}
                      </span>
                    </p>
                  )}
                  <p className="text-[12px] text-neutral-600">
                    {m.usageHero.sonnetAnchorHint}
                  </p>
                </div>
              </>
            )}

            {breakdownOpen && (
              <div data-testid="usage-hero-unit-breakdown" className="mt-3 pt-3 border-t border-neutral-800 space-y-2 text-[13px] font-mono">
                <p className="text-yellow-400">{m.usageHero.unitCostBreakdownTitle}</p>
                <div className="space-y-0.5">
                  {UNIT_COST_LEVEL_ROWS.map((r) => {
                    const isCurrent = canShowUnitCost && r.level === unitLevel;
                    return (
                      <div
                        key={r.level}
                        className={`flex items-center gap-2 ${isCurrent ? "bg-yellow-900/30 border-l-2 border-l-yellow-500 pl-1.5 -ml-1.5" : ""}`}
                      >
                        <span className={`w-10 ${isCurrent ? "text-yellow-300 font-bold" : "text-neutral-500"}`}>
                          L{r.level}
                        </span>
                        <span className={`w-32 ${isCurrent ? "text-yellow-200 font-bold" : "text-neutral-200"}`}>
                          {r.range}
                        </span>
                        {r.anchor && (
                          <span className={`text-[10px] ${isCurrent ? "text-yellow-400" : "text-neutral-600"}`}>
                            {r.anchor}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="text-neutral-600 space-y-1 leading-relaxed">
                  <p>
                    <span className="text-neutral-300">{m.usageHero.unitCostReadingTitle}</span>: {m.usageHero.unitCostReadingBody}
                  </p>
                  <p className="text-neutral-500">
                    <span className="text-neutral-400">{m.usageHero.unitCostModelTitle}</span>: {m.usageHero.unitCostModelBody}
                  </p>
                  <p className="text-neutral-500">
                    <span className="text-neutral-400">{m.usageHero.unitCostExternalAnchorTitle}</span>: {m.usageHero.unitCostExternalAnchorBody}
                  </p>
                  <p className="text-neutral-600">
                    {m.usageHero.unitCostBoundaryNote}
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
    </>
  );
}

