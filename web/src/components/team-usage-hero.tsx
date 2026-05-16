"use client";

import { useState } from "react";
import {
  computeUnitCostLevel,
  computeTokenLevel,
  targetWorkdaysForPeriod,
  POWER_FREQUENCY_TARGET_DAYS,
} from "@/lib/rules";

// 팀 합산 활용지수 + 토큰 단가 — 개인 UsageHero 의 팀 버전.
// 활용지수 = 활성 멤버 평균 power score.
// 토큰 단가 = sum(priceForPeriod) / sum(totalWindowTokens) × 1M.
// tier select 없음 (멤버별 설정).

interface TeamUsageHeroProps {
  powerIndex: number;             // 0-100 — 팀 평균
  activeMembers: number;
  avgActiveDays: number;          // 활성 멤버 평균 활성일
  avgDailyTokens: number;          // 활성 멤버 평균 일평균 tokens
  periodDays: number;
  periodLabel: string;
  priceForPeriodSum: number | null;     // 팀 합산 비용
  totalWindowTokensSum: number;          // 팀 합산 tokens
}

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

// 위가 높은 점수 (best) — 토큰 단가와 동일 방향.
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

// Sonnet 4.6 input $3/1M anchor. "API 직접 호출이면 plan 의 N배" 의미.
const UNIT_COST_LEVEL_ROWS: Array<{ level: number; range: string; anchor?: string }> = [
  { level: 10, range: "≤ $0.003 / 1M", anchor: "API 직접 호출이면 plan 의 1000배 비용" },
  { level: 9,  range: "≤ $0.01 / 1M",  anchor: "API 직접 호출이면 plan 의 300배" },
  { level: 8,  range: "≤ $0.03 / 1M",  anchor: "API 직접 호출이면 plan 의 100배 — Claude Code 헤비 평균" },
  { level: 7,  range: "≤ $0.1 / 1M",   anchor: "API 직접 호출이면 plan 의 30배" },
  { level: 6,  range: "≤ $0.3 / 1M",   anchor: "API 직접 호출이면 plan 의 10배 — Sonnet cache_read 동급" },
  { level: 5,  range: "≤ $1 / 1M",     anchor: "API 직접 호출이면 plan 의 3배" },
  { level: 4,  range: "≤ $3 / 1M",     anchor: "API 직접 호출과 동급 — cache 거의 없음" },
  { level: 3,  range: "≤ $10 / 1M",    anchor: "API 직접 호출보다 3배 비쌈 (plan 낭비)" },
  { level: 2,  range: "≤ $30 / 1M",    anchor: "API 직접 호출보다 10배 비쌈" },
  { level: 1,  range: "> $30 / 1M",    anchor: "plan 거의 안 씀 — API 직접 호출이 훨씬 쌈" },
  { level: 0,  range: "데이터 없음" },
];

