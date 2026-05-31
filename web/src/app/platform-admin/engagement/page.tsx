// /platform-admin/engagement — 전체 사용자 사이트 방문 / 체류 매트릭스.
// admin > 팀 의 ENGAGEMENT 카드를 전체 user 로 확장. 인원 두 자릿수 미만 가정의 단순 표.

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

interface EngagementUser {
  userId: number;
  name: string;
  email: string;
  teamNames: string[];
  lastSyncedAt: string | null;
  monthVisits: number;
  avgDwellSec: number;
}

interface DailyVisits30d {
  dates: string[];
  byUser: Record<string, { name: string; teamNames: string[]; counts: number[] }>;
}

interface EngagementResponse {
  users: EngagementUser[];
  dailyVisits30d: DailyVisits30d;
  totals: {
    userCount: number;
    activeMonthCount: number;
    noSyncCount: number;
  };
}

function fmtSyncTime(ts: string): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${min}`;
}

function syncTimeClass(lastSyncedAt: string | null): string {
  if (!lastSyncedAt) return "text-red-400";
  const days = Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 86_400_000);
  if (days >= 5) return "text-red-400";
  if (days >= 2) return "text-yellow-500";
  return "text-neutral-300";
}

function syncBadge(lastSyncedAt: string | null): React.ReactNode {
  if (!lastSyncedAt) return <span className="text-[10px] text-red-400 font-mono">no sync</span>;
  const days = Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 86_400_000);
  if (days >= 5) return <span className="text-[10px] text-red-400 font-mono">{days}일 ⚠</span>;
  if (days >= 2) return <span className="text-[10px] text-yellow-500 font-mono">{days}일 전</span>;
  return null;
}

export default function PlatformAdminEngagementPage() {
  const [data, setData] = useState<EngagementResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/platform-admin/engagement")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: EngagementResponse) => setData(d))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <p className="text-red-400 text-sm">Error: {error}</p>;
  if (!data) return <p className="text-slate-500 text-sm">Loading…</p>;

  const grid = data.dailyVisits30d;
  const fmtDay = (ymd: string) => ymd.slice(8);
  const isMonthStart = (ymd: string) => ymd.endsWith("-01");
  const monthOf = (ymd: string) => ymd.slice(5, 7);
  const ENG_COLS = 6; // member · team · last sync · visits · dwell · badge

  return (
    <div className="space-y-4">
      {/* Totals header */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">전체 사용자</p>
          <p className="text-2xl font-mono font-bold text-slate-100">{data.totals.userCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">이번달 방문 1회+</p>
          <p className="text-2xl font-mono font-bold text-emerald-400">
            {data.totals.activeMonthCount}
            <span className="text-sm text-slate-500 ml-2">/ {data.totals.userCount}</span>
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">미동기화 (no sync)</p>
          <p className="text-2xl font-mono font-bold text-red-400">{data.totals.noSyncCount}</p>
        </div>
      </div>

      {/* Engagement table — admin > 팀 의 dailyVisitsBlock 패턴 확장 */}
      <div data-testid="platform-engagement-card" className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-slate-500 rounded">
        <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
            전체 사용자 사이트 방문 (지난 30일)
          </span>
          <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 leading-none">
            PLATFORM
          </span>
        </div>
        <div className="p-3 overflow-x-auto">
          <table className="text-[11px] font-mono border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "10rem" }} />     {/* member name */}
              <col style={{ width: "10rem" }} />     {/* team(s) */}
              <col style={{ width: "5rem" }} />      {/* last sync */}
              <col style={{ width: "4rem" }} />      {/* visits/mo */}
              <col style={{ width: "4rem" }} />      {/* avg dwell */}
              <col style={{ width: "4rem" }} />      {/* sync badge */}
              {grid.dates.map((_, i) => (
                <col key={i} style={{ width: "1.5rem" }} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left text-neutral-500 pb-2 font-normal">멤버</th>
                <th className="text-left text-neutral-500 pb-2 px-2 font-normal whitespace-nowrap">팀</th>
                <th className="text-right text-neutral-500 pb-2 px-2 font-normal whitespace-nowrap">마지막 sync</th>
                <th className="text-right text-neutral-500 pb-2 px-2 font-normal whitespace-nowrap" title="이번 달 방문 횟수 합">방문/월</th>
                <th className="text-right text-neutral-500 pb-2 px-2 font-normal whitespace-nowrap" title="이번 달 평균 체류 (mm:ss)">평균 체류</th>
                <th />
                {grid.dates.map((d, i) => {
                  const showLabel = i % 5 === 0 || isMonthStart(d) || i === grid.dates.length - 1;
                  return (
                    <th
                      key={i}
                      className={`text-center py-1 text-[10px] tabular-nums font-normal ${
                        isMonthStart(d) ? "border-l border-l-neutral-700 text-amber-400" : "text-neutral-600"
                      }`}
                    >
                      {showLabel ? fmtDay(d) : ""}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => {
                const timeClass = syncTimeClass(u.lastSyncedAt);
                const badge = syncBadge(u.lastSyncedAt);
                const dwellMin = Math.floor(u.avgDwellSec / 60);
                const dwellSec = u.avgDwellSec % 60;
                const dwellLabel = u.monthVisits > 0
                  ? `${dwellMin}:${String(dwellSec).padStart(2, "0")}`
                  : "—";
                const visitsClass = u.monthVisits === 0
                  ? "text-red-400"
                  : u.monthVisits < 4
                    ? "text-yellow-500"
                    : "text-neutral-300";
                const dailyRow = grid.byUser[String(u.userId)] ?? null;
                const teamLabel = u.teamNames.length === 0
                  ? <span className="text-neutral-700">—</span>
                  : <span className="text-neutral-400">{u.teamNames.join(", ")}</span>;
                return (
                  <tr
                    key={u.userId}
                    data-testid={`platform-eng-row-${u.userId}`}
                    className="border-b border-neutral-800/40 hover:bg-neutral-800/30 transition-colors"
                  >
                    <td className="py-1.5 text-neutral-300 whitespace-nowrap overflow-hidden text-ellipsis" title={u.email}>
                      {u.name}
                    </td>
                    <td className="py-1.5 px-2 whitespace-nowrap overflow-hidden text-ellipsis">{teamLabel}</td>
                    <td className={`py-1.5 px-2 text-right tabular-nums whitespace-nowrap ${timeClass}`}>
                      {u.lastSyncedAt ? fmtSyncTime(u.lastSyncedAt) : "—"}
                    </td>
                    <td
                      data-testid={`platform-eng-visits-${u.userId}`}
                      className={`py-1.5 px-2 text-right tabular-nums whitespace-nowrap ${visitsClass}`}
                    >
                      {u.monthVisits}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-neutral-400 whitespace-nowrap">
                      {dwellLabel}
                    </td>
                    <td className="py-1.5 text-right">{badge}</td>
                    {grid.dates.map((d, i) => {
                      const c = dailyRow?.counts[i] ?? 0;
                      return (
                        <td
                          key={i}
                          className={`text-center py-1 tabular-nums ${
                            isMonthStart(d) ? "border-l border-l-neutral-700" : ""
                          } ${
                            c === 0 ? "text-neutral-700" :
                            c >= 10 ? "text-cyan-400 font-bold" :
                            "text-neutral-200"
                          }`}
                          title={`${d} · ${c}회 방문`}
                        >
                          {c === 0 ? "·" : c}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {/* 월 표시 행 */}
              <tr>
                <td className="pr-3 py-0.5 text-[10px] text-neutral-500 text-right" colSpan={ENG_COLS}>월</td>
                {grid.dates.map((d, i) => {
                  const isStart = isMonthStart(d);
                  const isFirst = i === 0;
                  return (
                    <td
                      key={i}
                      className={`text-center py-0.5 text-[10px] tabular-nums ${
                        isStart ? "text-amber-400 font-bold" :
                        isFirst ? "text-neutral-500" : "text-neutral-700"
                      }`}
                    >
                      {isStart || isFirst ? `${parseInt(monthOf(d), 10)}월` : ""}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 font-mono">
        정렬: 마지막 sync 가 오래된 (또는 한 번도 안 한) 사용자 우선 — actionable 상위.
        팀 컬럼은 normal 팀만 표시 (personal 팀 제외). 셀의 숫자 = 그날 방문 횟수.
      </p>
    </div>
  );
}
