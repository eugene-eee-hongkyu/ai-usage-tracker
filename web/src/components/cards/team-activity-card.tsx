"use client";

import type { Session } from "next-auth";
import { fmtTokens } from "@/lib/dashboard-format";
import type { TeamData } from "@/components/team-view";

// team-view.tsx 의 팀 ACTIVITY 카드(team-card-activity) 블록 추출.
// 멤버별 tokens 막대 리스트. i18n 키 없음(하드코딩 라벨), fmtTokens 헬퍼만 사용.
// 클로저 참조: byTokens / members / maxTokens / session / MEMBER_COLORS(=memberColors prop) / CcusageMissingBadge(복사).

// MemberStat 은 team-view.tsx 에서 export 되지 않으므로 TeamData["byEfficiency"] indexed access 로 참조.
type MemberStat = TeamData["byEfficiency"][number];

// team-view.tsx 의 module-level CcusageMissingBadge 를 그대로 복사(원본 미export).
function CcusageMissingBadge({ missing, userId }: { missing: boolean | undefined; userId?: string | number }) {
  if (!missing) return null;
  const tid = userId !== undefined ? `team-ccusage-badge-${userId}` : undefined;
  return (
    <span
      data-testid={tid}
      className="text-[10px] text-orange-400 font-mono px-1 py-0.5 rounded bg-orange-500/10 border border-orange-500/40 leading-none"
      title="ccusage not installed — token/cost data not collected. Run npm install -g ccusage then repair."
    >
      ccusage❌
    </span>
  );
}

export interface TeamActivityCardProps {
  byTokens: MemberStat[];
  members: MemberStat[];
  maxTokens: number;
  memberColors: readonly string[];
  session: Session | null;
}

export function TeamActivityCard({ byTokens, members, maxTokens, memberColors, session }: TeamActivityCardProps) {
  return (
    <div data-testid="team-card-activity" data-track-dwell="activity" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-cyan-500 rounded">
      <div className="px-3 py-2 border-b border-neutral-800">
        <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">Activity</span>
      </div>
      <div className="p-3">
        <div className="flex text-xs text-neutral-600 font-mono mb-1.5">
          <span className="w-16 shrink-0" />
          <span className="flex-1">member</span>
          <span className="w-16 text-right">tokens</span>
        </div>
        <div className="space-y-1">
          {byTokens.map((m) => {
            const idx = members.findIndex((x) => x.userId === m.userId);
            const isSelf = session?.user?.name === m.name;
            return (
              <div
                key={`${m.userId}-${m.tokenId ?? "null"}`}
                className={`flex items-center gap-1.5 text-xs font-mono ${isSelf ? "bg-emerald-500/5 ring-1 ring-inset ring-emerald-500/30 rounded px-1 -mx-1 py-0.5" : ""}`}
              >
                <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${(m.totalTokens / maxTokens) * 100}%`,
                      background: memberColors[idx % memberColors.length],
                    }}
                  />
                </div>
                <span className="flex-1 text-neutral-300 truncate flex items-center gap-1.5">
                  <span className="truncate">{m.name}{m.deviceLabel ? ` · ${m.deviceLabel}` : ""}</span>
                  {isSelf && <span className="text-[10px] text-emerald-400">← 나</span>}
                  <CcusageMissingBadge missing={m.ccusageMissing} userId={m.userId} />
                </span>
                <span className="w-16 text-cyan-300 text-right tabular-nums">{fmtTokens(m.totalTokens)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
