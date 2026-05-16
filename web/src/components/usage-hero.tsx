"use client";

import { useState } from "react";
import {
  POWER_FREQUENCY_TARGET_DAYS,
  targetWorkdaysForPeriod,
  hardworkerThresholdForPeriod,
  computeUnitCostLevel,
  computeTokenLevel,
} from "@/lib/rules";

// 사용량 zone hero — Power Index + 토큰 단가 동등 크기 2-card.
// period 비례 정규화 — 30일 anchor 를 기준으로 8days/today/all 어느 윈도우에서도
// 의미 일관. 토큰 단가는 (월 요금 × periodDays/30) / period 토큰 으로 계산.
// 활용지수 frequency 분모도 23 × periodDays/30 으로 비례.

interface UsageHeroProps {
  powerIndex: number;             // 0-100
  activeDays: number;             // period 활성일
  avgDailyTokens: number;
  periodDays: number;             // 1 / 8 / month-current / 30 / 90 등
  periodLabel: string;            // "오늘" / "8일" / "이번달" / "30일" / "전체"
  declaredTier: string | null;
  declaredTierLabel: string | null;
  priceForPeriod: number | null;  // monthlyPriceUsd × periodDays/30
  totalWindowTokens: number;
  realUsagePct: number | null;
  nonCacheTotalWindowTokens: number | null;
  cacheHitPctForPeriod: number | null;
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

function fmtPrice(n: number): string {
  if (Number.isInteger(n)) return `$${n}`;
  return `$${n.toFixed(2)}`;
}

function powerGrade(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "탁월", color: "text-emerald-400" };
  if (score >= 60) return { label: "양호", color: "text-lime-400" };
  if (score >= 40) return { label: "보통", color: "text-yellow-400" };
  if (score >= 20) return { label: "낮음", color: "text-orange-400" };
  return { label: "시작", color: "text-rose-400" };
}

function unitCostGradeFromLevel(level: number): { label: string; color: string } {
  if (level >= 9) return { label: "탁월", color: "text-emerald-400" };
  if (level >= 7) return { label: "양호", color: "text-lime-400" };
  if (level >= 5) return { label: "보통", color: "text-yellow-400" };
  if (level >= 3) return { label: "낮음", color: "text-orange-400" };
  return { label: "미활용", color: "text-rose-400" };
}

// 사용량 11단계 — 위가 높은 점수 (best). 토큰 단가 10단계와 동일 방향.
const TOKEN_LEVEL_ROWS: Array<{ level: number; range: string; anchor?: string }> = [
  { level: 10, range: "> 300M / 일" },
  { level: 9,  range: "≤ 300M / 일" },
  { level: 8,  range: "≤ 150M / 일" },
  { level: 7,  range: "≤ 80M / 일" },
  { level: 6,  range: "≤ 40M / 일", anchor: "Enterprise P90" },
  { level: 5,  range: "≤ 25M / 일" },
  { level: 4,  range: "≤ 15M / 일", anchor: "Anthropic P90 (개인)" },
  { level: 3,  range: "≤ 8M / 일", anchor: "Anthropic 평균" },
  { level: 2,  range: "≤ 3M / 일" },
  { level: 1,  range: "≤ 1M / 일" },
  { level: 0,  range: "활동 없음" },
];

