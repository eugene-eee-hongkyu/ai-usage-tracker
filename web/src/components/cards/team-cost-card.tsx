"use client";

import type { TeamData } from "@/components/team-view";

// team-view.tsx 의 costBlock(팀 COST 카드) 추출. 파생 배열/스칼라만 props 로 받는다.
// JSX 는 원본과 동일 — 하드코딩 라벨("Cost"/"member"/"cost"/"s"), cost 는 inline toFixed(2).
// 원본 costBlock 은 t.teamView.* / fmt$ 를 쓰지 않으므로 i18n·format 헬퍼는 import 하지 않는다.

// team-view.tsx 의 MEMBER_COLORS 복사(원본은 export 되지 않음). 멤버 idx 색상 매핑에 사용.
const MEMBER_COLORS = [
  "#4f46e5", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
];

// MemberStat 은 team-view.tsx 에서 export 되지 않아 indexed access 로 재사용.
type MemberStat = TeamData["byEfficiency"][number];

export function TeamCostCard({
  byCost,
  members,
  maxCost,
  selfName,
}: {
  byCost: MemberStat[];
  members: MemberStat[];
  maxCost: number;
  selfName: string | null | undefined;
}) {
  return (
    <div data-testid="team-card-cost" data-track-dwell="cost" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-yellow-500 rounded">
      <div className="px-3 py-2 border-b border-neutral-800">
        <span className="text-xs font-mono font-bold text-yellow-400 uppercase tracking-wider">Cost</span>
      </div>
      <div className="p-3">
        <div className="flex text-xs text-neutral-600 font-mono mb-1.5">
          <span className="w-16 shrink-0" />
          <span className="flex-1">member</span>
          <span className="w-16 text-right">cost</span>
          <span className="w-12 text-right">s</span>
        </div>
        <div className="space-y-1">
          {byCost.map((m) => {
            const idx = members.findIndex((x) => x.userId === m.userId);
            const isSelf = selfName === m.name;
            return (
              <div
                key={`${m.userId}-${m.tokenId ?? "null"}`}
                className={`flex items-center gap-1.5 text-xs font-mono ${isSelf ? "bg-emerald-500/5 ring-1 ring-inset ring-emerald-500/30 rounded px-1 -mx-1 py-0.5" : ""}`}
              >
                <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${(m.totalCost / maxCost) * 100}%`,
                      background: MEMBER_COLORS[idx % MEMBER_COLORS.length],
                    }}
                  />
                </div>
                <span className="flex-1 text-neutral-300 truncate flex items-center gap-1.5">
                  <span className="truncate">{m.name}{m.deviceLabel ? ` · ${m.deviceLabel}` : ""}</span>
                  {isSelf && <span className="text-[10px] text-emerald-400">← 나</span>}
                </span>
                <span className="w-16 text-yellow-400 text-right tabular-nums">${m.totalCost.toFixed(2)}</span>
                <span className="w-12 text-neutral-600 text-right tabular-nums">{m.sessionsCount}s</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
