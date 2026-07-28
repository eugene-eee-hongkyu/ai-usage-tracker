"use client";

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import type { TeamData } from "@/components/team-view";

// team-view.tsx 의 byMemberBlock 추출 — 팀 BY MEMBER cost 라인/에어리어 차트.
// data.dailyByMember / data.memberNames 슬라이스만 props 로 받는다.
// 색상 상수·포맷 헬퍼·툴팁은 team-view.tsx 원본과 동일 로직을 카드에 복사.

const MEMBER_COLORS = [
  "#4f46e5", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
];

function fmtDate(d: string): string {
  const m = d.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${parseInt(m[1])}/${parseInt(m[2])}` : d;
}

// memberNames are "name__userId" keys; strip the suffix for display
function memberLabel(key: string): string {
  return key.replace(/__\d+$/, "");
}

interface MemberTooltipPayload {
  dataKey: string;
  // recharts API 상 number/string/undefined 가능. number 가드 안 하면
  // .toFixed 에서 TypeError → tooltip 호버 시 UI 크래시.
  value: number | string | undefined;
  color: string;
}

// recharts payload.value 정규화 — number 아니면 0 fallback.
function toFiniteNum(v: number | string | undefined): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function MemberTooltip({ active, payload, label }: { active?: boolean; payload?: MemberTooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => toFiniteNum(b.value) - toFiniteNum(a.value));
  return (
    <div style={{ background: "#171717", border: "1px solid #404040", borderRadius: 6, fontSize: 11, fontFamily: "monospace", padding: "6px 10px" }}>
      <div style={{ color: "#737373", marginBottom: 4 }}>{label}</div>
      {sorted.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {memberLabel(p.dataKey)} : ${toFiniteNum(p.value).toFixed(2)}
        </div>
      ))}
    </div>
  );
}

export function TeamByMemberCard({
  dailyByMember,
  memberNames,
}: {
  dailyByMember: TeamData["dailyByMember"];
  memberNames: TeamData["memberNames"];
}) {
  return (
    <div data-testid="team-card-by-member" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-cyan-500 rounded">
      <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">By Member (cost)</span>
        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-end">
          {(memberNames ?? []).map((key, i) => (
            <span key={key} className="flex items-center gap-1 text-[10px] font-mono text-neutral-400">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: MEMBER_COLORS[i % MEMBER_COLORS.length] }} />
              {memberLabel(key)}
            </span>
          ))}
        </div>
      </div>
      <div className="p-3">
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart
            data={(dailyByMember ?? []).map((row) => ({
              ...row,
              date: fmtDate(String(row.date)),
            }))}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              {(memberNames ?? []).map((key, i) => (
                <linearGradient key={key} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={MEMBER_COLORS[i % MEMBER_COLORS.length]} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={MEMBER_COLORS[i % MEMBER_COLORS.length]} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
            <XAxis dataKey="date" tick={{ fill: "#525252", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "#525252", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={40} />
            <Tooltip content={<MemberTooltip />} />
            {(memberNames ?? []).map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={MEMBER_COLORS[i % MEMBER_COLORS.length]}
                strokeWidth={1.5}
                fill={`url(#grad-${i})`}
                // 데이터 1점이면 area/line 이 안 그려져 빈 차트로 보이므로 dot 표시.
                dot={(dailyByMember ?? []).length === 1
                  ? { r: 3, fill: MEMBER_COLORS[i % MEMBER_COLORS.length], stroke: "none" }
                  : false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
