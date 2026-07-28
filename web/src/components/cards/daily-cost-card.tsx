"use client";

import { fmt$ } from "@/lib/dashboard-format";

// dashboard-view.tsx 의 dailyCostBlock 추출. chartData(파생 배열)만 props 로 받는다.
// 통합(unified) 뷰와 개인(dashboard) 뷰가 공유.

export interface DailyCostRow {
  date: string;
  cost: number;
  sessions: number;
  empty: boolean;
}

export function DailyCostCard({ chartData }: { chartData: DailyCostRow[] }) {
  return (
    <div data-testid="dash-card-daily-cost" data-track-dwell="daily_cost" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-yellow-500 rounded">
      <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-yellow-400 uppercase tracking-wider">Daily Cost</span>
        {chartData.length > 45 && (
          <span className="flex items-center gap-1 text-[10px] font-mono bg-yellow-900/40 text-yellow-300 border border-yellow-700/60 rounded px-1.5 py-0.5">
            ↕ scroll · {chartData.length}
          </span>
        )}
      </div>
      <div className="p-3">
        {chartData.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-neutral-600 text-xs font-mono">no data</div>
        ) : (
          <div className={chartData.length > 45 ? "overflow-y-auto max-h-[300px] no-scrollbar" : ""}>
            <div className="space-y-1">
              {(() => {
                const maxCost = Math.max(...chartData.map((d) => d.cost), 0.01);
                return chartData.map((d) => (
                  <div key={d.date} className={`flex items-center gap-1.5 text-xs font-mono ${d.empty ? "opacity-40" : ""}`}>
                    <span className={`w-12 shrink-0 whitespace-nowrap ${d.empty ? "text-neutral-700" : "text-neutral-500"}`}>{d.date}</span>
                    <div className="flex-1 h-1.5 bg-neutral-800 rounded overflow-hidden">
                      {!d.empty && (
                        <div className="h-full bg-yellow-500 rounded" style={{ width: `${(d.cost / maxCost) * 100}%` }} />
                      )}
                    </div>
                    <span className={`w-16 text-right shrink-0 ${d.empty ? "text-neutral-700" : "text-yellow-400"}`}>{d.empty ? "—" : fmt$(d.cost)}</span>
                    {d.sessions > 0 && <span className="text-neutral-600 w-8 text-right shrink-0">{d.sessions}s</span>}
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
