"use client";

import type { DashboardData } from "@/components/dashboard-view";
import { fmtTokens, tmpl } from "@/lib/dashboard-format";
import { useMessages } from "@/lib/use-i18n";

// dashboard-view.tsx 의 개인 상단 summary bar(dash-overview-bar) 블록 추출.
// tokens / cost / cache hit / 1-shot 요약 + last received + timezone picker.
// JSX·data-testid 100% 보존. dashboard-format 에 없는 헬퍼(fmtSyncedAt/
// formatDateRange/tzAbbr)와 상수(TZ_ABBR_MAP/TIMEZONE_LIST)는 원본에서 복사.

// — dashboard-view.tsx 에서 복사한 헬퍼/상수 (dashboard-format 미제공분) —

function fmtSyncedAt(ts: string | null, tz: string): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: tz,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  const fmt = (s: string) => {
    const [, m, d] = s.split("-");
    return `${parseInt(m)}/${parseInt(d)}`;
  };
  return `${fmt(start)}-${fmt(end)}`;
}

const TZ_ABBR_MAP: Record<string, string> = {
  "Asia/Singapore": "SGT",
  "Asia/Seoul": "KST",
  "Asia/Tokyo": "JST",
  "Asia/Hong_Kong": "HKT",
  "Asia/Shanghai": "CST",
  "Asia/Kolkata": "IST",
  "UTC": "UTC",
};

function tzAbbr(tz: string): string {
  const fromIntl = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "short" })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName")?.value ?? tz;
  return /^GMT[+-]/.test(fromIntl) ? (TZ_ABBR_MAP[tz] ?? fromIntl) : fromIntl;
}

const TIMEZONE_LIST: { label: string; value: string }[] = [
  { label: "SGT — Singapore (UTC+8)", value: "Asia/Singapore" },
  { label: "KST — Korea (UTC+9)", value: "Asia/Seoul" },
  { label: "JST — Japan (UTC+9)", value: "Asia/Tokyo" },
  { label: "HKT — Hong Kong (UTC+8)", value: "Asia/Hong_Kong" },
  { label: "CST — China (UTC+8)", value: "Asia/Shanghai" },
  { label: "IST — India (UTC+5:30)", value: "Asia/Kolkata" },
  { label: "GMT/BST — UK", value: "Europe/London" },
  { label: "CET — Central Europe", value: "Europe/Paris" },
  { label: "EST/EDT — US Eastern", value: "America/New_York" },
  { label: "CST/CDT — US Central", value: "America/Chicago" },
  { label: "PST/PDT — US Pacific", value: "America/Los_Angeles" },
  { label: "UTC", value: "UTC" },
];

interface OverviewBarProps {
  viewOnly: boolean;
  user: DashboardData["user"];
  // 원본 렌더 시점(overview null early-return 이후)엔 항상 non-null.
  ov: NonNullable<DashboardData["overview"]>;
  // chartTokenData: 파생 배열. fallback token 합산에만 사용(tokens 필드만 참조).
  chartTokenData: { tokens: number }[];
  isShortPeriod: boolean;
  snapshot: DashboardData["snapshot"];
  userTz: string;
  showTzPicker: boolean;
  setShowTzPicker: React.Dispatch<React.SetStateAction<boolean>>;
  saveTz: (tz: string) => void | Promise<void>;
}

export function OverviewBar({
  viewOnly,
  user,
  ov,
  chartTokenData,
  isShortPeriod,
  snapshot,
  userTz,
  showTzPicker,
  setShowTzPicker,
  saveTz,
}: OverviewBarProps) {
  const { m: t } = useMessages();
  return (
    <div data-testid="dash-overview-bar" className="bg-neutral-900 border-b border-neutral-800">
      <div className="max-w-6xl mx-auto px-4 py-3.5 flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono">
        {viewOnly && (
          <span className="text-indigo-400 font-semibold self-center mr-2">{user.name}</span>
        )}
        {/* hero — activity (tokens) + cost. 사용자 인터뷰 답변에서 가장 자주 보는 두 지표.
            period="today" 면 ov.totalTokensStrictToday (오늘 하루) 사용 — codeburn 의
            today period 가 KST/SGT 사용자에서 어제 + 오늘 spillover 되는 문제 회피. */}
        <span className="flex items-baseline gap-1">
          <span className="text-cyan-400 font-bold text-2xl tabular-nums">
            {fmtTokens(
              ov.totalTokensStrictToday !== null
                ? ov.totalTokensStrictToday
                : chartTokenData.reduce((s, d) => s + d.tokens, 0)
            )}
          </span>
          <span className="text-neutral-500 text-xs">tokens</span>
        </span>
        <span className="flex items-baseline gap-1">
          <span className="text-yellow-400 font-bold text-2xl tabular-nums">${ov.cost.toFixed(2)}</span>
          <span className="text-neutral-500 text-xs">cost</span>
        </span>
        {/* secondary — 효율 지표 (cache hit / 1-shot) 만. calls·sessions 는
            "얼마나 썼나" 는 token·cost 로 이미 알 수 있고 hero 띠는 한 줄
            유지 우선이라 제거.
            짧은 period 에서는 1-shot 도 hide (Efficiency 카드 자체가 사라지므로 일관). */}
        <span className="text-sm"><span className="text-emerald-400 font-bold">{ov.cacheHitPct.toFixed(1)}%</span><span className="text-neutral-500 ml-1 text-xs">cache hit</span></span>
        {!isShortPeriod && (
          <span className="text-sm"><span className="text-violet-400 font-bold">{Math.round(ov.oneShotRate * 100)}%</span><span className="text-neutral-500 ml-1 text-xs">1-shot</span></span>
        )}
        <span className="text-neutral-600 text-xs self-center ml-auto flex items-center gap-3">
          <span>{tmpl(t.dashboardView.activeNDays, { n: ov.activeDays })}</span>
          {snapshot ? (
            <span className="text-amber-400">
              📌 captured {fmtSyncedAt(snapshot.capturedAt, userTz)} {tzAbbr(userTz)}
              {snapshot.dataRangeStart && snapshot.dataRangeEnd && (
                <span className="text-neutral-500"> · {formatDateRange(snapshot.dataRangeStart, snapshot.dataRangeEnd)}</span>
              )}
            </span>
          ) : !viewOnly ? (
            <span className="relative">
              {t.dashboardView.lastReceived}{" "}
              <span className="text-neutral-500">{fmtSyncedAt(user.lastSyncedAt, userTz)}</span>{" "}
              <button
                data-testid="dash-tz-btn"
                onClick={() => setShowTzPicker((v) => !v)}
                className="text-neutral-600 hover:text-neutral-300 text-[10px] font-mono border border-neutral-700 hover:border-neutral-500 rounded px-1 py-0.5 transition-colors"
                title={t.dashboardView.tzChangeTitle}
              >{tzAbbr(userTz)}</button>
              {showTzPicker && (
                <div data-testid="dash-tz-list" className="absolute right-0 top-full mt-1 z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl w-64 py-1 text-left">
                  {TIMEZONE_LIST.map((tz) => (
                    <button
                      key={tz.value}
                      onClick={() => saveTz(tz.value)}
                      className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-neutral-800 transition-colors ${userTz === tz.value ? "text-indigo-400" : "text-neutral-300"}`}
                    >{tz.label}</button>
                  ))}
                </div>
              )}
            </span>
          ) : (
            <span className="text-neutral-500">
              {t.dashboardView.lastReceived} {fmtSyncedAt(user.lastSyncedAt, userTz)}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
