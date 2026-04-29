"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { CacheHitModal, OneShotRateModal, CostPerSessionModal, CallsPerSessionModal, CostPerCallModal, OutputInputRatioModal } from "@/components/metric-modal";

type Period = "today" | "week" | "month" | "all";

interface Overview {
  cost: number;
  sessions: number;
  calls: number;
  cacheHitPct: number;
  oneShotRate: number;
  activeDays: number;
  costPerCall: number;
  outputInputRatio: number;
}

interface Activity {
  name: string;
  turns: number;
  cost: number;
  oneShotRate: number | null;
}

interface Project {
  name: string;
  path: string;
  cost: number;
  sessions: number;
  avgCost: number;
}

interface TopSession {
  id: string;
  date: string;
  project: string;
  projectPath: string;
  cost: number;
  calls: number;
}

interface DailyRow { date: string; cost: number; sessions: number }
interface Model { name: string; cost: number; calls: number; cacheHitPct: number }
interface NameCalls { name: string; calls: number }

interface SnapshotMeta {
  periodStart: string;
  capturedAt: string;
}

interface SnapshotInfo {
  type: "weekly" | "monthly";
  periodStart: string;
  capturedAt: string;
  dataRangeStart: string | null;
  dataRangeEnd: string | null;
}

interface DashboardData {
  user: { name: string; lastSyncedAt: string | null; timezone: string | null };
  overview: Overview | null;
  daily: DailyRow[];
  activities: Activity[];
  projects: Project[];
  topSessions: TopSession[];
  models: Model[];
  tools: NameCalls[];
  shellCommands: NameCalls[];
  mcpServers: NameCalls[];
  availableSnapshots?: { weekly: SnapshotMeta[]; monthly: SnapshotMeta[] };
  snapshot?: SnapshotInfo | null;
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "오늘", week: "이번주", month: "이번달", all: "전체",
};

function formatPath(path: string): string {
  if (!path) return "";
  let p = path;
  if (path.startsWith("/")) {
    const m = path.match(/^\/(?:Users|home)\/[^/]+\/(.+)$/);
    p = m ? m[1] : path;
  }
  const parts = p.split("/").filter(Boolean);
  return parts.slice(-3).join("/");
}

function fmt$(n: number) { return `$${n.toFixed(2)}`; }

type GradeLevel = "탁월" | "양호" | "보통" | "부족" | "경고";
const GRADE_STYLES: Record<GradeLevel, string> = {
  "탁월": "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  "양호": "bg-green-500/15 text-green-400 border-green-500/40",
  "보통": "bg-yellow-500/15 text-yellow-400 border-yellow-500/40",
  "부족": "bg-orange-500/15 text-orange-400 border-orange-500/40",
  "경고": "bg-red-500/15 text-red-400 border-red-500/40",
};

const GRADE_TOOLTIP_CLS: Record<GradeLevel, string> = {
  "탁월": "bg-emerald-950/60 text-emerald-300",
  "양호": "bg-green-950/60 text-green-300",
  "보통": "bg-yellow-950/60 text-yellow-300",
  "부족": "bg-orange-950/60 text-orange-300",
  "경고": "bg-red-950/60 text-red-300",
};

const CACHE_ROWS: [GradeLevel, string, string][] = [
  ["탁월", "96%+",    "Claude Code 본사 내부 기준"],
  ["양호", "90~95%",  "좋은 상태"],
  ["보통", "80~89%",  "일반적인 수준"],
  ["부족", "60~79%",  "CLAUDE.md 비대 의심"],
  ["경고", "<60%",    "본사 기준 사고(SEV) 수준"],
];
const ONESHOT_ROWS: [GradeLevel, string, string][] = [
  ["탁월", "90%+",    "명확한 지시 + 좋은 컨텍스트"],
  ["양호", "80~89%",  "좋은 상태"],
  ["보통", "70~79%",  "지시 명확도 점검 필요"],
  ["부족", "60~69%",  "자주 retry 발생"],
  ["경고", "<60%",    "비효율 패턴. 토큰 낭비"],
];
const COST_ROWS: [GradeLevel, string, string][] = [
  ["탁월", "<$10",    "작업 단위 잘 분리됨"],
  ["양호", "$10~25",  "적당한 규모. 정상"],
  ["보통", "$25~50",  "큰 작업 또는 혼재"],
  ["부족", "$50~100", "세션이 너무 큼. 분리 필요"],
  ["경고", "$100+",   "거대 세션. 비효율"],
];
const CALLS_ROWS: [GradeLevel, string, string][] = [
  ["탁월", "30~60",      "한 작업 단위에 정확히 매칭"],
  ["양호", "20~30|60~80","약간 짧거나 약간 김"],
  ["보통", "10~20|80~120","활용 부족 또는 분리 검토"],
  ["부족", "5~10|120~200","너무 짧거나 너무 김"],
  ["경고", "<5|200+",    "활용 부족 또는 retry 루프"],
];
const COST_CALL_ROWS: [GradeLevel, string, string][] = [
  ["탁월", "<$0.04",    "cache 활용 + Sonnet/Haiku 위주"],
  ["양호", "$0.04~0.06","정상 — Sonnet 기준"],
  ["보통", "$0.06~0.10","Opus 사용 또는 컨텍스트 큼"],
  ["부족", "$0.10~0.20","Opus 남용 또는 cache miss"],
  ["경고", "$0.20+",    "Opus + 큰 컨텍스트 + cache 깨짐"],
];
const OUTPUT_INPUT_ROWS: [GradeLevel, string, string][] = [
  ["탁월", "30×+",    "짧은 지시 + 큰 출력. cache 잘 활용"],
  ["양호", "15~30×",  "잘 쓰는 편"],
  ["보통", "8~15×",   "평범. 개선 여지 있음"],
  ["부족", "3~8×",    "큰 컨텍스트 매번 새로 보냄"],
  ["경고", "3× 미만", "활용 미숙"],
];

