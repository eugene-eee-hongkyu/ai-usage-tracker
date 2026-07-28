"use client";

import { useMessages } from "@/lib/use-i18n";
import type { Messages } from "@/lib/i18n";
import type { DashboardData } from "@/components/dashboard-view";
import type { DailyCostRow } from "@/components/cards/daily-cost-card";

// dashboard-view.tsx 의 planSavingsBlock 추출 (개인 "본전 회수 / plan 절감" 카드).
// 클로저 참조를 props/헬퍼로 치환:
//   - planHealth : data.planHealth
//   - chartData  : 파생 배열 (apiCost 합산에 cost 만 사용)
//   - period     : 현재 선택 period
//   - t          : useMessages() (원본과 동일 i18n 키)
//   - periodLabel: dashboard-view 의 모듈 헬퍼를 self-contained 복사
// JSX 구조·문자·클래스·data-testid 는 원본 그대로 보존.

type Period = "today" | "8days" | "month" | "30days" | "all";

// dashboard-view.tsx 의 모듈 헬퍼 periodLabel 복사 (self-contained).
function periodLabel(p: Period, m: Messages): string {
  switch (p) {
    case "today":  return m.common.today;
    case "8days":  return m.common.eightDays;
    case "month":  return m.common.thisMonth;
    case "30days": return m.common.thirtyDays;
    case "all":    return m.common.all;
  }
}

