"use client";

import { useState } from "react";
import {
  computeUnitCostLevel,
  computeTokenLevel,
  targetWorkdaysForPeriod,
  POWER_FREQUENCY_TARGET_DAYS,
} from "@/lib/rules";
import { useMessages } from "@/lib/use-i18n";
import type { Messages } from "@/lib/i18n";

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

function tokenLevelRows(m: Messages, perDay: string) {
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

function unitCostLevelRows(m: Messages) {
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
  const { m } = useMessages();
  const power = powerGrade(powerIndex, m);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const canShowUnitCost =
    priceForPeriodSum !== null && priceForPeriodSum > 0 && totalWindowTokensSum > 0;
  const usdPerMTok = canShowUnitCost
    ? (priceForPeriodSum! / totalWindowTokensSum) * 1_000_000
    : 0;
  const unitLevel = canShowUnitCost ? computeUnitCostLevel(usdPerMTok) : 0;
  const unitGrade = canShowUnitCost ? unitCostGradeFromLevel(unitLevel, m) : null;
  const perDay = m.common.perDay;
  const TOKEN_LEVEL_ROWS = tokenLevelRows(m, perDay);
  const UNIT_COST_LEVEL_ROWS = unitCostLevelRows(m);

  return (
    <div data-testid="team-usage-hero" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Power Index */}
      <div data-testid="team-usage-hero-power" className="bg-neutral-900 border-l-2 border-l-cyan-500 border border-neutral-800 rounded p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">{m.teamUsageHero.powerLabel}</span>
            <span className="text-[10px] font-mono text-neutral-600">{fmt(m.teamUsageHero.powerSubtitle, { period: periodLabel })}</span>
          </div>
          <button
            type="button"
            data-testid="team-usage-hero-info"
            onClick={() => setBreakdownOpen((v) => !v)}
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
        </div>
        <div className="mt-3 text-xs font-mono text-neutral-500 space-y-0.5">
          <p>{fmt(m.teamUsageHero.activeMembersLine, { n: activeMembers, a: avgActiveDays.toFixed(1), p: periodDays })}</p>
          <p>{fmt(m.teamUsageHero.dailyAvgLine, { tok: fmtTokens(Math.round(avgDailyTokens)) })}</p>
        </div>

        {breakdownOpen && (() => {
          const targetWorkdays = targetWorkdaysForPeriod(periodDays);
          const teamTokenLevel = computeTokenLevel(avgDailyTokens);
          const targetStr = targetWorkdays.toFixed(targetWorkdays >= 10 ? 0 : 1);
          return (
            <div data-testid="team-usage-hero-power-breakdown" className="mt-3 pt-3 border-t border-neutral-800 space-y-3 text-[11px] font-mono">
              <div>
                <p className="text-cyan-400 mb-1">{m.teamUsageHero.breakdownActiveTitle}</p>
                <p className="text-neutral-400 leading-relaxed">
                  <span className="text-neutral-200">{fmt(m.teamUsageHero.breakdownActiveFormula, { target: targetStr })}</span>
                  <span className="text-neutral-600"> {fmt(m.usageHero.breakdownActiveNote, { period: periodLabel, anchor: POWER_FREQUENCY_TARGET_DAYS })}</span>
                </p>
                <div className="mt-1.5 pl-3 -ml-1.5 border-l-2 border-l-cyan-500 bg-cyan-900/20 py-0.5">
                  <span className="text-cyan-300 font-bold">
                    {fmt(m.teamUsageHero.breakdownTeamAvgLine, { a: avgActiveDays.toFixed(1), p: periodDays, n: activeMembers })}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-cyan-400 mb-1">{m.teamUsageHero.breakdownUsageTitle}</p>
                <div className="space-y-0.5">
                  {TOKEN_LEVEL_ROWS.map((r) => {
                    const isCurrent = r.level === teamTokenLevel;
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
                <p className="text-neutral-600 mt-1">
                  {m.teamUsageHero.breakdownUsageNote}
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
            <span className="text-xs font-mono font-bold text-yellow-400 uppercase tracking-wider">{m.teamUsageHero.unitCostLabel}</span>
            <span className="text-[10px] font-mono text-neutral-600">{fmt(m.teamUsageHero.unitCostSubtitle, { period: periodLabel })}</span>
          </div>
          <button
            type="button"
            data-testid="team-usage-hero-unit-info"
            onClick={() => setBreakdownOpen((v) => !v)}
            className="text-[11px] font-mono text-neutral-500 hover:text-yellow-300 border border-neutral-700 hover:border-yellow-500/60 rounded px-1.5 py-0.5 transition-colors"
            title={m.usageHero.powerInfoTooltip}
          >
            {breakdownOpen ? m.usageHero.powerInfoTitleOpen : m.usageHero.powerInfoTitleClosed}
          </button>
        </div>
        {!canShowUnitCost ? (
          <div className="space-y-1">
            <span className="text-2xl font-bold text-neutral-500 font-mono">—</span>
            <p className="text-xs font-mono text-neutral-500">
              {m.teamUsageHero.noTier}
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
                  <span className="text-[10px] font-mono text-neutral-500">
                    L{unitLevel} / 10
                  </span>
                </>
              )}
            </div>
            <div className="mt-3 text-xs font-mono text-neutral-500 space-y-0.5">
              <p>{fmt(m.teamUsageHero.periodSumPrice, { period: periodLabel })} <span className="text-neutral-300">{fmtPrice(priceForPeriodSum!)}</span></p>
              <p>{fmt(m.teamUsageHero.periodSumTokens, { period: periodLabel })} <span className="text-neutral-300">{fmtTokens(totalWindowTokensSum)}</span></p>
              <p className="text-[10px] text-neutral-600">
                {m.usageHero.sonnetAnchorHint}
              </p>
            </div>
          </>
        )}

        {breakdownOpen && (
          <div data-testid="team-usage-hero-unit-breakdown" className="mt-3 pt-3 border-t border-neutral-800 space-y-2 text-[11px] font-mono">
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
                <span className="text-neutral-300">{m.teamUsageHero.unitCostReadingTitle}</span>: {m.teamUsageHero.unitCostReadingBody}
              </p>
              <p className="text-neutral-500">
                <span className="text-neutral-400">{m.teamUsageHero.unitCostModelTitle}</span>: {m.teamUsageHero.unitCostModelBody}
              </p>
              <p className="text-neutral-600">
                {m.teamUsageHero.unitCostBoundaryNote}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