function MiniGradeTable({ title, rows, current }: { title: string; rows: [GradeLevel, string, string][]; current: GradeLevel }) {
  return (
    <div>
      <p className="text-[10px] font-mono text-slate-400 font-semibold mb-1">{title}</p>
      {rows.map(([g, range, desc]) => (
        <div
          key={g}
          className={`flex items-center gap-1.5 px-1 py-0.5 rounded text-[10px] font-mono ${g === current ? GRADE_TOOLTIP_CLS[g] + " font-bold" : "text-slate-600"}`}
        >
          <span className="w-7 shrink-0">{g}</span>
          <span className="w-20 shrink-0 text-[9px]">{range}</span>
          <span className="text-[9px] opacity-70 truncate">{desc}</span>
          {g === current && <span className="ml-auto text-[8px] shrink-0 opacity-50">←</span>}
        </div>
      ))}
    </div>
  );
}

function cacheHitGrade(v: number): GradeLevel {
  if (v >= 96) return "탁월";
  if (v >= 90) return "양호";
  if (v >= 80) return "보통";
  if (v >= 60) return "부족";
  return "경고";
}
function oneShotGrade(v: number): GradeLevel {
  if (v >= 90) return "탁월";
  if (v >= 80) return "양호";
  if (v >= 70) return "보통";
  if (v >= 60) return "부족";
  return "경고";
}
function costGrade(v: number): GradeLevel {
  if (v < 10) return "탁월";
  if (v < 25) return "양호";
  if (v < 50) return "보통";
  if (v < 100) return "부족";
  return "경고";
}
function callsGrade(v: number): GradeLevel {
  if (v >= 30 && v <= 60) return "탁월";
  if ((v >= 20 && v < 30) || (v > 60 && v <= 80)) return "양호";
  if ((v >= 10 && v < 20) || (v > 80 && v <= 120)) return "보통";
  if ((v >= 5 && v < 10) || (v > 120 && v <= 200)) return "부족";
  return "경고";
}
function costPerCallGrade(v: number): GradeLevel {
  if (v < 0.04) return "탁월";
  if (v < 0.06) return "양호";
  if (v < 0.10) return "보통";
  if (v < 0.20) return "부족";
  return "경고";
}
function outputInputGrade(v: number): GradeLevel {
  if (v >= 30) return "탁월";
  if (v >= 15) return "양호";
  if (v >= 8) return "보통";
  if (v >= 3) return "부족";
  return "경고";
}
function computeGrade(cacheHitPct: number, oneShotRate: number, costPerSession: number): GradeLevel {
  const cacheScore = cacheHitPct / 100;
  const oneShotScore = oneShotRate;
  const costScore = costPerSession <= 1 ? 1 : costPerSession <= 3 ? 0.8 : costPerSession <= 7 ? 0.6 : costPerSession <= 15 ? 0.4 : 0.2;
  const composite = cacheScore * 0.4 + oneShotScore * 0.4 + costScore * 0.2;
  if (composite >= 0.88) return "탁월";
  if (composite >= 0.72) return "양호";
  if (composite >= 0.52) return "보통";
  if (composite >= 0.32) return "부족";
  return "경고";
}

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

function formatWeekRange(periodStart: string): string {
  const [y, m, d] = periodStart.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (dt: Date) => `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;
  return `${fmt(start)}-${fmt(end)}`;
}

function formatMonthLabel(periodStart: string): string {
  return periodStart.slice(0, 7);
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

function TipBtn({ label, onClick, variant = "action" }: { label: string; onClick: () => void; variant?: "explain" | "action" }) {
  return (
    <button
      onClick={onClick}
      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors leading-none ${variant === "explain" ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-indigo-600 text-white hover:bg-indigo-500"}`}
    >{label}</button>
  );
}

interface TeamMember { userId: string; name: string }

