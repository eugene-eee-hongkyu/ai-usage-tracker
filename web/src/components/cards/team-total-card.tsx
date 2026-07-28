"use client";

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useMessages } from "@/lib/use-i18n";
import { fmt$ } from "@/lib/dashboard-format";

// team-view.tsx 의 totalBlock 추출. dailyTotal(dailyByMember 에서 파생한 팀 합산 배열)만
// props 로 받는다. i18n(teamSum) 은 내부 useMessages, 포맷은 dashboard-format 공유 헬퍼.

// team-view.tsx:293 fmtDate 와 동일 구현. dashboard-format 에 없어 로컬 복사.
function fmtDate(d: string): string {
  const m = d.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${parseInt(m[1])}/${parseInt(m[2])}` : d;
}

export interface DailyTotalRow {
  date: string;
  cost: number;
}

export function TeamTotalCard({ dailyTotal }: { dailyTotal: DailyTotalRow[] }) {
  const { m: t } = useMessages();
  return (
    <div data-testid="team-card-total" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-cyan-500 rounded">
      <div className="px-3 py-2 border-b border-neutral-800">
        <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">Team Total (cost)</span>
      </div>
      <div className="p-3">
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart
            data={dailyTotal.map((row) => ({
              date: fmtDate(row.date),
              cost: row.cost,
            }))}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="grad-total" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
            <XAxis dataKey="date" tick={{ fill: "#525252", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "#525252", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={40} />
            <Tooltip
              contentStyle={{ background: "#171717", border: "1px solid #404040", borderRadius: 6, fontSize: 11, fontFamily: "monospace" }}
              formatter={(v) => [fmt$(Number(v)), t.teamView.teamSum]}
            />
            <Area
              type="monotone"
              dataKey="cost"
              stroke="#06b6d4"
              strokeWidth={2}
              fill="url(#grad-total)"
              // 데이터 1점이면 area/line 이 안 그려져 빈 차트로 보이므로 dot 표시.
              dot={dailyTotal.length === 1
                ? { r: 4, fill: "#06b6d4", stroke: "none" }
                : false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
