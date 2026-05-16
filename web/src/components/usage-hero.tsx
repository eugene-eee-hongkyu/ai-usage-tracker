"use client";

import { useState } from "react";
import {
  POWER_FREQUENCY_TARGET_DAYS,
  POWER_HARDWORKER_THRESHOLD_DAYS,
} from "@/lib/rules";

// 사용량 zone hero — Power Index + 토큰 단가 동등 크기 2-card.
// 둘 다 30일 anchor (period 무관). Plan Health 와 같은 윈도우.
//
// 토큰 단가 = monthlyPriceUsd / totalWindowTokens × 1M.
// 이전 "Plan 활용률" 은 totalWindowTokens 가 cache_read 포함이라 5h 한도와
// 직접 비교 시 100% 를 훌쩍 넘어 무의미. cost-per-token (API 단가 대비
// leverage) 로 재해석해 의미 있는 지표로 전환.

interface UsageHeroProps {
  powerIndex: number;             // 0-100
  activeDays: number;             // 0-30
  avgDailyTokens: number;
  // Plan 단가 계산용
  declaredTier: string | null;     // "max20" 등 (DB 값)
  declaredTierLabel: string | null; // "Max 20x" 등 (표시용)
  monthlyPriceUsd: number | null;  // null 이면 단가 계산 불가
  totalWindowTokens: number;        // 30일 누적 token
}

const TIER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "",       label: "잘 모름 (자동 추정)" },
  { value: "pro",    label: "Pro ($20/mo)" },
  { value: "max5",   label: "Max 5x ($100/mo)" },
  { value: "max20",  label: "Max 20x ($200/mo)" },
  { value: "team",   label: "Team ($30/mo)" },
  { value: "api",    label: "API (종량제)" },
];

function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtCostPerMTok(usdPerMTok: number): string {
  if (usdPerMTok >= 10) return `$${usdPerMTok.toFixed(1)}`;
  if (usdPerMTok >= 1) return `$${usdPerMTok.toFixed(2)}`;
  if (usdPerMTok >= 0.01) return `$${usdPerMTok.toFixed(3)}`;
  return `$${usdPerMTok.toFixed(4)}`;
}

function powerGrade(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "탁월", color: "text-emerald-400" };
  if (score >= 60) return { label: "양호", color: "text-lime-400" };
  if (score >= 40) return { label: "보통", color: "text-yellow-400" };
  if (score >= 20) return { label: "낮음", color: "text-orange-400" };
  return { label: "시작", color: "text-rose-400" };
}

// 토큰 단가 grade — Anthropic Sonnet API input 가격 ($3 / 1M) anchor.
// 단가가 낮을수록 cache leverage 가 크고 plan 효율적.
//   ≤ $0.03 / 1M ≈ Sonnet API 100× 저렴 → 탁월
//   ≤ $0.30 / 1M ≈ Sonnet API 10× 저렴 → 양호
//   ≤ $3.00 / 1M ≈ Sonnet API 동급 → 보통
//   > $3.00 / 1M → 낮음 (plan 이 안 뽑힘 = 사용량 부족 or 비싼 plan)
function unitCostGrade(usdPerMTok: number): { label: string; color: string } {
  if (usdPerMTok <= 0.03) return { label: "탁월", color: "text-emerald-400" };
  if (usdPerMTok <= 0.3) return { label: "양호", color: "text-lime-400" };
  if (usdPerMTok <= 3) return { label: "보통", color: "text-yellow-400" };
  return { label: "낮음", color: "text-amber-400" };
}

// computeTokenLevel breakpoints — Depth 점수 산정표 (UI 표시용).
// lib/rules/index.ts 의 computeTokenLevel 과 sync 유지 필수.
const TOKEN_LEVEL_ROWS: Array<{ level: number; range: string; anchor?: string }> = [
  { level: 0,  range: "활동 없음" },
  { level: 1,  range: "≤ 1M / 일" },
  { level: 2,  range: "≤ 3M / 일" },
  { level: 3,  range: "≤ 8M / 일", anchor: "Anthropic 평균" },
  { level: 4,  range: "≤ 15M / 일", anchor: "Anthropic P90 (개인)" },
  { level: 5,  range: "≤ 25M / 일" },
  { level: 6,  range: "≤ 40M / 일", anchor: "Enterprise P90" },
  { level: 7,  range: "≤ 80M / 일" },
  { level: 8,  range: "≤ 150M / 일" },
  { level: 9,  range: "≤ 300M / 일" },
  { level: 10, range: "> 300M / 일" },
];