export function TeamUsageHero({
  powerIndex,
  activeMembers,
  avgActiveDays,
  avgDailyTokens,
  periodDays,
  periodLabel,
  priceForPeriodSum,
  totalWindowTokensSum,
}: TeamUsageHeroProps) {
  const power = powerGrade(powerIndex);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const canShowUnitCost =
    priceForPeriodSum !== null && priceForPeriodSum > 0 && totalWindowTokensSum > 0;
  const usdPerMTok = canShowUnitCost
    ? (priceForPeriodSum! / totalWindowTokensSum) * 1_000_000
    : 0;
  const unitLevel = canShowUnitCost ? computeUnitCostLevel(usdPerMTok) : 0;
  const unitGrade = canShowUnitCost ? unitCostGradeFromLevel(unitLevel) : null;

  return (
    <div data-testid="team-usage-hero" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Power Index */}
      <div data-testid="team-usage-hero-power" className="bg-neutral-900 border-l-2 border-l-cyan-500 border border-neutral-800 rounded p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">⚡ 팀 활용 지수</span>
            <span className="text-[10px] font-mono text-neutral-600">Power Index 평균 · {periodLabel}</span>
          </div>
          <button
            type="button"
            data-testid="team-usage-hero-info"
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
        </div>
        <div className="mt-3 text-xs font-mono text-neutral-500 space-y-0.5">
          <p>활성 <span className="text-neutral-300">{activeMembers}명</span> · 멤버 평균 활성 <span className="text-neutral-300">{avgActiveDays.toFixed(1)}/{periodDays}일</span></p>
          <p>일평균 <span className="text-neutral-300">{fmtTokens(Math.round(avgDailyTokens))}</span> tokens (멤버 평균)</p>
        </div>

        {breakdownOpen && (() => {
          const targetWorkdays = targetWorkdaysForPeriod(periodDays);
          const teamTokenLevel = computeTokenLevel(avgDailyTokens);
          return (
            <div data-testid="team-usage-hero-power-breakdown" className="mt-3 pt-3 border-t border-neutral-800 space-y-3 text-[11px] font-mono">
              <div>
                <p className="text-cyan-400 mb-1">활성일 (40점) — 멤버별 계산 후 평균</p>
                <p className="text-neutral-400 leading-relaxed">
                  <span className="text-neutral-200">멤버 활성일 ÷ {targetWorkdays.toFixed(targetWorkdays >= 10 ? 0 : 1)}일 × 40</span>
                  <span className="text-neutral-600"> ({periodLabel} 비례 — 30일 anchor {POWER_FREQUENCY_TARGET_DAYS}일)</span>
                </p>
                <div className="mt-1.5 pl-3 -ml-1.5 border-l-2 border-l-cyan-500 bg-cyan-900/20 py-0.5">
                  <span className="text-cyan-300 font-bold">
                    팀 평균: {avgActiveDays.toFixed(1)}/{periodDays}일 ({activeMembers}명)
                  </span>
                </div>
              </div>
              <div>
                <p className="text-cyan-400 mb-1">사용량 (60점) — 멤버 평균 일평균 토큰 기준</p>
                <div className="space-y-0.5">
                  {TOKEN_LEVEL_ROWS.map((r) => {
                    const isCurrent = r.level === teamTokenLevel;
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
                <p className="text-neutral-600 mt-1">
                  팀 활용지수 = 활성 멤버 score 평균. 위 표는 멤버 평균 일평균 토큰 기준 위치.
                </p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 토큰 단가 */}
      <div data-testid="team-usage-hero-unit-cost" className="bg-neutral-900 border-l-2 border-l-yellow-500 border border-neutral-800 rounded p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-yellow-400 uppercase tracking-wider">📊 팀 토큰 단가</span>
            <span className="text-[10px] font-mono text-neutral-600">{periodLabel} 합산 요금 / 합산 토큰</span>
          </div>
          <button
            type="button"
            data-testid="team-usage-hero-unit-info"
            onClick={() => setBreakdownOpen((v) => !v)}
            className="text-[11px] font-mono text-neutral-500 hover:text-yellow-300 border border-neutral-700 hover:border-yellow-500/60 rounded px-1.5 py-0.5 transition-colors"
            title="활용지수 + 토큰단가 산정 기준 보기"
          >
            {breakdownOpen ? "닫기 ▲" : "? 산정 기준"}
          </button>
        </div>
        {!canShowUnitCost ? (
          <div className="space-y-1">
            <span className="text-2xl font-bold text-neutral-500 font-mono">—</span>
            <p className="text-xs font-mono text-neutral-500">
              tier 입력 멤버 0 — 멤버 설정 페이지에서 plan tier 입력 시 합산
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
              <p>{periodLabel} 합산 요금 <span className="text-neutral-300">{fmtPrice(priceForPeriodSum!)}</span></p>
              <p>{periodLabel} 합산 토큰 <span className="text-neutral-300">{fmtTokens(totalWindowTokensSum)}</span></p>
              <p className="text-[10px] text-neutral-600">
                Sonnet API 입력 $3 / 1M 기준 — ? 누르면 10단계 위치 표시
              </p>
            </div>
          </>
        )}

        {breakdownOpen && (
          <div data-testid="team-usage-hero-unit-breakdown" className="mt-3 pt-3 border-t border-neutral-800 space-y-2 text-[11px] font-mono">
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
                팀이 처리한 토큰을 Sonnet API 로 직접 호출했다면 plan 합산 요금의 N배 들었을 것.
              </p>
              <p className="text-neutral-500">
                <span className="text-neutral-400">기준 모델</span>: Sonnet 4.6 input $3 / 1M
                (Claude Code default). Opus $5 (1.7×), Haiku $1 (0.3×) — 모델 mix 에 따라 anchor
                약간 다르지만 같은 레벨대 위치는 유지됨.
              </p>
              <p className="text-neutral-600">
                cache_read $0.30 / 1M (input 10%, Anthropic 공식 2026-05).
                10단계 boundary 는 logarithmic 간격 내부 추정.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
