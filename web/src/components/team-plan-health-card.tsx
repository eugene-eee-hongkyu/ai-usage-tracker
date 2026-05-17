"use client";

// 매니저 시점 팀 plan 적정성 종합. /admin/team 어드민 view 에서만 노출.

import { useMessages } from "@/lib/use-i18n";
import type { Messages } from "@/lib/i18n";

const TIER_LABEL: Record<string, string> = {
  pro: "Pro", max5: "Max5", max20: "Max20",
  team_standard: "Team Std", team_premium: "Team Prem", team: "Team",
  api: "API", unknown: "—",
};

interface TeamMemberPlan {
  userId: number;
  name: string;
  declaredTier: string | null;
  recommendedTier: string | null;
  monthlyCostNowUsd: number;
  monthlyCostRecommendedUsd: number;
  verdict: "downgrade" | "fit" | "tight" | "over" | "unknown";
  actionFirst: boolean;
  isEstimated: boolean;
}

export interface TeamPlanSummary {
  members: TeamMemberPlan[];
  currentDistribution: Record<string, number>;
  recommendedDistribution: Record<string, number>;
  currentMonthlyCostUsd: number;
  recommendedMonthlyCostUsd: number;
  monthlySavingsUsd: number;
  actionFirstCount: number;
}

function tmpl(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

function distToText(d: Record<string, number>): string {
  const order = ["pro", "max5", "max20", "team_standard", "team_premium", "team", "api", "unknown"];
  return order
    .filter((k) => d[k])
    .map((k) => `${d[k]} ${TIER_LABEL[k] ?? k}`)
    .join(" / ");
}

const VERDICT_COLOR: Record<TeamMemberPlan["verdict"], string> = {
  downgrade: "text-sky-300",
  fit:       "text-emerald-300",
  tight:     "text-amber-300",
  over:      "text-rose-300",
  unknown:   "text-neutral-500",
};

function verdictLabel(v: TeamMemberPlan["verdict"], m: Messages): string {
  switch (v) {
    case "downgrade": return m.teamPlanHealth.verdictDowngrade;
    case "fit":       return m.teamPlanHealth.verdictFit;
    case "tight":     return m.teamPlanHealth.verdictTight;
    case "over":      return m.teamPlanHealth.verdictOver;
    case "unknown":   return "—";
  }
}

export function TeamPlanHealthCard({ summary }: { summary: TeamPlanSummary }) {
  const { m } = useMessages();
  return (
    <div data-testid="team-plan-health-card" className="bg-amber-950/15 border-l-2 border-l-amber-600 border border-amber-900/30 rounded">
      <div className="px-3 py-2 border-b border-amber-900/30 flex items-center gap-2">
        <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">{m.teamPlanHealth.cardTitle}</span>
        <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">ADMIN</span>
      </div>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div>
            <p className="text-neutral-500 mb-0.5">{m.teamPlanHealth.currentDistribution}</p>
            <p className="text-neutral-200">{distToText(summary.currentDistribution) || "—"}</p>
            <p className="text-yellow-400 mt-1">{tmpl(m.teamPlanHealth.perMonthSuffix, { n: summary.currentMonthlyCostUsd })}</p>
          </div>
          <div>
            <p className="text-neutral-500 mb-0.5">{m.teamPlanHealth.recommendedDistribution}</p>
            <p className="text-neutral-200">{distToText(summary.recommendedDistribution) || "—"}</p>
            <p className="text-yellow-400 mt-1">{tmpl(m.teamPlanHealth.perMonthSuffix, { n: summary.recommendedMonthlyCostUsd })}</p>
          </div>
        </div>

        {(summary.monthlySavingsUsd !== 0 || summary.actionFirstCount > 0) && (
          <div className="flex items-center gap-3 text-xs font-mono pt-2 border-t border-amber-900/30">
            {summary.monthlySavingsUsd > 0 && (
              <span className="text-emerald-400">
                {tmpl(m.teamPlanHealth.monthlySavings, { n: summary.monthlySavingsUsd })}
              </span>
            )}
            {summary.monthlySavingsUsd < 0 && (
              <span className="text-rose-400">
                {tmpl(m.teamPlanHealth.monthlyExtraAfterUpgrade, { n: Math.abs(summary.monthlySavingsUsd) })}
              </span>
            )}
            {summary.actionFirstCount > 0 && (
              <span className="text-amber-300">
                {tmpl(m.teamPlanHealth.actionFirstCount, { n: summary.actionFirstCount })}
              </span>
            )}
          </div>
        )}

        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-amber-900/30">
              <th className="text-left text-neutral-500 pb-1.5 font-normal">{m.teamPlanHealth.colMember}</th>
              <th className="text-left text-neutral-500 pb-1.5 px-2 font-normal">{m.teamPlanHealth.colCurrent}</th>
              <th className="text-left text-neutral-500 pb-1.5 px-2 font-normal">{m.teamPlanHealth.colVerdict}</th>
              <th className="text-left text-neutral-500 pb-1.5 px-2 font-normal">{m.teamPlanHealth.colRecommended}</th>
              <th className="text-right text-neutral-500 pb-1.5 font-normal">{m.teamPlanHealth.colDelta}</th>
            </tr>
          </thead>
          <tbody>
            {summary.members.map((mb) => {
              const declared = mb.declaredTier ?? "unknown";
              const rec = mb.recommendedTier ?? "unknown";
              const delta = mb.monthlyCostRecommendedUsd - mb.monthlyCostNowUsd;
              return (
                <tr
                  key={mb.userId}
                  data-testid={`team-plan-row-${mb.userId}`}
                  className="border-b border-amber-900/20 hover:bg-amber-900/10 transition-colors"
                >
                  <td className="py-1.5 text-neutral-300">{mb.name}</td>
                  <td className={`py-1.5 px-2 ${mb.isEstimated ? "text-amber-300" : "text-neutral-400"}`}>
                    {TIER_LABEL[declared] ?? declared}
                    {mb.isEstimated && <span className="text-[10px] text-amber-400/70">{m.teamPlanHealth.estimated}</span>}
                    {!mb.isEstimated && mb.declaredTier === null && <span className="text-[10px] text-neutral-600">{m.teamPlanHealth.notEntered}</span>}
                  </td>
                  <td className={`py-1.5 px-2 ${VERDICT_COLOR[mb.verdict]}`}>
                    {verdictLabel(mb.verdict, m)}
                    {mb.actionFirst && <span className="text-amber-400 ml-1">💡</span>}
                  </td>
                  <td className="py-1.5 px-2 text-neutral-300">
                    {rec === "unknown" ? (
                      <span className="text-neutral-600">—</span>
                    ) : declared === rec ? (
                      <span className="text-neutral-500">{TIER_LABEL[rec] ?? rec} <span className="text-[10px]">{m.teamPlanHealth.keep}</span></span>
                    ) : (
                      <span>{TIER_LABEL[rec] ?? rec}</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {delta === 0 ? (
                      <span className="text-neutral-600">—</span>
                    ) : delta > 0 ? (
                      <span className="text-rose-400">+${delta}</span>
                    ) : (
                      <span className="text-emerald-400">−${Math.abs(delta)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="text-[10px] text-neutral-600 font-mono">
          {m.teamPlanHealth.footnote}
        </p>
      </div>
    </div>
  );
}
