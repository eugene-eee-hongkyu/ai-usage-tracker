// /platform-admin/all-users — 모든 팀 × 모든 사용자의 오늘 health-check 카드 그리드.
// Platform Admin 전용. 카드 클릭 시 해당 사용자 팀으로 view-as 진입 → dashboard.

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface CardData {
  userId: number;
  teamId: number;
  teamName: string;
  name: string;
  email: string;
  lastSyncedAt: string | null;
  syncColor: "green" | "yellow" | "red" | "none";
  // 사용자가 선언한 plan tier. null 이면 미입력 (자동 추정 별도).
  planTier: "pro" | "max5" | "max20" | "team_standard" | "team_premium" | "team" | "api" | null;
  today: {
    tokens: number;
    cost: number;
    cacheHitPct: number | null;
    oneShotRate: number | null;
  } | null;
  planSavings: {
    tierLabel: string;
    isEstimated: boolean;
    actualCost: number;
    planCostToday: number;
    savingsAmount: number;
    savingsPct: number;
  } | null;
  env: {
    hookEnabled: boolean | null;
    ccusageMissing: boolean;
    npmRootWritable: boolean | null;
    deviceCount: number;
    codeburnVersion: string | null;
    codeburnPinMatch: boolean | null;
    ccusageVersion: string | null;
    ccusagePinMatch: boolean | null;
    nodeVersion: string | null;
    nodeManager: string | null;
    claudeCodeVersion: string | null;
    platform: string | null;
    osArch: string | null;
  };
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtTimeAgo(iso: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  const mins = Math.floor((Date.now() - dt.getTime()) / 60_000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}m 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h 전`;
  const days = Math.floor(hours / 24);
  return `${days}d 전`;
}

function fmtAbsoluteTime(iso: string | null): string {
  if (!iso) return "데이터 없음";
  const dt = new Date(iso);
  return dt.toLocaleString("ko", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// 25-05-22 14:30:45 짧은 형식 — 카드 header 의 상대시간 (1h 전) 아래에 보조 표시.
function fmtShortAbsolute(iso: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return "—";
  const yy = String(dt.getFullYear()).slice(-2);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const mi = String(dt.getMinutes()).padStart(2, "0");
  const ss = String(dt.getSeconds()).padStart(2, "0");
  return `${yy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

const SYNC_COLOR_CLASS: Record<CardData["syncColor"], string> = {
  green: "text-emerald-400",
  yellow: "text-amber-400",
  red: "text-rose-400",
  none: "text-neutral-600",
};

export default function PlatformAdminAllUsersPage() {
  const { data: session } = useSession();
  const myCurrentTeamId = (session?.user as { currentTeamId?: number | null } | undefined)?.currentTeamId ?? null;
  const myViewAsTeamId = (session?.user as { viewAsTeamId?: number | null } | undefined)?.viewAsTeamId ?? null;
  const [users, setUsers] = useState<CardData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [switchingTeamId, setSwitchingTeamId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/platform-admin/all-users")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: { users?: CardData[]; error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setUsers(d.users ?? []);
      })
      .catch((e) => setError(String(e)));
  }, []);

  async function handleCardClick(card: CardData) {
    if (switchingTeamId !== null) return;
    setSwitchingTeamId(card.teamId);
    try {
      // 본인 팀 멤버 클릭 — view-as 불필요. switch-team 부르면 'already_current_team'
      // 400 반환. view-as cookie 가 다른 팀으로 남아 있으면 먼저 exit.
      // 다른 팀 멤버 클릭 — switch-team 으로 view-as 진입.
      const sameTeam = myCurrentTeamId !== null && card.teamId === myCurrentTeamId;
      if (sameTeam) {
        if (myViewAsTeamId && myViewAsTeamId !== myCurrentTeamId) {
          await fetch("/api/admin/platform/exit-view", { method: "POST" });
        }
      } else {
        const r = await fetch("/api/admin/platform/switch-team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId: card.teamId }),
        });
        if (!r.ok) throw new Error(String(r.status));
      }
      // admin/members 가 localStorage 에서 선택 user 읽어 dashboard 표시.
      try { localStorage.setItem("teamMemberSelectedUserId", String(card.userId)); } catch { /* ignore */ }
      // 세션 재로드 위해 full nav (router.push 만 하면 session.viewAsTeamName 갱신 지연).
      window.location.href = "/admin/members";
    } catch (e) {
      console.error("card click navigation failed", e);
      setSwitchingTeamId(null);
    }
  }

  if (error) {
    return (
      <div className="text-sm text-rose-400 font-mono">
        Failed to load: {error}
      </div>
    );
  }
  if (users === null) {
    return <div className="text-sm text-neutral-500 font-mono">loading…</div>;
  }

  const activeCount = users.filter((u) => (u.today?.tokens ?? 0) > 0).length;

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-slate-100">All Users · 오늘</h1>
          <p className="text-xs text-slate-500 mt-1">
            모든 팀의 사용자 health check. 카드 클릭 → 해당 팀 view-as 진입 후 그 사용자 dashboard.
          </p>
        </div>
        <p className="text-xs text-slate-500 font-mono">
          전체 {users.length}명 · 오늘 활동 {activeCount}명
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((u) => (
          <UserCard key={`${u.teamId}-${u.userId}`} card={u} onClick={handleCardClick} switching={switchingTeamId === u.teamId} />
        ))}
      </div>
    </div>
  );
}

