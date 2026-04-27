import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, userSnapshots, users } from "@/lib/db";
import { eq } from "drizzle-orm";

type Period = "today" | "week" | "month" | "all";

interface RawOverview {
  cost?: number;
  sessions?: number;
  calls?: number;
  cacheHitPercent?: number;
  totalCost?: number;
  totalSessions?: number;
  cacheHitPct?: number;
  tokens?: { input?: number; cacheRead?: number; cacheWrite?: number };
}

interface RawActivity {
  name?: string;
  category?: string;
  sessions?: number;
  turns?: number;
  cost?: number;
  oneShotRate?: number | null;
}

interface RawProject {
  name?: string;
  path?: string;
  cost?: number;
  sessions?: number;
  calls?: number;
  avgCost?: number;
}

interface RawTopSession {
  id?: string;
  sessionId?: string;
  date?: string;
  project?: string;
  cost?: number;
  calls?: number;
  turns?: number;
}

interface RawModel {
  name?: string;
  cost?: number;
  calls?: number;
  inputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

interface RawNameCalls { name?: string; calls?: number }

interface RawPeriodData {
  overview?: RawOverview;
  summary?: RawOverview;
  daily?: Array<{ date: string; cost: number; sessions: number }>;
  activities?: RawActivity[];
  projects?: RawProject[];
  topSessions?: RawTopSession[];
  models?: RawModel[];
  tools?: RawNameCalls[];
  shellCommands?: RawNameCalls[];
  mcpServers?: RawNameCalls[];
}

function getPeriodData(raw: unknown, period: string): RawPeriodData {
  if (typeof raw !== "object" || raw === null) return {};
  const r = raw as Record<string, unknown>;
  if ("all" in r || "today" in r) {
    return (r[period] ?? r.all ?? {}) as RawPeriodData;
  }
  return r as RawPeriodData;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const period = (req.nextUrl.searchParams.get("period") ?? "week") as Period;

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);
  if (!user[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const snap = await db
    .select()
    .from(userSnapshots)
    .where(eq(userSnapshots.userId, user[0].id))
    .limit(1);

  if (!snap[0]) {
    return NextResponse.json({
      user: { name: user[0].name, lastSyncedAt: user[0].lastSyncedAt, timezone: user[0].timezone ?? null },
      overview: null,
      daily: [],
      activities: [],
      projects: [],
      topSessions: [],
    });
  }

  const d = getPeriodData(snap[0].rawJson, period);
  const ov = d.overview ?? d.summary ?? {};

  const cost = ov.cost ?? ov.totalCost ?? 0;
  const sessions = ov.sessions ?? ov.totalSessions ?? 0;
  const calls = ov.calls ?? 0;
  const tRead = ov.tokens?.cacheRead ?? 0;
  const tWrite = ov.tokens?.cacheWrite ?? 0;
  const tInput = ov.tokens?.input ?? 0;
  const cacheHitPct = (tRead + tWrite + tInput) > 0
    ? (tRead / (tRead + tWrite + tInput)) * 100
    : (() => { const r = ov.cacheHitPercent ?? ov.cacheHitPct ?? 0; return r > 1 ? r : r * 100; })();

  const allActivities = d.activities ?? [];
  const activitiesWithRate = allActivities.filter((a) => a.oneShotRate != null);
  const totalTurns = activitiesWithRate.reduce((s, a) => s + (a.turns ?? a.sessions ?? 1), 0);
  const weightedOneShot = activitiesWithRate.reduce(
    (s, a) => s + ((a.oneShotRate! / 100) * (a.turns ?? a.sessions ?? 1)),
    0
  );
  const oneShotRate = totalTurns > 0 ? weightedOneShot / totalTurns : 0;

  const daily = d.daily ?? [];
  const activeDays = daily.filter((day) => day.cost > 0).length;

  // Build path lookup for topSessions
  const projectPathMap: Record<string, string> = {};
  for (const p of d.projects ?? []) {
    if (p.name && p.path) projectPathMap[p.name] = p.path;
  }

  const projects = (d.projects ?? []).map((p) => {
    const c = p.cost ?? 0;
    const s = p.sessions ?? p.calls ?? 0;
    return {
      name: p.name ?? "",
      path: p.path ?? "",
      cost: c,
      sessions: s,
      avgCost: p.avgCost ?? (s > 0 ? c / s : 0),
    };
  });

  const topSessions = (d.topSessions ?? []).map((s) => ({
    id: s.id ?? s.sessionId ?? "",
    date: s.date ?? "",
    project: s.project ?? "",
    projectPath: projectPathMap[s.project ?? ""] ?? "",
    cost: s.cost ?? 0,
    calls: s.calls ?? s.turns ?? 0,
  }));

  const activities = allActivities.map((a) => ({
    name: a.name ?? a.category ?? "Unknown",
    turns: a.turns ?? a.sessions ?? 0,
    cost: a.cost ?? 0,
    oneShotRate: a.oneShotRate != null
      ? (a.oneShotRate > 1 ? a.oneShotRate / 100 : a.oneShotRate)
      : null,
  }));

  const models = (d.models ?? []).map((m) => {
    const input = m.inputTokens ?? 0;
    const cacheRead = m.cacheReadTokens ?? 0;
    const cacheWrite = m.cacheWriteTokens ?? 0;
    const denom = input + cacheRead + cacheWrite;
    const cacheHit = denom > 0 ? (cacheRead / denom) * 100 : 0;
    return { name: m.name ?? "", cost: m.cost ?? 0, calls: m.calls ?? 0, cacheHitPct: cacheHit };
  });

  const toNameCalls = (arr: RawNameCalls[]) =>
    arr.map((x) => ({ name: x.name ?? "", calls: x.calls ?? 0 }));

  return NextResponse.json({
    user: { name: user[0].name, lastSyncedAt: user[0].lastSyncedAt, timezone: user[0].timezone ?? null },
    overview: { cost, sessions, calls, cacheHitPct, oneShotRate, activeDays },
    daily,
    activities,
    projects,
    topSessions,
    models,
    tools: toNameCalls(d.tools ?? []),
    shellCommands: toNameCalls(d.shellCommands ?? []),
    mcpServers: toNameCalls(d.mcpServers ?? []),
  });
}
