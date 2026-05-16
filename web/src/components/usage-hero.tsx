"use client";

// 사용량 zone hero — Power Index + Plan 활용률 동등 크기 2-card.
// 둘 다 30일 anchor (period 무관). Plan Health 와 같은 윈도우.
//
// 4사분면 인사이트:
//   Power 높 + Plan 활용 낮 → 더 큰 plan 가능 (이미 잘 활용)
//   Power 높 + Plan 활용 높 → 이상적
//   Power 낮 + Plan 활용 낮 → 사용 늘릴 수 있음
//   Power 낮 + Plan 활용 높 → plan 너무 낮음 (한도 자주 hit)

interface UsageHeroProps {
  powerIndex: number;             // 0-100
  activeDays: number;             // 0-30
  avgDailyTokens: number;
  // Plan 활용률 — declaredTier null 이거나 api tier 면 null
  activationPct: number | null;
  declaredTierLabel: string | null;  // "Pro" / "Max 5x" 등 — null 이면 "미입력"
  planLimitTokens: number | null;    // 5h 한도 추정치
  totalWindowTokens: number;          // 30일 누적 token
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function powerGrade(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "탁월", color: "text-emerald-400" };
  if (score >= 60) return { label: "양호", color: "text-lime-400" };
  if (score >= 40) return { label: "보통", color: "text-yellow-400" };
  if (score >= 20) return { label: "낮음", color: "text-orange-400" };
  return { label: "시작", color: "text-rose-400" };
}

function activationGrade(pct: number, tierLabel: string): { label: string; color: string } {
  if (pct >= 80) return { label: `${tierLabel} 한도 임박`, color: "text-rose-400" };
  if (pct >= 50) return { label: "적정", color: "text-emerald-400" };
  if (pct >= 25) return { label: "여유", color: "text-lime-400" };
  return { label: "낮음", color: "text-amber-400" };
}

export function UsageHero({
  powerIndex,
  activeDays,
  avgDailyTokens,
  activationPct,
  declaredTierLabel,
  planLimitTokens,
  totalWindowTokens,
}: UsageHeroProps) {
  const power = powerGrade(powerIndex);

  return (
    <div data-testid="dash-usage-hero" className="bg-neutral-950 border-b border-neutral-800">
      <div className="max-w-6xl mx-auto px-4 py-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* ⚡ Power Index */}
          <div data-testid="usage-hero-power" className="bg-neutral-900 border-l-2 border-l-cyan-500 border border-neutral-800 rounded p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">⚡ 활용 지수</span>
              <span className="text-[10px] font-mono text-neutral-600">Power Index · 30일</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold tabular-nums text-cyan-300 leading-none">{powerIndex}</span>
              <span className="text-sm text-neutral-500 font-mono">/ 100</span>
              <span className={`text-sm font-mono font-bold ml-1 ${power.color}`}>{power.label}</span>
            </div>
            <div className="mt-3 text-xs font-mono text-neutral-500 space-y-0.5">
              <p>활성 <span className="text-neutral-300">{activeDays}/30일</span> · 일평균 <span className="text-neutral-300">{fmtTokens(Math.round(avgDailyTokens))}</span> tokens</p>
              <p className="text-[10px] text-neutral-600">활성일 40 + 사용량 60 = 100</p>
            </div>
          </div>

          {/* 📊 Plan 활용률 */}
          <div data-testid="usage-hero-activation" className="bg-neutral-900 border-l-2 border-l-yellow-500 border border-neutral-800 rounded p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono font-bold text-yellow-400 uppercase tracking-wider">📊 Plan 활용률</span>
              <span className="text-[10px] font-mono text-neutral-600">월 뽕뽑기 · 30일</span>
            </div>
            {activationPct === null ? (
              <div className="space-y-1">
                <span className="text-2xl font-bold text-neutral-500 font-mono">—</span>
                <p className="text-xs font-mono text-neutral-500">
                  Plan tier 미입력 — 아래 Plan Health 카드에서 본인 plan 선택
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-bold tabular-nums text-yellow-300 leading-none">{activationPct}</span>
                  <span className="text-sm text-neutral-500 font-mono">%</span>
                  <span className={`text-sm font-mono font-bold ml-1 ${activationGrade(activationPct, declaredTierLabel ?? "").color}`}>
                    {activationGrade(activationPct, declaredTierLabel ?? "").label}
                  </span>
                </div>
                <div className="mt-3 text-xs font-mono text-neutral-500 space-y-0.5">
                  <p>
                    <span className="text-neutral-300">{declaredTierLabel ?? "—"}</span>
                    {planLimitTokens && planLimitTokens > 0 && (
                      <> · 한도 <span className="text-neutral-300">{fmtTokens(planLimitTokens)}</span> tokens / 5h</>
                    )}
                  </p>
                  <p>
                    30일 합 <span className="text-neutral-300">{fmtTokens(totalWindowTokens)}</span> tokens
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
