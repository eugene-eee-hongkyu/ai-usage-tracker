"use client";

import { fmtTokens } from "@/lib/dashboard-format";

// dashboard-view.tsx 의 개인 DAILY ACTIVITY(dash-card-daily-tokens) 블록 추출.
// chartTokenData(파생 배열)만 props 로 받는다. i18n 없음, fmtTokens 헬퍼만 사용.

export interface DailyTokensRow {
  date: string;
  tokens: number;
  empty: boolean;
}

export function DailyTokensCard({ chartTokenData }: { chartTokenData: DailyTokensRow[] }) {
  return (
    <div data-testid="dash-card-daily-tokens" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-cyan-500 rounded">
      <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">Daily Activity</span>
        {chartTokenData.length > 45 && (
          <span className="flex items-center gap-1 text-[10px] font-mono bg-cyan-900/40 text-cyan-300 border border-cyan-700/60 rounded px-1.5 py-0.5">
            ↕ scroll · {chartTokenData.length}
          </span>
        )}
      </div>
      <div className="p-3">
        {chartTokenData.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-neutral-600 text-xs font-mono">no data</div>
        ) : (
          <div className={chartTokenData.length > 45 ? "overflow-y-auto max-h-[300px] no-scrollbar" : ""}>
            <div className="space-y-1">
              {(() => {
                const maxTokens = Math.max(...chartTokenData.map((d) => d.tokens), 1);
                return chartTokenData.map((d) => (
                  <div key={d.date} className={`flex items-center gap-1.5 text-xs font-mono ${d.empty ? "opacity-40" : ""}`}>
                    <span className={`w-12 shrink-0 whitespace-nowrap ${d.empty ? "text-neutral-700" : "text-neutral-500"}`}>{d.date}</span>
                    <div className="flex-1 h-1.5 bg-neutral-800 rounded overflow-hidden">
                      {!d.empty && (
                        <div className="h-full bg-cyan-500 rounded" style={{ width: `${(d.tokens / maxTokens) * 100}%` }} />
                      )}
                    </div>
                    <span className={`w-16 text-right shrink-0 ${d.empty ? "text-neutral-700" : "text-cyan-300"}`}>{d.empty ? "—" : fmtTokens(d.tokens)}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
