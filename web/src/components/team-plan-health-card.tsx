"use client";

// 매니저 시점 팀 plan 적정성 종합. /admin/team 어드민 view 에서만 노출.

const TIER_LABEL: Record<string, string> = {
  pro: "Pro", max5: "Max5", max20: "Max20", team: "Team", api: "API", unknown: "—",
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

function distToText(d: Record<string, number>): string {
  const order = ["pro", "max5", "max20", "team", "api", "unknown"];
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

const VERDICT_LABEL: Record<TeamMemberPlan["verdict"], string> = {
  downgrade: "▼ 다운",
  fit:       "✓ 적정",
  tight:     "▲ 여유 적음",
  over:      "▲▲ 한도",
  unknown:   "—",
};

export function TeamPlanHealthCard({ summary }: { summary: TeamPlanSummary }) {
  return (
    <div data-testid="team-plan-health-card" className="bg-amber-950/15 border-l-2 border-l-amber-600 border border-amber-900/30 rounded">
      <div className="px-3 py-2 border-b border-amber-900/30 flex items-center gap-2">
        <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">Team Plan Health</span>
        <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">ADMIN</span>
      </div>

      <div className="p-3 space-y-3">
        {/* 분포 + 비용 요약 */}
        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div>
            <p className="text-neutral-500 mb-0.5">현재 분포</p>
            <p className="text-neutral-200">{distToText(summary.currentDistribution) || "—"}</p>
            <p className="text-yellow-400 mt-1">${summary.currentMonthlyCostUsd}/월</p>
          </div>
          <div>
            <p className="text-neutral-500 mb-0.5">권장 분포</p>
            <p className="text-neutral-200">{distToText(summary.recommendedDistribution) || "—"}</p>
            <p className="text-yellow-400 mt-1">${summary.recommendedMonthlyCostUsd}/월</p>
          </div>
        </div>

        {/* 절감 + 행동 우선 */}
        {(summary.monthlySavingsUsd !== 0 || summary.actionFirstCount > 0) && (
          <div className="flex items-center gap-3 text-xs font-mono pt-2 border-t border-amber-900/30">
            {summary.monthlySavingsUsd > 0 && (
              <span className="text-emerald-400">
                ▼ 월 절감 ${summary.monthlySavingsUsd}
              </span>
            )}
            {summary.monthlySavingsUsd < 0 && (
              <span className="text-rose-400">
                ▲ 월 +${Math.abs(summary.monthlySavingsUsd)} (업그레이드 후 증가)
              </span>
            )}
            {summary.actionFirstCount > 0 && (
              <span className="text-amber-300">
                💡 행동 변경 우선 {summary.actionFirstCount}명
              </span>
            )}
          </div>
        )}

        {/* 멤버별 테이블 */}
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-amber-900/30">
              <th className="text-left text-neutral-500 pb-1.5 font-normal">멤버</th>
              <th className="text-left text-neutral-500 pb-1.5 px-2 font-normal">현재</th>
              <th className="text-left text-neutral-500 pb-1.5 px-2 font-normal">평가</th>
              <th className="text-left text-neutral-500 pb-1.5 px-2 font-normal">권장</th>
              <th className="text-right text-neutral-500 pb-1.5 font-normal">변동</th>
            </tr>
          </thead>
          <tbody>
            {summary.members.map((m) => {
              const declared = m.declaredTier ?? "unknown";
              const rec = m.recommendedTier ?? "unknown";
              const delta = m.monthlyCostRecommendedUsd - m.monthlyCostNowUsd;
              return (
                <tr
                  key={m.userId}
                  data-testid={`team-plan-row-${m.userId}`}
                  className="border-b border-amber-900/20 hover:bg-amber-900/10 transition-colors"
                >
                  <td className="py-1.5 text-neutral-300">{m.name}</td>
                  <td className="py-1.5 px-2 text-neutral-400">
                    {TIER_LABEL[declared] ?? declared}
                    {m.declaredTier === null && <span className="text-[10px] text-neutral-600"> (미입력)</span>}
                  </td>
                  <td className={`py-1.5 px-2 ${VERDICT_COLOR[m.verdict]}`}>
                    {VERDICT_LABEL[m.verdict]}
                    {m.actionFirst && <span className="text-amber-400 ml-1">💡</span>}
                  </td>
                  <td className="py-1.5 px-2 text-neutral-300">
                    {declared === rec ? <span className="text-neutral-600">—</span> : TIER_LABEL[rec] ?? rec}
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
          ※ plan 한도는 커뮤니티 P90 추정. 30일 윈도우 / 활성 7일+ 멤버만 평가. 💡 = plan 업 전 효율 개선 권장.
        </p>
      </div>
    </div>
  );
}