export function UsageHero({
  powerIndex,
  activeDays,
  avgDailyTokens,
  declaredTier,
  declaredTierLabel,
  monthlyPriceUsd,
  totalWindowTokens,
}: UsageHeroProps) {
  const power = powerGrade(powerIndex);
  const isHardworker = activeDays >= POWER_HARDWORKER_THRESHOLD_DAYS;
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // 토큰 단가 — monthlyPriceUsd 와 totalWindowTokens 둘 다 있어야 계산.
  // API tier (price=0) 면 의미 없음, totalWindowTokens=0 도 N/A.
  const canShowUnitCost =
    monthlyPriceUsd !== null && monthlyPriceUsd > 0 && totalWindowTokens > 0;
  const usdPerMTok = canShowUnitCost
    ? (monthlyPriceUsd! / totalWindowTokens) * 1_000_000
    : 0;
  const unitGrade = canShowUnitCost ? unitCostGrade(usdPerMTok) : null;

  // Tier 변경 — PATCH /api/user/plan-tier + reload.
  const [tierValue, setTierValue] = useState<string>(declaredTier ?? "");
  const [saving, setSaving] = useState(false);
  const onChangeTier = async (value: string) => {
    setTierValue(value);
    setSaving(true);
    try {
      const res = await fetch("/api/user/plan-tier", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier: value || null }),
      });
      if (res.ok) {
        setTimeout(() => window.location.reload(), 300);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="dash-usage-hero" className="bg-neutral-950 border-b border-neutral-800">
      <div className="max-w-6xl mx-auto px-4 py-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Power Index */}
          <div data-testid="usage-hero-power" className="bg-neutral-900 border-l-2 border-l-cyan-500 border border-neutral-800 rounded p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">⚡ 활용 지수</span>
                <span className="text-[10px] font-mono text-neutral-600">Power Index · 30일</span>
              </div>
              <button
                type="button"
                data-testid="usage-hero-power-info"
                onClick={() => setBreakdownOpen((v) => !v)}
                className="text-[11px] font-mono text-neutral-500 hover:text-cyan-300 border border-neutral-700 hover:border-cyan-500/60 rounded px-1.5 py-0.5 transition-colors"
                title="점수 산정 기준 보기"
              >
                {breakdownOpen ? "닫기 ▲" : "? 산정 기준"}
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
                  title="30일 중 27일 이상 활성 — 건강도 챙기세요"
                >
                  🔥 하드워커
                </span>
              )}
            </div>
            <div className="mt-3 text-xs font-mono text-neutral-500 space-y-0.5">
              <p>활성 <span className="text-neutral-300">{activeDays}/30일</span> · 일평균 <span className="text-neutral-300">{fmtTokens(Math.round(avgDailyTokens))}</span> tokens</p>
              <p className="text-[10px] text-neutral-600">활성일 40 + 사용량 60 = 100</p>
            </div>

            {breakdownOpen && (
              <div data-testid="usage-hero-power-breakdown" className="mt-3 pt-3 border-t border-neutral-800 space-y-3 text-[11px] font-mono">
                <div>
                  <p className="text-cyan-400 mb-1">활성일 (40점)</p>
                  <p className="text-neutral-400 leading-relaxed">
                    <span className="text-neutral-200">활성일 ÷ {POWER_FREQUENCY_TARGET_DAYS}일 × 40</span>
                    <span className="text-neutral-600"> (주말 제외 평일 기준)</span>
                  </p>
                  <p className="text-neutral-500 mt-0.5">
                    {POWER_FREQUENCY_TARGET_DAYS}일 이상은 모두 만점 ·
                    {POWER_HARDWORKER_THRESHOLD_DAYS}일 이상이면 🔥 하드워커 배지
                  </p>
                </div>
                <div>
                  <p className="text-cyan-400 mb-1">사용량 (60점) — 일평균 토큰 기준</p>
                  <div className="space-y-0.5">
                    {TOKEN_LEVEL_ROWS.map((r) => (
                      <div key={r.level} className="flex items-center gap-2 text-neutral-400">
                        <span className="w-10 text-neutral-500">{r.level * 6}점</span>
                        <span className="w-28 text-neutral-200">{r.range}</span>
                        {r.anchor && <span className="text-[10px] text-neutral-600">{r.anchor}</span>}
                      </div>
                    ))}
                  </div>
                  <p className="text-neutral-600 mt-1">cache reads 포함 (Claude Code 특성상 90%+ 가 cache)</p>
                </div>
              </div>
            )}
          </div>

          {/* 토큰 단가 */}
          <div data-testid="usage-hero-unit-cost" className="bg-neutral-900 border-l-2 border-l-yellow-500 border border-neutral-800 rounded p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-yellow-400 uppercase tracking-wider">📊 토큰 단가</span>
                <span className="text-[10px] font-mono text-neutral-600">월 요금 / 30일 토큰</span>
              </div>
              <select
                data-testid="plan-tier-select"
                value={tierValue}
                onChange={(e) => onChangeTier(e.target.value)}
                disabled={saving}
                className="bg-neutral-800 border border-neutral-700 text-neutral-200 text-[11px] font-mono rounded px-1.5 py-0.5 focus:outline-none focus:border-yellow-500"
                title="본인 plan tier"
              >
                {TIER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {!canShowUnitCost ? (
              <div className="space-y-1">
                <span className="text-2xl font-bold text-neutral-500 font-mono">—</span>
                <p className="text-xs font-mono text-neutral-500">
                  {monthlyPriceUsd === null
                    ? "Plan tier 를 위에서 선택하세요"
                    : monthlyPriceUsd === 0
                      ? "API 종량제 — 단가 계산 N/A"
                      : "30일 토큰 데이터 부족"}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-4xl font-bold tabular-nums text-yellow-300 leading-none">{fmtCostPerMTok(usdPerMTok)}</span>
                  <span className="text-sm text-neutral-500 font-mono">/ 1M tokens</span>
                  {unitGrade && (
                    <span className={`text-sm font-mono font-bold ml-1 ${unitGrade.color}`}>
                      {unitGrade.label}
                    </span>
                  )}
                </div>
                <div className="mt-3 text-xs font-mono text-neutral-500 space-y-0.5">
                  <p>
                    <span className="text-neutral-300">{declaredTierLabel ?? "—"}</span>
                    <span className="text-neutral-600"> · ${monthlyPriceUsd}/mo</span>
                  </p>
                  <p>
                    30일 합 <span className="text-neutral-300">{fmtTokens(totalWindowTokens)}</span> tokens
                  </p>
                  <p className="text-[10px] text-neutral-600">
                    Sonnet API 입력 단가 $3 / 1M 기준 — 낮을수록 cache leverage 큼
                  </p>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