function UserCard({
  card,
  onClick,
  switching,
}: {
  card: CardData;
  onClick: (c: CardData) => void;
  switching: boolean;
}) {
  const isInactive = !card.today || card.today.tokens === 0;
  return (
    <button
      type="button"
      data-testid={`all-users-card-${card.userId}`}
      onClick={() => onClick(card)}
      disabled={switching}
      className={`text-left bg-slate-900 border border-slate-800 rounded-lg overflow-hidden hover:border-slate-600 hover:bg-slate-900/80 transition-colors disabled:opacity-50 ${isInactive ? "opacity-60" : ""}`}
    >
      {/* Header — name + team + sync time */}
      <div className="px-3 py-2.5 border-b border-slate-800 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-100 truncate">{card.name}</div>
          <div className="text-[11px] text-slate-500 font-mono truncate">{card.teamName}</div>
        </div>
        <div
          className="shrink-0 text-right"
          title={fmtAbsoluteTime(card.lastSyncedAt)}
        >
          <div className={`text-[11px] font-mono ${SYNC_COLOR_CLASS[card.syncColor]}`}>
            {card.syncColor === "green" && "✓ "}
            {card.syncColor === "yellow" && "⚠ "}
            {card.syncColor === "red" && "✗ "}
            {fmtTimeAgo(card.lastSyncedAt)}
          </div>
          <div className="text-[10px] font-mono text-slate-600 mt-0.5 whitespace-nowrap">
            {fmtShortAbsolute(card.lastSyncedAt)}
          </div>
        </div>
      </div>

      {/* 오늘 활동 (Hero strip 축약) */}
      <div className="px-3 py-2.5 border-b border-slate-800">
        {isInactive ? (
          <p className="text-xs font-mono text-slate-600">오늘 데이터 없음</p>
        ) : (
          <div className="text-xs font-mono space-y-0.5">
            <div>
              <span className="text-cyan-400 font-bold">{fmtTokens(card.today!.tokens)}</span>
              <span className="text-slate-500 ml-1">tokens</span>
              <span className="text-slate-700 mx-2">·</span>
              <span className="text-yellow-400 font-bold">${card.today!.cost.toFixed(2)}</span>
              <span className="text-slate-500 ml-1">cost</span>
            </div>
            {card.today!.cacheHitPct !== null && (
              <div className="text-slate-500">
                <span className="text-emerald-400">{card.today!.cacheHitPct.toFixed(1)}%</span> cache hit
                {card.today!.oneShotRate !== null && (
                  <>
                    <span className="text-slate-700 mx-2">·</span>
                    <span className="text-pink-400">{Math.round(card.today!.oneShotRate)}%</span> 1-shot
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* DAILY ACTIVITY (오늘 1행만) */}
      {!isInactive && (
        <div className="px-3 py-2.5 border-b border-slate-800">
          <p className="text-[10px] text-slate-600 font-mono uppercase tracking-wider mb-1.5">Daily Activity</p>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-500 w-12 shrink-0">오늘</span>
            <div className="flex-1 h-1.5 bg-slate-800 rounded overflow-hidden">
              <div className="h-full bg-cyan-500 rounded" style={{ width: "100%" }} />
            </div>
            <span className="text-cyan-300 w-16 text-right">{fmtTokens(card.today!.tokens)}</span>
          </div>
        </div>
      )}

      {/* PLAN 절감 — API tier 면 별도 라벨, 그 외 절감액. */}
      {card.planTier === "api" ? (
        <div className="px-3 py-2.5 border-b border-slate-800">
          <p className="text-[10px] text-slate-600 font-mono uppercase tracking-wider mb-1">Plan 절감</p>
          <p className="text-sm font-mono text-amber-300 font-bold">API 사용 중</p>
          <p className="text-[11px] font-mono text-slate-500 mt-0.5">PAYG · 플랜 비교 N/A</p>
        </div>
      ) : card.planSavings ? (
        <div className="px-3 py-2.5 border-b border-slate-800">
          <p className="text-[10px] text-slate-600 font-mono uppercase tracking-wider mb-1">Plan 절감</p>
          <div className="text-xs font-mono">
            {card.planSavings.savingsAmount > 0 ? (
              <span className="text-emerald-400 font-bold">
                ▼ ${card.planSavings.savingsAmount.toFixed(2)} ({card.planSavings.savingsPct}% 절약)
              </span>
            ) : card.planSavings.savingsAmount < 0 ? (
              <span className="text-rose-400 font-bold">
                ▲ ${Math.abs(card.planSavings.savingsAmount).toFixed(2)} 초과
              </span>
            ) : (
              <span className="text-slate-500">— $0</span>
            )}
            <div className="text-slate-500 mt-0.5">
              {card.planSavings.tierLabel} · 오늘 plan 비용 ${card.planSavings.planCostToday.toFixed(2)}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-3 py-2.5 border-b border-slate-800">
          <p className="text-[10px] text-slate-600 font-mono uppercase tracking-wider mb-1">Plan 절감</p>
          <p className="text-xs font-mono text-slate-600">tier 미입력</p>
        </div>
      )}

      {/* ENV */}
      <div className="px-3 py-2.5 space-y-0.5 text-[11px] font-mono">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Env</p>
        <div className="text-slate-400">
          {markCheck(card.env.hookEnabled)} Hook
          <span className="text-slate-700 mx-1.5">·</span>
          {card.env.ccusageMissing ? <span className="text-rose-400">✗</span> : <span className="text-emerald-400">✓</span>} ccusage
          <span className="text-slate-700 mx-1.5">·</span>
          {markCheck(card.env.npmRootWritable)} npm 쓰기
          <span className="text-slate-700 mx-1.5">·</span>
          <span className="text-slate-300">{card.env.deviceCount}</span> devices
        </div>
        <div className="text-slate-400">
          codeburn {versionWithMark(card.env.codeburnVersion, card.env.codeburnPinMatch)}
          <span className="text-slate-700 mx-1.5">·</span>
          ccusage {versionWithMark(card.env.ccusageVersion, card.env.ccusagePinMatch)}
        </div>
        {(card.env.nodeVersion || card.env.claudeCodeVersion) && (
          <div className="text-slate-400">
            {card.env.nodeVersion && (
              <>
                Node {card.env.nodeVersion}
                {card.env.nodeManager && <span className="text-slate-500"> ({card.env.nodeManager})</span>}
              </>
            )}
            {card.env.nodeVersion && card.env.claudeCodeVersion && <span className="text-slate-700 mx-1.5">·</span>}
            {card.env.claudeCodeVersion && (
              <>Claude {card.env.claudeCodeVersion.replace(/ \(Claude Code\)/, "")}</>
            )}
          </div>
        )}
        {(card.env.platform || card.env.osArch) && (
          <div className="text-slate-500">
            {card.env.platform === "darwin" ? "macOS" : card.env.platform}
            {card.env.osArch && ` ${card.env.osArch}`}
          </div>
        )}
      </div>
    </button>
  );
}

function markCheck(v: boolean | null): React.ReactElement {
  if (v === true) return <span className="text-emerald-400">✓</span>;
  if (v === false) return <span className="text-rose-400">✗</span>;
  return <span className="text-slate-600">·</span>;
}

function versionWithMark(version: string | null, pinMatch: boolean | null): React.ReactElement {
  if (version === null) return <span className="text-slate-600">미수집</span>;
  return (
    <>
      <span className="text-slate-300">{version}</span>
      {pinMatch === true && <span className="text-emerald-400 ml-0.5">✓</span>}
      {pinMatch === false && <span className="text-amber-400 ml-0.5">⚠</span>}
    </>
  );
}