// 토큰 단가 10단계 — anchor 는 "동일 토큰을 API 직접 호출했을 때 비용" 대비.
// 기준 모델: Sonnet 4.6 input ($3 / 1M). Claude Code default + 가장 흔히 사용.
// 의미: "Sonnet API 1000× 저렴" = "내가 처리한 토큰을 Sonnet API 로 직접
// 호출했다면 plan 요금의 1000배가 들었을 것". cache leverage 효과의 정량화.
const UNIT_COST_LEVEL_ROWS: Array<{ level: number; range: string; anchor?: string }> = [
  { level: 10, range: "≤ $0.003 / 1M", anchor: "API 직접 호출이면 plan 의 1000배 비용" },
  { level: 9,  range: "≤ $0.01 / 1M",  anchor: "API 직접 호출이면 plan 의 300배" },
  { level: 8,  range: "≤ $0.03 / 1M",  anchor: "API 직접 호출이면 plan 의 100배 — Claude Code 헤비 평균" },
  { level: 7,  range: "≤ $0.1 / 1M",   anchor: "API 직접 호출이면 plan 의 30배" },
  { level: 6,  range: "≤ $0.3 / 1M",   anchor: "API 직접 호출이면 plan 의 10배 — Sonnet cache_read 가격 동급" },
  { level: 5,  range: "≤ $1 / 1M",     anchor: "API 직접 호출이면 plan 의 3배" },
  { level: 4,  range: "≤ $3 / 1M",     anchor: "API 직접 호출과 동급 — cache 거의 없음" },
  { level: 3,  range: "≤ $10 / 1M",    anchor: "API 직접 호출보다 3배 비쌈 (plan 낭비)" },
  { level: 2,  range: "≤ $30 / 1M",    anchor: "API 직접 호출보다 10배 비쌈" },
  { level: 1,  range: "> $30 / 1M",    anchor: "plan 거의 안 씀 — API 직접 호출이 훨씬 쌈" },
  { level: 0,  range: "데이터 없음" },
];

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
  realUsagePct,
  nonCacheTotalWindowTokens,
  cacheHitPctForPeriod,
}: UsageHeroProps) {
  const power = powerGrade(powerIndex);
  const hardworkerThreshold = hardworkerThresholdForPeriod(periodDays);
  const targetWorkdays = targetWorkdaysForPeriod(periodDays);
  // 하드워커 배지는 period 가 충분히 길 때만 (today = 1일은 1회 활동만으로
  // 배지가 부여돼 의미 없음). 8일 이상부터 표시.
  const isHardworker = periodDays >= 8 && activeDays >= hardworkerThreshold;
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const canShowUnitCost =
    priceForPeriod !== null && priceForPeriod > 0 && totalWindowTokens > 0;
  const usdPerMTok = canShowUnitCost
    ? (priceForPeriod! / totalWindowTokens) * 1_000_000
    : 0;
  const unitLevel = canShowUnitCost ? computeUnitCostLevel(usdPerMTok) : 0;
  const unitGrade = canShowUnitCost ? unitCostGradeFromLevel(unitLevel) : null;

  const [tierValue, setTierValue] = useState<string>(declaredTier ?? "");
  const [saving, setSaving] = useState(false);
  const [tierHintOpen, setTierHintOpen] = useState(false);
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
                <span className="text-[10px] font-mono text-neutral-600">Power Index · {periodLabel}</span>
              </div>
              <button
                type="button"
                data-testid="usage-hero-power-info"
                onClick={() => setBreakdownOpen((v) => !v)}
                className="text-[11px] font-mono text-neutral-500 hover:text-cyan-300 border border-neutral-700 hover:border-cyan-500/60 rounded px-1.5 py-0.5 transition-colors"
                title="활용지수 + 토큰단가 산정 기준 보기"
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
                  title={`${periodLabel} 중 ${Math.round(hardworkerThreshold)}일 이상 활성 — 건강도 챙기세요`}
                >
                  🔥 하드워커
                </span>
              )}
            </div>
            <div className="mt-3 text-xs font-mono text-neutral-500 space-y-0.5">
              <p>활성 <span className="text-neutral-300">{activeDays}/{periodDays}일</span> · 일평균 <span className="text-neutral-300">{fmtTokens(Math.round(avgDailyTokens))}</span> tokens</p>
              <p className="text-[10px] text-neutral-600">활성일 40 + 사용량 60 = 100</p>
            </div>

            {breakdownOpen && (() => {
              // 활성일 점수 — frequency × 40
              const frequencyScore = Math.round(Math.min(1, activeDays / targetWorkdays) * 40);
              // 사용량 레벨 (0~10)
              const tokenLevel = computeTokenLevel(avgDailyTokens);
              return (
                <div data-testid="usage-hero-power-breakdown" className="mt-3 pt-3 border-t border-neutral-800 space-y-3 text-[11px] font-mono">
                  <div>
                    <p className="text-cyan-400 mb-1">활성일 (40점)</p>
                    <p className="text-neutral-400 leading-relaxed">
                      <span className="text-neutral-200">활성일 ÷ {targetWorkdays.toFixed(targetWorkdays >= 10 ? 0 : 1)}일 × 40</span>
                      <span className="text-neutral-600"> ({periodLabel} 비례 — 30일 anchor {POWER_FREQUENCY_TARGET_DAYS}일)</span>
                    </p>
                    <p className="text-neutral-500 mt-0.5">
                      {targetWorkdays.toFixed(targetWorkdays >= 10 ? 0 : 1)}일 이상 만점
                      {periodDays >= 8 && (
                        <> · {hardworkerThreshold.toFixed(hardworkerThreshold >= 10 ? 0 : 1)}일 이상이면 🔥 하드워커</>
                      )}
                    </p>
                    <div className="mt-1.5 pl-3 -ml-1.5 border-l-2 border-l-cyan-500 bg-cyan-900/20 py-0.5">
                      <span className="text-cyan-300 font-bold">
                        나: {activeDays}/{periodDays}일 · {frequencyScore}점
                      </span>
                      {isHardworker && <span className="text-rose-300 ml-2">🔥</span>}
                    </div>
                  </div>
                  <div>
                    <p className="text-cyan-400 mb-1">사용량 (60점) — 일평균 토큰 기준</p>
                    <div className="space-y-0.5">
                      {TOKEN_LEVEL_ROWS.map((r) => {
                        const isCurrent = r.level === tokenLevel;
                        return (
                          <div
                            key={r.level}
                            className={`flex items-center gap-2 ${isCurrent ? "bg-cyan-900/30 border-l-2 border-l-cyan-500 pl-1.5 -ml-1.5" : "text-neutral-400"}`}
                          >
                            <span className={`w-10 ${isCurrent ? "text-cyan-300 font-bold" : "text-neutral-500"}`}>
                              {r.level * 6}점
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
                    <p className="text-neutral-600 mt-1">cache reads 포함 (Claude Code 특성상 90%+ 가 cache)</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 토큰 단가 */}
          <div data-testid="usage-hero-unit-cost" className="bg-neutral-900 border-l-2 border-l-yellow-500 border border-neutral-800 rounded p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-yellow-400 uppercase tracking-wider">📊 토큰 단가</span>
                <span className="text-[10px] font-mono text-neutral-600">{periodLabel} 요금 / {periodLabel} 토큰</span>
              </div>
              <div className="flex items-center gap-1.5">
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
                <button
                  type="button"
                  data-testid="usage-hero-unit-info"
                  onClick={() => setBreakdownOpen((v) => !v)}
                  className="text-[11px] font-mono text-neutral-500 hover:text-yellow-300 border border-neutral-700 hover:border-yellow-500/60 rounded px-1.5 py-0.5 transition-colors"
                  title="활용지수 + 토큰단가 산정 기준 보기"
                >
                  {breakdownOpen ? "닫기 ▲" : "? 산정 기준"}
                </button>
              </div>
            </div>

            {/* tier 확인 hint — select 바로 아래 토글. 발견성·공간 모두 OK. */}
            <div className="-mt-1 mb-2 text-[10px] font-mono">
              <button
                type="button"
                data-testid="usage-hero-tier-hint"
                onClick={() => setTierHintOpen((v) => !v)}
                className="text-neutral-500 hover:text-yellow-300 transition-colors"
              >
                {tierHintOpen ? "▲ 내 tier 확인하기" : "▾ 내 tier 확인하기"}
              </button>
              {tierHintOpen && (
                <div data-testid="usage-hero-tier-hint-body" className="mt-1.5 pl-3 border-l-2 border-l-neutral-800 space-y-0.5 text-neutral-400 leading-relaxed">
                  <p>1. <span className="text-neutral-200">claude.ai</span> 접속 → 우측 상단 프로필 → <span className="text-neutral-200">Subscription</span></p>
                  <p>2. 또는 Claude Code 터미널에서 <span className="text-neutral-200">claude</span> 실행 → <span className="text-neutral-200">/usage</span> 입력</p>
                  <p>3. 표시된 plan 그대로 위 select 에서 선택</p>
                </div>
              )}
            </div>

            {!canShowUnitCost ? (
              <div className="space-y-1">
                <span className="text-2xl font-bold text-neutral-500 font-mono">—</span>
                <p className="text-xs font-mono text-neutral-500">
                  {priceForPeriod === null
                    ? "Plan tier 를 위에서 선택하세요"
                    : priceForPeriod === 0
                      ? "API 종량제 — 단가 계산 N/A"
                      : `${periodLabel} 토큰 데이터 부족`}
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
                      <span className="text-[10px] font-mono text-neutral-500" title="10단계 중 현재 위치">
                        L{unitLevel} / 10
                      </span>
                    </>
                  )}
                </div>
                <div className="mt-3 text-xs font-mono text-neutral-500 space-y-0.5">
                  <p>
                    <span className="text-neutral-300">{declaredTierLabel ?? "—"}</span>
                    <span className="text-neutral-600"> · {periodLabel} 분 {fmtPrice(priceForPeriod!)}</span>
                  </p>
                  <p>
                    {periodLabel} 합 <span className="text-neutral-300">{fmtTokens(totalWindowTokens)}</span> tokens
                  </p>
                  {realUsagePct !== null && nonCacheTotalWindowTokens !== null && (
                    <p data-testid="usage-hero-real-usage" className="pt-1 border-t border-neutral-800/60 mt-1">
                      <span className="text-neutral-600">캐시 제외 사용률 </span>
                      <span className="text-neutral-200 font-bold">{realUsagePct}%</span>
                      <span className="text-neutral-600">
                        {" "}· non-cache <span className="text-neutral-400">{fmtTokens(nonCacheTotalWindowTokens)}</span>
                        {cacheHitPctForPeriod !== null && (
                          <> · cache hit {cacheHitPctForPeriod.toFixed(1)}%</>
                        )}
                      </span>
                    </p>
                  )}
                  <p className="text-[10px] text-neutral-600">
                    Sonnet API 입력 $3 / 1M 기준 — ? 누르면 10단계 위치 표시
                  </p>
                </div>
              </>
            )}

            {breakdownOpen && (
              <div data-testid="usage-hero-unit-breakdown" className="mt-3 pt-3 border-t border-neutral-800 space-y-2 text-[11px] font-mono">
                <p className="text-yellow-400">토큰 단가 10단계 — 낮은 단가 = 높은 레벨</p>
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
                    <span className="text-neutral-300">읽는 법</span>: ‘API 직접 호출이면 plan 의 N배’ =
                    내가 처리한 토큰을 Sonnet API 로 직접 호출했다면 비용이 plan 요금의 N배 들었을 것.
                    cache leverage 효과의 정량화.
                  </p>
                  <p className="text-neutral-500">
                    <span className="text-neutral-400">기준 모델</span>: Sonnet 4.6 input $3 / 1M
                    (Claude Code default + 가장 흔히 사용). Opus 4.6 input $5 / 1M (1.7×),
                    Haiku 4.5 input $1 / 1M (0.3×) — 모델 mix 에 따라 anchor 약간 다르지만
                    같은 레벨대 위치는 유지됨.
                  </p>
                  <p className="text-neutral-500">
                    <span className="text-neutral-400">외부 anchor (Anthropic 공식, 2026-05)</span>:
                    cache_read $0.30 / 1M (= input 10%), cache_write $3.75 / 1M.
                    Claude Code 사용자의 90%+ 토큰이 cache_read (커뮤니티 보고).
                    Opus 170턴 세션이 cache 없이 $168 → cache 적용 $21 (98% leverage) 사례.
                  </p>
                  <p className="text-neutral-600">
                    10단계 boundary 는 위 anchor 위에 logarithmic 간격으로 내부 추정
                    (실사용자 단가 분포는 비공개 → 정확한 percentile 아님). 본인 위치
                    변화 추이를 보는 용도.
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