export function DashboardView({ targetUserId, onMemberSelect }: { targetUserId?: string; onMemberSelect?: (userId: string) => void }) {
  const viewOnly = !!targetUserId;
  const { data: session, status } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("week");
  const [data, setData] = useState<DashboardData | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [syncCopied, setSyncCopied] = useState(false);
  const [showCacheModal, setShowCacheModal] = useState(false);
  const [showOneShotModal, setShowOneShotModal] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [showCallsModal, setShowCallsModal] = useState(false);
  const [showCacheMethodsModal, setShowCacheMethodsModal] = useState(false);
  const [showOneShotMethodsModal, setShowOneShotMethodsModal] = useState(false);
  const [showCostMethodsModal, setShowCostMethodsModal] = useState(false);
  const [showCallsMethodsModal, setShowCallsMethodsModal] = useState(false);
  const [showCostCallModal, setShowCostCallModal] = useState(false);
  const [showCostCallMethodsModal, setShowCostCallMethodsModal] = useState(false);
  const [showOutputInputModal, setShowOutputInputModal] = useState(false);
  const [showOutputInputMethodsModal, setShowOutputInputMethodsModal] = useState(false);
  const [showTzPicker, setShowTzPicker] = useState(false);
  const [userTz, setUserTz] = useState<string>(() =>
    typeof window !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC"
  );
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const apiUrl = (p: Period, wOff: number, mOff: number) => {
    const params = new URLSearchParams({ period: p });
    if (targetUserId) params.set("userId", targetUserId);
    if (p === "week" && wOff > 0) params.set("weekOffset", String(wOff));
    if (p === "month" && mOff > 0) params.set("monthOffset", String(mOff));
    return `/api/dashboard?${params.toString()}`;
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!viewOnly || !session) return;
    fetch("/api/team")
      .then((r) => r.json())
      .then((d) => {
        const list: TeamMember[] = (d.byEfficiency ?? []).map((m: { userId: string; name: string }) => ({
          userId: m.userId,
          name: m.name,
        }));
        setTeamMembers(list);
      })
      .catch(() => {});
  }, [viewOnly, session]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetch(apiUrl(period, weekOffset, monthOffset))
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) { setFetchError(true); setLoading(false); return; }
        setFetchError(false);
        setData(d);
        setLoading(false);
      })
      .catch(() => { setFetchError(true); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, period, weekOffset, monthOffset, targetUserId]);

  useEffect(() => {
    if (data?.user?.timezone) setUserTz(data.user.timezone);
  }, [data?.user?.timezone]);

  const saveTz = async (tz: string) => {
    setUserTz(tz);
    setShowTzPicker(false);
    await fetch("/api/user/timezone", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: tz }),
    });
  };

  useEffect(() => {
    if (!session || !data || data.overview) return;
    const timer = setInterval(() => {
      fetch(apiUrl(period, weekOffset, monthOffset))
        .then((r) => r.json())
        .then((d) => { if (d.overview) setData(d); });
    }, 4000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, data, period, weekOffset, monthOffset]);

  if (status === "loading" || (!data && !fetchError)) return (
    <div className="min-h-screen bg-neutral-950">
      <Nav />
      <div className="flex items-center justify-center h-64">
        <span className="font-mono text-neutral-500 animate-pulse">loading...</span>
      </div>
    </div>
  );

  if (fetchError) return (
    <div className="min-h-screen bg-neutral-950">
      <Nav />
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-neutral-400 font-mono text-sm">데이터를 불러오지 못했습니다.</p>
        <button
          onClick={() => {
            setFetchError(false); setLoading(true);
            fetch(apiUrl(period, weekOffset, monthOffset)).then((r) => r.json()).then((d) => {
              if (!d?.error) { setData(d); setLoading(false); }
            });
          }}
          className="px-4 py-1.5 bg-neutral-800 rounded text-sm text-neutral-200 hover:bg-neutral-700 font-mono"
        >재시도</button>
      </div>
    </div>
  );

  if (!data) return null;

  if (!data.user.lastSyncedAt && !viewOnly) {
    router.push("/setup");
    return null;
  }

  if (!data.overview) {
    if (viewOnly) return (
      <div className="min-h-screen bg-neutral-950">
        <Nav />
        <div className="flex items-center justify-center h-64">
          <p className="text-neutral-500 font-mono text-sm">아직 데이터가 없습니다.</p>
        </div>
      </div>
    );
    const syncCmd = `npx github:${process.env.NEXT_PUBLIC_GITHUB_ORG ?? "eugene-eee-hongkyu"}/ai-usage-tracker sync`;
    return (
      <div className="min-h-screen bg-neutral-950">
        <header className="border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
          <span className="font-mono font-bold text-neutral-200">Primus Usage</span>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-sm text-neutral-500 hover:text-neutral-300 font-mono">logout</button>
        </header>
        <main className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
          <h1 className="text-2xl font-bold text-neutral-100 font-mono">sync needed</h1>
          <p className="text-neutral-400 text-sm font-mono">터미널에서 아래 명령어를 실행하세요.</p>
          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded px-4 py-3 text-left">
            <code className="flex-1 text-sm text-cyan-400 font-mono break-all">{syncCmd}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(syncCmd); setSyncCopied(true); setTimeout(() => setSyncCopied(false), 2000); }}
              className="shrink-0 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded font-mono"
            >{syncCopied ? "✓" : "복사"}</button>
          </div>
        </main>
      </div>
    );
  }

  const ov = data.overview;
  const chartData = data.daily.map((d) => ({ date: d.date.slice(5), cost: d.cost, sessions: d.sessions }));
  const maxProjectCost = Math.max(...data.projects.map((p) => p.cost), 0.01);
  const maxSessionCost = Math.max(...data.topSessions.map((s) => s.cost), 0.01);

  return (
    <div className={`min-h-screen bg-neutral-950 text-neutral-100 transition-opacity duration-150 ${loading ? "opacity-50 pointer-events-none" : ""}`}>
      <Nav />

      {/* Period Tabs */}
      <div className="border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 pt-3 pb-2 flex gap-1 items-center">
          {(["today", "week", "month", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriod(p);
                if (p !== "week") setWeekOffset(0);
                if (p !== "month") setMonthOffset(0);
              }}
              className={`w-16 text-center py-1 rounded text-xs font-mono transition-colors ${period === p && !(p === "week" && weekOffset > 0) && !(p === "month" && monthOffset > 0) ? "bg-indigo-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"}`}
            >{PERIOD_LABELS[p]}</button>
          ))}
          {period === "week" && (data.availableSnapshots?.weekly?.length ?? 0) > 0 && (
            <select
              value={weekOffset}
              onChange={(e) => setWeekOffset(Number(e.target.value))}
              className={`text-xs font-mono border rounded px-2 py-1 cursor-pointer focus:outline-none ${weekOffset > 0 ? "bg-indigo-600 text-white border-indigo-500" : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200"}`}
            >
              <option value={0}>지난주 ▼</option>
              {data.availableSnapshots!.weekly.map((s, i) => (
                <option key={s.periodStart} value={i + 1}>
                  {`${i + 1}주전 (${formatWeekRange(s.periodStart)})`}
                </option>
              ))}
            </select>
          )}
          {period === "month" && (data.availableSnapshots?.monthly?.length ?? 0) > 0 && (
            <select
              value={monthOffset}
              onChange={(e) => setMonthOffset(Number(e.target.value))}
              className={`text-xs font-mono border rounded px-2 py-1 cursor-pointer focus:outline-none ${monthOffset > 0 ? "bg-indigo-600 text-white border-indigo-500" : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200"}`}
            >
              <option value={0}>지난달 ▼</option>
              {data.availableSnapshots!.monthly.map((s, i) => (
                <option key={s.periodStart} value={i + 1}>
                  {`${i + 1}달전 (${formatMonthLabel(s.periodStart)})`}
                </option>
              ))}
            </select>
          )}
          {viewOnly && teamMembers.length > 0 && (
            <select
              value={targetUserId}
              onChange={(e) => onMemberSelect ? onMemberSelect(e.target.value) : router.push(`/team/${e.target.value}/dashboard`)}
              className="ml-auto text-xs font-mono bg-neutral-800 text-neutral-300 border border-neutral-700 rounded px-2 py-1 self-center hover:border-neutral-500 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {teamMembers.map((m) => (
                <option key={m.userId} value={m.userId}>{m.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Overview Bar */}
      <div className="bg-neutral-900 border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap gap-x-5 gap-y-1 text-sm font-mono">
          {viewOnly && (
            <span className="text-indigo-400 font-semibold self-center mr-2">{data.user.name}</span>
          )}
          <span><span className="text-yellow-400 font-bold">${ov.cost.toFixed(2)}</span><span className="text-neutral-500 ml-1 text-xs">cost</span></span>
          <span><span className="text-blue-400 font-bold">{ov.calls.toLocaleString()}</span><span className="text-neutral-500 ml-1 text-xs">calls</span></span>
          <span><span className="text-cyan-400 font-bold">{ov.sessions}</span><span className="text-neutral-500 ml-1 text-xs">sessions</span></span>
          <span><span className="text-emerald-400 font-bold">{ov.cacheHitPct.toFixed(1)}%</span><span className="text-neutral-500 ml-1 text-xs">cache hit</span></span>
          <span><span className="text-violet-400 font-bold">{Math.round(ov.oneShotRate * 100)}%</span><span className="text-neutral-500 ml-1 text-xs">1-shot</span></span>
          <span className="text-neutral-600 text-xs self-center ml-auto flex items-center gap-3">
            <span>활성 {ov.activeDays}일</span>
            {data.snapshot ? (
              <span className="text-amber-400">
                📌 captured {fmtSyncedAt(data.snapshot.capturedAt, userTz)} {tzAbbr(userTz)}
                {data.snapshot.dataRangeStart && data.snapshot.dataRangeEnd && (
                  <span className="text-neutral-500"> · {formatDateRange(data.snapshot.dataRangeStart, data.snapshot.dataRangeEnd)}</span>
                )}
              </span>
            ) : !viewOnly ? (
              <span className="relative">
                마지막 수신{" "}
                <span className="text-neutral-500">{fmtSyncedAt(data.user.lastSyncedAt, userTz)}</span>{" "}
                <button
                  onClick={() => setShowTzPicker((v) => !v)}
                  className="text-neutral-600 hover:text-neutral-300 text-[10px] font-mono border border-neutral-700 hover:border-neutral-500 rounded px-1 py-0.5 transition-colors"
                  title="타임존 변경"
                >{tzAbbr(userTz)}</button>
                {showTzPicker && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl w-64 py-1 text-left">
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
                마지막 수신 {fmtSyncedAt(data.user.lastSyncedAt, userTz)}
              </span>
            )}
          </span>
        </div>
      </div>

      <main className="px-4 py-4 space-y-4 max-w-6xl mx-auto">

        {/* Row 1: Daily Activity + Efficiency */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Daily Activity */}
          <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-cyan-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">Daily Activity</span>
              {chartData.length > 45 && (
                <span className="flex items-center gap-1 text-[10px] font-mono bg-cyan-900/40 text-cyan-300 border border-cyan-700/60 rounded px-1.5 py-0.5">
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
                        <div key={d.date} className="flex items-center gap-1.5 text-xs font-mono">
                          <span className="w-10 text-neutral-500 shrink-0">{d.date}</span>
                          <div className="w-20 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                            <div className="h-full bg-cyan-500 rounded" style={{ width: `${(d.cost / maxCost) * 100}%` }} />
                          </div>
                          <span className="text-yellow-400 flex-1">{fmt$(d.cost)}</span>
                          {d.sessions > 0 && <span className="text-neutral-600 w-6 text-right">{d.sessions}s</span>}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Efficiency Metrics */}
          <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-fuchsia-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-fuchsia-400 uppercase tracking-wider">Efficiency</span>
              {(() => {
                const grade = computeGrade(ov.cacheHitPct, ov.oneShotRate, ov.sessions > 0 ? ov.cost / ov.sessions : 0);
                const costPs = ov.sessions > 0 ? ov.cost / ov.sessions : 0;
                const callsPs = ov.sessions > 0 ? Math.round(ov.calls / ov.sessions) : 0;
                return (
                  <div className="relative group/grade">
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border cursor-default ${GRADE_STYLES[grade]}`}>
                      {grade}
                    </span>
                    {grade !== "양호" && (
                      <div className="absolute right-0 top-full mt-1 z-50 opacity-0 invisible group-hover/grade:opacity-100 group-hover/grade:visible transition-all duration-100 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-3 w-[580px]">
                        <p className="text-[10px] font-mono text-slate-500 mb-2.5 uppercase tracking-wider">등급 기준</p>
                        <div className="grid grid-cols-2 gap-3">
                          <MiniGradeTable title="Cache hit" rows={CACHE_ROWS} current={cacheHitGrade(ov.cacheHitPct)} />
                          <MiniGradeTable title="One-shot rate" rows={ONESHOT_ROWS} current={oneShotGrade(Math.round(ov.oneShotRate * 100))} />
                          <MiniGradeTable title="Cost / session" rows={COST_ROWS} current={costGrade(costPs)} />
                          <MiniGradeTable title="Calls / session" rows={CALLS_ROWS} current={callsGrade(callsPs)} />
                          <MiniGradeTable title="Cost / call" rows={COST_CALL_ROWS} current={costPerCallGrade(ov.costPerCall ?? 0)} />
                          <MiniGradeTable title="Output / Input" rows={OUTPUT_INPUT_ROWS} current={outputInputGrade(ov.outputInputRatio ?? 0)} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="p-3 font-mono">
              <div className="flex text-xs text-neutral-600 mb-1.5">
                <span className="flex-1">metric</span>
                <span>value</span>
              </div>
              {(() => {
                const costPerSession = ov.sessions > 0 ? ov.cost / ov.sessions : 0;
                const callsPerSession = ov.sessions > 0 ? Math.round(ov.calls / ov.sessions) : 0;
                const BAD: GradeLevel[] = ["보통", "부족", "경고"];
                const isBad = (g: GradeLevel) => BAD.includes(g);
                return [
                  {
                    label: "Cache hit",
                    value: `${ov.cacheHitPct.toFixed(1)}%`,
                    color: "text-emerald-400",
                    grade: cacheHitGrade(ov.cacheHitPct),
                    gradeRows: CACHE_ROWS,
                    gradeTitle: "Cache hit",
                    onDesc: () => setShowCacheModal(true),
                    onAct: () => setShowCacheMethodsModal(true),
                    actLabel: "늘리는법",
                  },
                  {
                    label: "One-shot rate",
                    value: `${Math.round(ov.oneShotRate * 100)}%`,
                    color: "text-violet-400",
                    grade: oneShotGrade(Math.round(ov.oneShotRate * 100)),
                    gradeRows: ONESHOT_ROWS,
                    gradeTitle: "One-shot rate",
                    onDesc: () => setShowOneShotModal(true),
                    onAct: () => setShowOneShotMethodsModal(true),
                    actLabel: "늘리는법",
                  },
                  {
                    label: "Cost / session",
                    value: ov.sessions > 0 ? fmt$(costPerSession) : "$0.00",
                    color: "text-yellow-400",
                    grade: costGrade(costPerSession),
                    gradeRows: COST_ROWS,
                    gradeTitle: "Cost / session",
                    onDesc: () => setShowCostModal(true),
                    onAct: () => setShowCostMethodsModal(true),
                    actLabel: "줄이는법",
                  },
                  {
                    label: "Calls / session",
                    value: callsPerSession.toString(),
                    color: "text-blue-400",
                    grade: callsGrade(callsPerSession),
                    gradeRows: CALLS_ROWS,
                    gradeTitle: "Calls / session",
                    onDesc: () => setShowCallsModal(true),
                    onAct: () => setShowCallsMethodsModal(true),
                    actLabel: "최적화",
                  },
                  {
                    label: "Cost / call",
                    value: ov.calls > 0 ? `$${(ov.costPerCall ?? 0).toFixed(3)}` : "$0.000",
                    color: "text-orange-400",
                    grade: costPerCallGrade(ov.costPerCall ?? 0),
                    gradeRows: COST_CALL_ROWS,
                    gradeTitle: "Cost / call",
                    onDesc: () => setShowCostCallModal(true),
                    onAct: () => setShowCostCallMethodsModal(true),
                    actLabel: "줄이는법",
                  },
                  {
                    label: "Output / Input",
                    value: (ov.outputInputRatio ?? 0) > 0 ? `${(ov.outputInputRatio ?? 0).toFixed(1)}×` : "—",
                    color: "text-cyan-400",
                    grade: outputInputGrade(ov.outputInputRatio ?? 0),
                    gradeRows: OUTPUT_INPUT_ROWS,
                    gradeTitle: "Output / Input",
                    onDesc: () => setShowOutputInputModal(true),
                    onAct: () => setShowOutputInputMethodsModal(true),
                    actLabel: "올리는법",
                  },
                ].map(({ label, value, color, grade, gradeRows, gradeTitle, onDesc, onAct, actLabel }) => (
                  <div key={label} className="flex items-center text-xs py-0.5 gap-2">
                    <span className="text-neutral-400 w-28 shrink-0">{label}</span>
                    <span className="flex gap-1 shrink-0 w-24">
                      <TipBtn label="설명" onClick={onDesc} variant="explain" />
                      {isBad(grade) && <TipBtn label={actLabel} onClick={onAct} />}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <span className={`font-bold ${color}`}>{value}</span>
                      <div className="relative group/mbadge">
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border w-14 text-center block cursor-default ${GRADE_STYLES[grade]}`}>{grade}</span>
                        <div className="absolute right-0 top-full mt-1 z-50 opacity-0 invisible group-hover/mbadge:opacity-100 group-hover/mbadge:visible transition-all duration-100 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-3 w-72">
                          <MiniGradeTable title={gradeTitle} rows={gradeRows} current={grade} />
                        </div>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Row 2: By Project + By Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* By Project */}
          <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-yellow-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-yellow-400 uppercase tracking-wider">By Project</span>
              {data.projects.length > 15 && (
                <span className="flex items-center gap-1 text-[10px] font-mono bg-yellow-900/40 text-yellow-300 border border-yellow-700/60 rounded px-1.5 py-0.5">
                  ↕ scroll · {data.projects.length}
                </span>
              )}
            </div>
            <div className="p-3">
              <div className="flex text-xs text-neutral-600 font-mono mb-1.5 pr-1">
                <span className="flex-1">project</span>
                <span className="w-16 text-right">cost</span>
                <span className="w-14 text-right">avg/s</span>
                <span className="w-6 text-right">s</span>
              </div>
              <div className={data.projects.length > 15 ? "overflow-y-auto max-h-[300px] no-scrollbar" : ""}>
                <div className="space-y-1">
                  {data.projects.map((p) => {
                    const displayPath = formatPath(p.path || p.name);
                    return (
                      <div key={p.name} className="flex items-center gap-1.5 text-xs font-mono">
                        <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                          <div className="h-full bg-yellow-500 rounded" style={{ width: `${(p.cost / maxProjectCost) * 100}%` }} />
                        </div>
                        <span className="flex-1 text-neutral-300 overflow-hidden whitespace-nowrap" style={{ direction: "rtl", textOverflow: "ellipsis", textAlign: "left" }} title={p.path || p.name}>{displayPath}</span>
                        <span className="w-16 text-yellow-400 text-right">{fmt$(p.cost)}</span>
                        <span className="w-14 text-neutral-500 text-right">{fmt$(p.avgCost)}</span>
                        <span className="w-6 text-neutral-600 text-right">{p.sessions}</span>
                      </div>
                    );
                  })}
                  {data.projects.length === 0 && (
                    <p className="text-neutral-600 text-xs font-mono">no data</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* By Activity */}
          <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-violet-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-violet-400 uppercase tracking-wider">By Activity</span>
              {data.activities.length > 15 && (
                <span className="flex items-center gap-1 text-[10px] font-mono bg-violet-900/40 text-violet-300 border border-violet-700/60 rounded px-1.5 py-0.5">
                  ↕ scroll · {data.activities.length}
                </span>
              )}
            </div>
            <div className="p-3">
              <div className="flex text-xs text-neutral-600 font-mono mb-1.5 pr-1">
                <span className="w-16 shrink-0" />
                <span className="flex-1">activity</span>
                <span className="w-16 text-right">cost</span>
                <span className="w-12 text-right">turns</span>
                <span className="w-14 text-right">1-shot</span>
              </div>
              <div className={data.activities.length > 15 ? "overflow-y-auto max-h-[300px] no-scrollbar" : ""}>
                <div className="space-y-1">
                  {(() => {
                    const maxCost = Math.max(...data.activities.map((a) => a.cost), 0.01);
                    return data.activities.map((a) => {
                      const pct = a.oneShotRate != null ? Math.round(a.oneShotRate * 100) : null;
                      return (
                        <div key={a.name} className="flex items-center gap-1.5 text-xs font-mono">
                          <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                            <div className="h-full bg-violet-500 rounded" style={{ width: `${(a.cost / maxCost) * 100}%` }} />
                          </div>
                          <span className="flex-1 text-neutral-300 truncate">{a.name}</span>
                          <span className="w-16 text-yellow-400 text-right">{fmt$(a.cost)}</span>
                          <span className="w-12 text-neutral-500 text-right">{a.turns}</span>
                          <span className={`w-14 text-right font-bold ${pct == null ? "text-neutral-600" : pct >= 70 ? "text-emerald-400" : pct >= 40 ? "text-yellow-400" : "text-neutral-500"}`}>
                            {pct != null ? `${pct}%` : "—"}
                          </span>
                        </div>
                      );
                    });
                  })()}
                  {data.activities.length === 0 && (
                    <p className="text-neutral-600 text-xs font-mono">no data</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Top Sessions + By Model */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Top Sessions */}
          <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-red-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800">
              <span className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider">Top Sessions</span>
            </div>
            <div className="p-3">
              <div className="flex text-xs text-neutral-600 font-mono mb-1.5">
                <span className="w-5">#</span>
                <span className="w-20">date</span>
                <span className="flex-1">project</span>
                <span className="w-16 text-right">cost</span>
                <span className="w-16 text-right">calls</span>
              </div>
              <div className="space-y-1">
                {data.topSessions.slice(0, 5).map((s, i) => {
                  const displayPath = formatPath(s.projectPath || s.project);
                  return (
                    <div key={s.id || i} className="flex items-center gap-2 text-xs font-mono">
                      <span className="w-5 text-neutral-600">{i + 1}.</span>
                      <span className="w-20 text-neutral-500 shrink-0">{s.date}</span>
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                          <div className="h-full bg-red-500 rounded" style={{ width: `${(s.cost / maxSessionCost) * 100}%` }} />
                        </div>
                        <span className="text-neutral-300 overflow-hidden whitespace-nowrap" style={{ direction: "rtl", textOverflow: "ellipsis", textAlign: "left" }} title={s.projectPath || s.project}>{displayPath}</span>
                      </div>
                      <span className="w-16 text-yellow-400 text-right shrink-0">{fmt$(s.cost)}</span>
                      <span className="w-16 text-neutral-500 text-right shrink-0">{s.calls.toLocaleString()}</span>
                    </div>
                  );
                })}
                {data.topSessions.length === 0 && (
                  <p className="text-neutral-600 text-xs font-mono">no data</p>
                )}
              </div>
            </div>
          </div>

          {/* By Model */}
          <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-pink-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800">
              <span className="text-xs font-mono font-bold text-pink-400 uppercase tracking-wider">By Model</span>
            </div>
            <div className="p-3">
              <div className="flex text-xs text-neutral-600 font-mono mb-1.5">
                <span className="flex-1">model</span>
                <span className="w-16 text-right">cost</span>
                <span className="w-14 text-right">cache</span>
                <span className="w-14 text-right">calls</span>
              </div>
              <div className="space-y-1">
                {(data.models ?? []).map((m) => {
                  const maxCost = Math.max(...(data.models ?? []).map((x) => x.cost), 0.01);
                  return (
                    <div key={m.name} className="flex items-center gap-1.5 text-xs font-mono">
                      <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                        <div className="h-full bg-pink-500 rounded" style={{ width: `${(m.cost / maxCost) * 100}%` }} />
                      </div>
                      <span className="flex-1 text-neutral-300 truncate">{m.name}</span>
                      <span className="w-16 text-yellow-400 text-right">{fmt$(m.cost)}</span>
                      <span className="w-14 text-emerald-400 text-right">{m.cacheHitPct.toFixed(1)}%</span>
                      <span className="w-14 text-neutral-500 text-right">{m.calls.toLocaleString()}</span>
                    </div>
                  );
                })}
                {(data.models ?? []).length === 0 && <p className="text-neutral-600 text-xs font-mono">no data</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Row 4: Core Tools + Shell Commands */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Core Tools */}
          <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-teal-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-teal-400 uppercase tracking-wider">Core Tools</span>
              {(data.tools ?? []).length > 15 && (
                <span className="flex items-center gap-1 text-[10px] font-mono bg-teal-900/40 text-teal-300 border border-teal-700/60 rounded px-1.5 py-0.5">
                  ↕ scroll · {(data.tools ?? []).length}
                </span>
              )}
            </div>
            <div className="p-3">
              <div className="flex text-xs text-neutral-600 font-mono mb-1.5">
                <span className="flex-1">tool</span>
                <span className="w-16 text-right">calls</span>
              </div>
              <div className={(data.tools ?? []).length > 15 ? "overflow-y-auto max-h-[300px] no-scrollbar" : ""}>
                <div className="space-y-1">
                  {(data.tools ?? []).map((t) => {
                    const maxCalls = Math.max(...(data.tools ?? []).map((x) => x.calls), 0.01);
                    return (
                      <div key={t.name} className="flex items-center gap-1.5 text-xs font-mono">
                        <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                          <div className="h-full bg-teal-500 rounded" style={{ width: `${(t.calls / maxCalls) * 100}%` }} />
                        </div>
                        <span className="flex-1 text-neutral-300 truncate">{t.name}</span>
                        <span className="w-16 text-blue-400 text-right">{t.calls.toLocaleString()}</span>
                      </div>
                    );
                  })}
                  {(data.tools ?? []).length === 0 && <p className="text-neutral-600 text-xs font-mono">no data</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Shell Commands */}
          <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-orange-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-wider">Shell Commands</span>
              {(data.shellCommands ?? []).length > 15 && (
                <span className="flex items-center gap-1 text-[10px] font-mono bg-orange-900/40 text-orange-300 border border-orange-700/60 rounded px-1.5 py-0.5">
                  ↕ scroll · {(data.shellCommands ?? []).length}
                </span>
              )}
            </div>
            <div className="p-3">
              <div className="flex text-xs text-neutral-600 font-mono mb-1.5">
                <span className="flex-1">command</span>
                <span className="w-16 text-right">calls</span>
              </div>
              <div className={(data.shellCommands ?? []).length > 15 ? "overflow-y-auto max-h-[300px] no-scrollbar" : ""}>
                <div className="space-y-1">
                  {(data.shellCommands ?? []).map((s) => {
                    const maxCalls = Math.max(...(data.shellCommands ?? []).map((x) => x.calls), 0.01);
                    return (
                      <div key={s.name} className="flex items-center gap-1.5 text-xs font-mono">
                        <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                          <div className="h-full bg-orange-500 rounded" style={{ width: `${(s.calls / maxCalls) * 100}%` }} />
                        </div>
                        <span className="flex-1 text-neutral-300 truncate">{s.name}</span>
                        <span className="w-16 text-blue-400 text-right">{s.calls.toLocaleString()}</span>
                      </div>
                    );
                  })}
                  {(data.shellCommands ?? []).length === 0 && <p className="text-neutral-600 text-xs font-mono">no data</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 5: MCP Servers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-cyan-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">MCP Servers</span>
              {(data.mcpServers ?? []).length > 15 && (
                <span className="flex items-center gap-1 text-[10px] font-mono bg-cyan-900/40 text-cyan-300 border border-cyan-700/60 rounded px-1.5 py-0.5">
                  ↕ scroll · {(data.mcpServers ?? []).length}
                </span>
              )}
            </div>
            <div className="p-3">
              <div className="flex text-xs text-neutral-600 font-mono mb-1.5">
                <span className="flex-1">server</span>
                <span className="w-16 text-right">calls</span>
              </div>
              <div className={(data.mcpServers ?? []).length > 15 ? "overflow-y-auto max-h-[300px] no-scrollbar" : ""}>
                <div className="space-y-1">
                  {(data.mcpServers ?? []).map((m) => {
                    const maxCalls = Math.max(...(data.mcpServers ?? []).map((x) => x.calls), 0.01);
                    return (
                      <div key={m.name} className="flex items-center gap-1.5 text-xs font-mono">
                        <div className="w-16 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                          <div className="h-full bg-cyan-500 rounded" style={{ width: `${(m.calls / maxCalls) * 100}%` }} />
                        </div>
                        <span className="flex-1 text-neutral-300 truncate">{m.name}</span>
                        <span className="w-16 text-blue-400 text-right">{m.calls.toLocaleString()}</span>
                      </div>
                    );
                  })}
                  {(data.mcpServers ?? []).length === 0 && <p className="text-neutral-600 text-xs font-mono">no data</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>

      {showCacheModal && (
        <CacheHitModal value={ov.cacheHitPct} onClose={() => setShowCacheModal(false)} />
      )}
      {showOneShotModal && (
        <OneShotRateModal value={Math.round(ov.oneShotRate * 100)} onClose={() => setShowOneShotModal(false)} />
      )}
      {showCostModal && (
        <CostPerSessionModal
          value={ov.sessions > 0 ? ov.cost / ov.sessions : 0}
          sessionsCount={ov.sessions}
          totalCost={ov.cost}
          onClose={() => setShowCostModal(false)}
        />
      )}
      {showCallsModal && (
        <CallsPerSessionModal
          value={ov.sessions > 0 ? Math.round(ov.calls / ov.sessions) : 0}
          callsTotal={ov.calls}
          sessionsCount={ov.sessions}
          onClose={() => setShowCallsModal(false)}
        />
      )}
      {showCacheMethodsModal && (
        <CacheHitModal value={ov.cacheHitPct} onClose={() => setShowCacheMethodsModal(false)} methodsOnly />
      )}
      {showOneShotMethodsModal && (
        <OneShotRateModal value={Math.round(ov.oneShotRate * 100)} onClose={() => setShowOneShotMethodsModal(false)} methodsOnly />
      )}
      {showCostMethodsModal && (
        <CostPerSessionModal
          value={ov.sessions > 0 ? ov.cost / ov.sessions : 0}
          sessionsCount={ov.sessions}
          totalCost={ov.cost}
          onClose={() => setShowCostMethodsModal(false)}
          methodsOnly
        />
      )}
      {showCallsMethodsModal && (
        <CallsPerSessionModal
          value={ov.sessions > 0 ? Math.round(ov.calls / ov.sessions) : 0}
          callsTotal={ov.calls}
          sessionsCount={ov.sessions}
          onClose={() => setShowCallsMethodsModal(false)}
          methodsOnly
        />
      )}
      {showCostCallModal && (
        <CostPerCallModal value={ov.costPerCall ?? 0} totalCost={ov.cost} totalCalls={ov.calls} onClose={() => setShowCostCallModal(false)} />
      )}
      {showCostCallMethodsModal && (
        <CostPerCallModal value={ov.costPerCall ?? 0} totalCost={ov.cost} totalCalls={ov.calls} onClose={() => setShowCostCallMethodsModal(false)} methodsOnly />
      )}
      {showOutputInputModal && (
        <OutputInputRatioModal value={ov.outputInputRatio ?? 0} onClose={() => setShowOutputInputModal(false)} />
      )}
      {showOutputInputMethodsModal && (
        <OutputInputRatioModal value={ov.outputInputRatio ?? 0} onClose={() => setShowOutputInputMethodsModal(false)} methodsOnly />
      )}
    </div>
  );
}