export function PlanSavingsCard({
  planHealth,
  chartData,
  period,
}: {
  planHealth: DashboardData["planHealth"];
  chartData: DailyCostRow[];
  period: Period;
}) {
  const { m: t } = useMessages();

  return (
    <div data-testid="dash-card-plan-savings" data-track-dwell="plan_savings" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-emerald-500 rounded">
      <div className="px-3 py-2 border-b border-neutral-800">
        <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
          {t.dashboard.cards.planSavings}
        </span>
      </div>
      <div className="p-4">
        {(() => {
          const apiCost = chartData.reduce((s, d) => s + (d.cost ?? 0), 0);
          const planCost = planHealth?.priceForPeriod ?? null;
          const isApiTier = planHealth?.declaredLimits?.tier === "api";
          // API tier (PAYG) — plan 가격이 0 이라 절감 개념 N/A. 실제 사용 비용만 표시.
          if (isApiTier) {
            const fmt = (v: number) =>
              v >= 100 ? `$${Math.round(v).toLocaleString()}` :
              v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(2)}`;
            return (
              <div className="space-y-2">
                <p className="text-[11px] text-neutral-500 font-mono uppercase tracking-wider">API 종량제</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-amber-300 text-3xl font-mono font-bold tracking-tight">{fmt(apiCost)}</span>
                  <span className="text-xs text-neutral-500 font-mono">실제 사용 비용</span>
                </div>
                <p className="text-[11px] text-neutral-600 font-mono leading-relaxed">
                  Plan 가격 비교 N/A — Anthropic API 직접 결제 (PAYG). Plan 절감 개념 적용 X.
                </p>
              </div>
            );
          }
          if (planCost == null || planCost <= 0) {
            // activity 0 + tier 미입력 케이스만 도달.
            return (
              <p className="text-neutral-600 text-xs font-mono">
                {t.dashboard.cards.noActivityHint}
              </p>
            );
          }
          const saved = apiCost - planCost;
          const savedPct = apiCost > 0 ? Math.round((saved / apiCost) * 100) : null;
          const positive = saved > 0;
          const fmt = (v: number) =>
            v >= 1000 ? `$${(v / 1000).toFixed(1)}k`.replace(".0k", "k") :
            v >= 100 ? `$${v.toFixed(0)}` :
            v >= 1 ? `$${v.toFixed(1)}` : `$${v.toFixed(2)}`;
          const fmtExact = (v: number) =>
            v >= 100 ? `$${Math.round(v).toLocaleString()}` :
            v >= 1 ? `$${v.toFixed(1)}` : `$${v.toFixed(2)}`;
          const limits = planHealth?.declaredLimits ?? null;
          const tierLabel = limits?.label ?? null;
          const monthlyPrice = limits?.monthlyPriceUsd ?? null;
          const barMax = Math.max(apiCost, planCost);
          const apiPct = (apiCost / barMax) * 100;
          const planPct = (planCost / barMax) * 100;
          // 본전 회수 hero (이번 달, period 무관). monthRecovery 가 있으면
          // 메인 framing — 사용자 인터뷰 "월 요금제 뽕 뽑기". 없으면 기존
          // period 별 절감 hero 로 fallback (API tier / tier 미입력 / 데이터 0).
          const mr = planHealth?.monthRecovery ?? null;
          return (
            <div className="space-y-4">
              {/* HERO: 이번 달 본전 회수 (있을 때) — 회수율 + 절감액 + 본전 돌파일 */}
              {/* 2026-05-30 정정: 모든 cost 값을 apiCost (chartData 합) 로 통일.
                  본전 회수 % 와 절감액 의 분모 = planCost (priceForPeriod, period 따라 비례).
                  즉 8days = $26.7 / today = $3.33 / month = $100 (1 인의 monthly price). */}
              {mr && mr.monthlyPriceUsd > 0 ? (
                <div data-testid="dash-plan-recovery-hero">
                  <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-1">
                    이번 달 본전 회수
                  </p>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className={`text-3xl sm:text-4xl font-mono font-bold tracking-tight ${
                      apiCost >= planCost ? "text-emerald-400" : "text-neutral-200"
                    }`}>
                      {planCost > 0 ? Math.round((apiCost / planCost) * 100) : 0}%
                    </span>
                    {apiCost >= planCost ? (
                      <span className="text-emerald-300 text-sm font-mono">
                        ▼ {fmtExact(apiCost - planCost)} 절감
                      </span>
                    ) : (
                      <span className="text-neutral-400 text-sm font-mono">
                        본전까지 {fmtExact(planCost - apiCost)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-neutral-500 mt-1.5">
                    Plan {fmtExact(planCost)} · 사용 {fmtExact(apiCost)}
                  </p>
                  <div className="text-[11px] font-mono text-neutral-500 mt-1 space-y-0.5">
                    {mr.breakEvenDate ? (
                      <p>본전 돌파일 <span className="text-emerald-300">{mr.breakEvenDate.slice(5)} ✓</span></p>
                    ) : (
                      <p>본전 미회수 · {mr.monthDaysTotal - mr.monthDaysElapsed}일 남음</p>
                    )}
                    {mr.remainingEstimateUsd > 0 && (
                      <p>
                        남은 기간 예상{" "}
                        <span className={mr.recoveryPct >= 100 ? "text-emerald-300" : "text-neutral-300"}>
                          {mr.recoveryPct >= 100 ? "+" : ""}{fmtExact(mr.remainingEstimateUsd)}
                        </span>
                      </p>
                    )}
                    {/* period 별 절감 보조 — 사용자가 토글한 period 의 절감액
                        (이번 달 본전 회수와 별개 정보). period=month 면 본전
                        회수와 중복이라 안 보임. */}
                    {period !== "month" && savedPct !== null && positive && (
                      <p className="pt-1 border-t border-neutral-800/60 mt-1">
                        이번 {periodLabel(period, t)} 절감{" "}
                        <span className="text-emerald-400">▼ {fmtExact(saved)}</span>{" "}
                        <span className="text-neutral-600">({savedPct}%)</span>
                      </p>
                    )}
                    {period !== "month" && savedPct !== null && !positive && (
                      <p className="pt-1 border-t border-neutral-800/60 mt-1">
                        이번 {periodLabel(period, t)}{" "}
                        <span className="text-rose-400">▲ {fmtExact(Math.abs(saved))} 초과</span>
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  {savedPct !== null && positive && (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-emerald-400 text-3xl sm:text-4xl font-mono font-bold tracking-tight">
                          ▼ {fmtExact(saved)}
                        </span>
                      </div>
                      <p className="text-[13px] font-mono text-emerald-300/80 mt-1">
                        {savedPct}% {t.dashboard.cards.planSavingsSavedLabel}
                      </p>
                    </>
                  )}
                  {savedPct !== null && !positive && (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-rose-400 text-3xl sm:text-4xl font-mono font-bold tracking-tight">
                          ▲ {fmtExact(Math.abs(saved))}
                        </span>
                      </div>
                      <p className="text-[13px] font-mono text-rose-300/80 mt-1">
                        {Math.abs(savedPct)}% over
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* 비교 막대 — Plan 없을 때 vs Plan 비용 비율 */}
              <div className="space-y-2.5">
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">
                      {t.dashboard.cards.planSavingsApiLabel}
                    </span>
                    <span className="text-amber-300 font-mono font-bold tabular-nums">{fmt(apiCost)}</span>
                  </div>
                  <div className="h-2 bg-neutral-800/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${apiPct}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">
                      {t.dashboard.cards.planSavingsPlanLabel}
                      {tierLabel && monthlyPrice !== null && (
                        <span className="ml-2 normal-case text-neutral-600">
                          {tierLabel} · ${monthlyPrice}{t.dashboard.cards.planSavingsMonthlySuffix}
                        </span>
                      )}
                    </span>
                    <span className="text-neutral-100 font-mono font-bold tabular-nums">{fmt(planCost)}</span>
                  </div>
                  <div className="h-2 bg-neutral-800/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-300 rounded-full transition-all"
                      style={{ width: `${planPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
