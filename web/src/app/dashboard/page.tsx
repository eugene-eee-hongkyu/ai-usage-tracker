"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { Nav } from "@/components/nav";
import Link from "next/link";

type Period = "today" | "week" | "month" | "all";

interface Overview {
  cost: number;
  sessions: number;
  calls: number;
  cacheHitPct: number;
  oneShotRate: number;
  activeDays: number;
}

interface Activity {
  name: string;
  sessions: number;
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

interface DashboardData {
  user: { name: string; lastSyncedAt: string | null };
  overview: Overview | null;
  daily: DailyRow[];
  activities: Activity[];
  projects: Project[];
  topSessions: TopSession[];
  models: Model[];
  tools: NameCalls[];
  shellCommands: NameCalls[];
  mcpServers: NameCalls[];
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "오늘", week: "이번주", month: "이번달", all: "전체",
};

function formatPath(path: string): string {
  if (!path) return "";
  if (path.startsWith("/")) {
    const m = path.match(/^\/(?:Users|home)\/[^/]+\/(.+)$/);
    return m ? m[1] : path;
  }
  return path;
}

function fmt$(n: number) { return `$${n.toFixed(2)}`; }

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ payload: { cost: number; sessions: number } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const { cost, sessions } = payload[0].payload;
  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs font-mono shadow-lg space-y-0.5">
      <p className="text-neutral-400">{label}</p>
      <p className="text-yellow-400">${cost.toFixed(3)}</p>
      {sessions > 0 && <p className="text-neutral-500">{sessions}s</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("week");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [syncCopied, setSyncCopied] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetch(`/api/dashboard?period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) { setFetchError(true); setLoading(false); return; }
        setFetchError(false);
        setData(d);
        setLoading(false);
      })
      .catch(() => { setFetchError(true); setLoading(false); });
  }, [session, period]);

  useEffect(() => {
    if (!session || !data || data.overview) return;
    const timer = setInterval(() => {
      fetch(`/api/dashboard?period=${period}`)
        .then((r) => r.json())
        .then((d) => { if (d.overview) setData(d); });
    }, 4000);
    return () => clearInterval(timer);
  }, [session, data, period]);

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
            fetch(`/api/dashboard?period=${period}`).then((r) => r.json()).then((d) => {
              if (!d?.error) { setData(d); setLoading(false); }
            });
          }}
          className="px-4 py-1.5 bg-neutral-800 rounded text-sm text-neutral-200 hover:bg-neutral-700 font-mono"
        >재시도</button>
      </div>
    </div>
  );

  if (!data) return null;

  if (!data.user.lastSyncedAt) {
    router.push("/setup");
    return null;
  }

  if (!data.overview) {
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
      <div className="flex gap-1 px-4 pt-3 pb-2 border-b border-neutral-800">
        {(["today", "week", "month", "all"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded text-xs font-mono transition-colors ${period === p ? "bg-indigo-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"}`}
          >{PERIOD_LABELS[p]}</button>
        ))}
      </div>

      {/* Overview Bar */}
      <div className="px-4 py-2.5 flex flex-wrap gap-x-5 gap-y-1 text-sm font-mono bg-neutral-900 border-b border-neutral-800">
        <span><span className="text-yellow-400 font-bold">${ov.cost.toFixed(2)}</span><span className="text-neutral-500 ml-1 text-xs">cost</span></span>
        <span><span className="text-blue-400 font-bold">{ov.calls.toLocaleString()}</span><span className="text-neutral-500 ml-1 text-xs">calls</span></span>
        <span><span className="text-cyan-400 font-bold">{ov.sessions}</span><span className="text-neutral-500 ml-1 text-xs">sessions</span></span>
        <span><span className="text-emerald-400 font-bold">{ov.cacheHitPct.toFixed(1)}%</span><span className="text-neutral-500 ml-1 text-xs">cache hit</span></span>
        <span><span className="text-violet-400 font-bold">{Math.round(ov.oneShotRate * 100)}%</span><span className="text-neutral-500 ml-1 text-xs">1-shot</span></span>
        <span className="text-neutral-600 text-xs self-center ml-auto">활성 {ov.activeDays}일</span>
      </div>

      <main className="px-4 py-4 space-y-4 max-w-6xl mx-auto">

        {/* Row 1: Daily Activity + By Project */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Daily Activity */}
          <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-cyan-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800">
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">Daily Activity</span>
            </div>
            <div className="p-3">
              {chartData.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-neutral-600 text-xs font-mono">no data</div>
              ) : (
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={chartData} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fill: "#525252", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis hide />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(99,102,241,0.08)" }} />
                    <Bar dataKey="cost" fill="#6366f1" radius={[2, 2, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* By Project */}
          <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-yellow-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-yellow-400 uppercase tracking-wider">By Project</span>
              {data.projects.length > 8 && (
                <Link href="/dashboard/detail" className="text-xs font-mono text-neutral-500 hover:text-neutral-300">+{data.projects.length - 8} more →</Link>
              )}
            </div>
            <div className="p-3">
              <div className="flex text-xs text-neutral-600 font-mono mb-1.5 pr-1">
                <span className="flex-1">project</span>
                <span className="w-16 text-right">cost</span>
                <span className="w-14 text-right">avg/s</span>
                <span className="w-6 text-right">s</span>
              </div>
              <div className="space-y-1">
                {data.projects.slice(0, 8).map((p) => {
                  const barOpacity = 0.25 + (p.cost / maxProjectCost) * 0.75;
                  const displayPath = formatPath(p.path || p.name);
                  return (
                    <div key={p.name} className="flex items-center gap-1.5 text-xs font-mono">
                      <div className="w-1.5 h-3.5 rounded-sm shrink-0 bg-yellow-500" style={{ opacity: barOpacity }} />
                      <span className="flex-1 text-neutral-300 truncate" title={displayPath}>{displayPath}</span>
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

        {/* Row 2: Top Sessions (full width) */}
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
                const barOpacity = 0.2 + (s.cost / maxSessionCost) * 0.8;
                const displayPath = formatPath(s.projectPath || s.project);
                return (
                  <div key={s.id || i} className="flex items-center gap-2 text-xs font-mono">
                    <span className="w-5 text-neutral-600">{i + 1}.</span>
                    <span className="w-20 text-neutral-500 shrink-0">{s.date}</span>
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <div className="w-10 h-1.5 bg-neutral-800 rounded overflow-hidden shrink-0">
                        <div className="h-full bg-red-500 rounded" style={{ opacity: barOpacity, width: "100%" }} />
                      </div>
                      <span className="text-neutral-300 truncate" title={displayPath}>{displayPath}</span>
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

        {/* Row 3: Efficiency Metrics + By Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Efficiency Metrics */}
          <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-fuchsia-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800">
              <span className="text-xs font-mono font-bold text-fuchsia-400 uppercase tracking-wider">Efficiency</span>
            </div>
            <div className="p-3 font-mono">
              <div className="flex text-xs text-neutral-600 mb-1.5">
                <span className="flex-1">metric</span>
                <span>value</span>
              </div>
              {[
                {
                  label: "Cache hit",
                  value: `${ov.cacheHitPct.toFixed(1)}%`,
                  color: ov.cacheHitPct >= 80 ? "text-emerald-400" : ov.cacheHitPct >= 50 ? "text-yellow-400" : "text-red-400",
                },
                {
                  label: "One-shot rate",
                  value: `${Math.round(ov.oneShotRate * 100)}%`,
                  color: ov.oneShotRate >= 0.7 ? "text-emerald-400" : ov.oneShotRate >= 0.4 ? "text-yellow-400" : "text-neutral-400",
                },
                {
                  label: "Cost / session",
                  value: ov.sessions > 0 ? fmt$(ov.cost / ov.sessions) : "$0.00",
                  color: "text-yellow-400",
                },
                {
                  label: "Calls / session",
                  value: ov.sessions > 0 ? Math.round(ov.calls / ov.sessions).toString() : "0",
                  color: "text-blue-400",
                },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-neutral-400">{label}</span>
                  <span className={`font-bold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Activity */}
          <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-violet-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800">
              <span className="text-xs font-mono font-bold text-violet-400 uppercase tracking-wider">By Activity</span>
            </div>
            <div className="p-3">
              <div className="flex text-xs text-neutral-600 font-mono mb-1.5">
                <span className="w-24">activity</span>
                <span className="flex-1 ml-2">1-shot</span>
                <span className="w-10 text-right">%</span>
                <span className="w-14 text-right">turns</span>
              </div>
              <div className="space-y-1.5">
                {data.activities.map((a) => {
                  const pct = a.oneShotRate != null ? Math.round(a.oneShotRate * 100) : null;
                  return (
                    <div key={a.name} className="flex items-center gap-2 text-xs font-mono">
                      <span className="w-24 text-neutral-300 truncate">{a.name}</span>
                      <div className="flex-1 bg-neutral-800 rounded h-1.5 overflow-hidden">
                        <div className="bg-violet-500 h-full rounded" style={{ width: `${pct ?? 0}%` }} />
                      </div>
                      <span className={`w-10 text-right font-bold ${pct == null ? "text-neutral-600" : pct >= 70 ? "text-emerald-400" : pct >= 40 ? "text-yellow-400" : "text-neutral-500"}`}>
                        {pct != null ? `${pct}%` : "—"}
                      </span>
                      <span className="w-14 text-neutral-500 text-right">{a.sessions}</span>
                    </div>
                  );
                })}
                {data.activities.length === 0 && (
                  <p className="text-neutral-600 text-xs font-mono">no data</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Row 4: By Model + MCP Servers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

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
                  const barOpacity = 0.25 + (m.cost / maxCost) * 0.75;
                  return (
                    <div key={m.name} className="flex items-center gap-1.5 text-xs font-mono">
                      <div className="w-1.5 h-3.5 rounded-sm shrink-0 bg-pink-500" style={{ opacity: barOpacity }} />
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

          {/* MCP Servers */}
          <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-cyan-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800">
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">MCP Servers</span>
            </div>
            <div className="p-3">
              <div className="flex text-xs text-neutral-600 font-mono mb-1.5">
                <span className="flex-1">server</span>
                <span className="w-16 text-right">calls</span>
              </div>
              <div className="space-y-1">
                {(data.mcpServers ?? []).map((m) => {
                  const maxCalls = Math.max(...(data.mcpServers ?? []).map((x) => x.calls), 0.01);
                  const barOpacity = 0.25 + (m.calls / maxCalls) * 0.75;
                  return (
                    <div key={m.name} className="flex items-center gap-1.5 text-xs font-mono">
                      <div className="w-1.5 h-3.5 rounded-sm shrink-0 bg-cyan-500" style={{ opacity: barOpacity }} />
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

        {/* Row 5: Core Tools + Shell Commands */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Core Tools */}
          <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-teal-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800">
              <span className="text-xs font-mono font-bold text-teal-400 uppercase tracking-wider">Core Tools</span>
            </div>
            <div className="p-3">
              <div className="flex text-xs text-neutral-600 font-mono mb-1.5">
                <span className="flex-1">tool</span>
                <span className="w-16 text-right">calls</span>
              </div>
              <div className="space-y-1">
                {(data.tools ?? []).slice(0, 10).map((t) => {
                  const maxCalls = Math.max(...(data.tools ?? []).map((x) => x.calls), 0.01);
                  const barOpacity = 0.25 + (t.calls / maxCalls) * 0.75;
                  return (
                    <div key={t.name} className="flex items-center gap-1.5 text-xs font-mono">
                      <div className="w-1.5 h-3.5 rounded-sm shrink-0 bg-teal-500" style={{ opacity: barOpacity }} />
                      <span className="flex-1 text-neutral-300 truncate">{t.name}</span>
                      <span className="w-16 text-blue-400 text-right">{t.calls.toLocaleString()}</span>
                    </div>
                  );
                })}
                {(data.tools ?? []).length === 0 && <p className="text-neutral-600 text-xs font-mono">no data</p>}
              </div>
            </div>
          </div>

          {/* Shell Commands */}
          <div className="bg-neutral-900 border border-neutral-800 border-l-2 border-l-orange-500 rounded">
            <div className="px-3 py-2 border-b border-neutral-800">
              <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-wider">Shell Commands</span>
            </div>
            <div className="p-3">
              <div className="flex text-xs text-neutral-600 font-mono mb-1.5">
                <span className="flex-1">command</span>
                <span className="w-16 text-right">calls</span>
              </div>
              <div className="space-y-1">
                {(data.shellCommands ?? []).slice(0, 10).map((s) => {
                  const maxCalls = Math.max(...(data.shellCommands ?? []).map((x) => x.calls), 0.01);
                  const barOpacity = 0.25 + (s.calls / maxCalls) * 0.75;
                  return (
                    <div key={s.name} className="flex items-center gap-1.5 text-xs font-mono">
                      <div className="w-1.5 h-3.5 rounded-sm shrink-0 bg-orange-500" style={{ opacity: barOpacity }} />
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

      </main>
    </div>
  );
}
