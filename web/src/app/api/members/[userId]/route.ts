export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, userSnapshots, users, teamMembers, IS_LOCAL_MODE } from "@/lib/db";
import { getAuthedEmail } from "@/lib/local-user";
import { getEffectiveTeamId } from "@/lib/effective-team";
import { and, eq, isNull } from "drizzle-orm";
import { isAdmin } from "@/lib/admin";

interface DailyRow { date: string; cost: number; sessions: number }
interface ProjectRow { name: string; cost: number; sessions: number; avgCost: number }

interface RawProject {
  name?: string;
  cost?: number;
  sessions?: number;
  calls?: number;
  avgCost?: number;
}

interface RawOverview {
  tokens?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
}

interface RawPeriodBlock {
  overview?: RawOverview;
  summary?: RawOverview;
  daily?: DailyRow[];
  projects?: RawProject[];
}

interface RawJson {
  all?: RawPeriodBlock;
  overview?: RawOverview;
  summary?: RawOverview;
  daily?: DailyRow[];
  projects?: RawProject[];
}

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const session = IS_LOCAL_MODE ? null : await getServerSession(authOptions);
  const authedEmail = await getAuthedEmail(session?.user?.email);
  if (!authedEmail)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = parseInt(params.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: "invalid_user_id" }, { status: 400 });
  }

  // Team 격리 가드 — dashboard 라우트와 동일 패턴. cross-team snapshot
  // 누출 방지: target user 가 호출자의 effectiveTeam 멤버일 때만 통과.
  // LOCAL_MODE 는 single-tenant 라 통과.
  if (!IS_LOCAL_MODE) {
    const effectiveTeamId = await getEffectiveTeamId(session, req);
    if (!effectiveTeamId)
      return NextResponse.json({ error: "no_team" }, { status: 403 });
    const targetMembership = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, effectiveTeamId),
          eq(teamMembers.userId, userId),
          isNull(teamMembers.deletedAt),
        ),
      )
      .limit(1);
    if (!targetMembership[0])
      return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Multi-provider Phase 1 baseline: claude row 만. Phase 2 에서 provider 별 분리.
  const snap = await db
    .select()
    .from(userSnapshots)
    .where(and(eq(userSnapshots.userId, userId), eq(userSnapshots.provider, "claude")))
    .limit(1);

  if (!snap[0]) {
    return NextResponse.json({
      user: { id: user[0].id, name: user[0].name, avatarUrl: user[0].avatarUrl },
      summary: { totalCost: 0, sessionsCount: 0, cacheHitPct: 0 },
      daily: [],
      streak: 0,
      projects: [],
    });
  }

  const raw = snap[0].rawJson as RawJson;
  const block: RawPeriodBlock = raw.all ?? raw;
  const allDaily: DailyRow[] = block.daily ?? [];
  const projects: ProjectRow[] = (block.projects ?? []).map((p) => {
    const cost = p.cost ?? 0;
    const sessions = p.sessions ?? p.calls ?? 0;
    return {
      name: p.name ?? "",
      cost,
      sessions,
      avgCost: p.avgCost ?? (sessions > 0 ? cost / sessions : 0),
    };
  });

  // 4 weeks of daily for heatmap
  const since = new Date();
  since.setDate(since.getDate() - 27);
  const sinceStr = since.toISOString().slice(0, 10);
  const recentDaily = allDaily.filter((d) => d.date >= sinceStr);

  // streak: consecutive days with activity from today backward.
  // todayYmd 와 일별 산술 모두 사용자 timezone 기반. allDaily.date 는 codeburn
  // 이 사용자 timezone 으로 기록한 YYYY-MM-DD 이므로 비교 키도 같아야 KST/SGT
  // 사용자가 UTC 자정 근처에 streak=0 으로 잘못 표시되는 mismatch 회피.
  const userTz = user[0].timezone ?? "UTC";
  const todayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: userTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const getPart = (t: string) => todayParts.find((p) => p.type === t)?.value ?? "00";
  let cursor = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
  const activeDateSet = new Set(allDaily.filter((d) => d.cost > 0).map((d) => d.date));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    if (activeDateSet.has(cursor)) {
      streak++;
      // 다음 iteration 을 위해 cursor -1 day (UTC anchor 산술, DST 영향 X).
      const [y, m, d] = cursor.split("-").map(Number);
      const utc = new Date(Date.UTC(y, m - 1, d));
      utc.setUTCDate(utc.getUTCDate() - 1);
      cursor = utc.toISOString().slice(0, 10);
    } else {
      break;
    }
  }

  const ov = block.overview ?? block.summary ?? {};
  const tRead = ov.tokens?.cacheRead ?? 0;
  const tWrite = ov.tokens?.cacheWrite ?? 0;
  const tInput = ov.tokens?.input ?? 0;
  const cacheHitPct = (tRead + tWrite + tInput) > 0
    ? (tRead / (tRead + tWrite + tInput)) * 100
    : snap[0].cacheHitPct ?? 0;

  return NextResponse.json({
    user: { id: user[0].id, name: user[0].name, avatarUrl: user[0].avatarUrl },
    summary: {
      totalCost: snap[0].totalCost,
      sessionsCount: snap[0].sessionsCount,
      cacheHitPct,
    },
    daily: recentDaily.map((d) => ({ date: d.date, cost: d.cost, sessions: d.sessions })),
    streak,
    projects: projects.sort((a, b) => b.cost - a.cost).slice(0, 10),
    canViewFullDashboard: IS_LOCAL_MODE ? true : isAdmin(authedEmail),
  });
}
