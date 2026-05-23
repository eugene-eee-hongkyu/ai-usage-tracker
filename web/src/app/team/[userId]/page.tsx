"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Nav } from "@/components/nav";
import { ViewAsBanner } from "@/components/view-as-banner";
import Link from "next/link";
import { ActivityCalendar } from "react-activity-calendar";
import { useLocalMode } from "@/lib/use-local-mode";
import { useMessages } from "@/lib/use-i18n";
interface MemberData {
  user: { id: number; name: string; avatarUrl: string | null };
  summary: { totalCost: number; sessionsCount: number; cacheHitPct: number };
  daily: Array<{ date: string; cost: number; sessions: number }>;
  streak: number;
  projects: Array<{ name: string; cost: number; sessions: number; avgCost: number }>;
}

interface NotFoundResp { error: string }

export default function MemberProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;
  const isLocalMode = useLocalMode();
  const { m: t } = useMessages();
  const [data, setData] = useState<MemberData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (isLocalMode === null || isLocalMode) return;
    if (status === "unauthenticated") router.push("/login");
  }, [status, router, isLocalMode]);

  useEffect(() => {
    if (!session) return;
    fetch(`/api/members/${userId}`)
      .then((r) => r.json())
      .then((j: MemberData | NotFoundResp) => {
        if ("error" in j) {
          setNotFound(true);
        } else {
          setData(j);
        }
      });
  }, [session, userId]);

  if (notFound) return (
    <div className="min-h-screen">
      <Nav /><ViewAsBanner />
      <main className="max-w-3xl mx-auto px-4 py-12 text-center space-y-4" data-testid="member-not-found">
        <Link href="/team" className="text-slate-400 hover:text-slate-200 text-sm inline-block">{t.memberProfile.teamRanking}</Link>
        <p className="text-slate-300 text-lg">{t.memberProfile.notFound}</p>
        <p className="text-slate-500 text-sm">{t.memberProfile.badId}</p>
        <Link href="/team" className="inline-block px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded transition-colors">
          {t.memberProfile.backToTeamRanking}
        </Link>
      </main>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen">
      <Nav /><ViewAsBanner />
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-500">{t.memberProfile.loading}</div>
      </div>
    </div>
  );

  // user 있고 snapshots 없음 → 빈 데이터 메시지 (sessionsCount=0 + daily 0)
  if (data.summary.sessionsCount === 0 && data.daily.length === 0) {
    return (
      <div className="min-h-screen">
        <Nav /><ViewAsBanner />
        <main className="max-w-3xl mx-auto px-4 py-12 text-center space-y-4" data-testid="member-empty">
          <Link href="/team" className="text-slate-400 hover:text-slate-200 text-sm inline-block">{t.memberProfile.teamRanking}</Link>
          <h1 className="font-semibold text-slate-200">{data.user.name}{t.memberProfile.profileSuffix}</h1>
          <p className="text-slate-500 text-sm">{t.memberProfile.noDataYet}</p>
          <p className="text-slate-600 text-xs">{t.memberProfile.noDataHint}</p>
        </main>
      </div>
    );
  }

  const today = new Date();
  const calData = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const found = data.daily.find((r) => r.date === key);
    const cost = found?.cost ?? 0;
    // levels: 0=$0, 1=<$0.5, 2=<$2, 3=<$5, 4>=$5
    // 임계: 외부 (Anthropic 평균 $6, 엔터 90th $30) + 내부 (p50 $21, p90 $154) 결합
    const level: 0 | 1 | 2 | 3 | 4 =
      cost === 0 ? 0 :
      cost < 5 ? 1 :
      cost < 25 ? 2 :
      cost < 100 ? 3 :
      4;
    calData.push({ date: key, count: Math.round(cost * 100), level });
  }

  return (
    <div className="min-h-screen">
      <Nav /><ViewAsBanner />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/team" className="text-slate-400 hover:text-slate-200 text-sm">{t.memberProfile.teamRanking}</Link>
          <h1 className="font-semibold text-slate-200">{data.user.name}{t.memberProfile.profileSuffix}</h1>
        </div>

        {/* Summary */}
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div data-testid="member-summary-cost">
              <p className="text-slate-500 text-xs">{t.memberProfile.totalCost}</p>
              <p className="text-slate-200 font-semibold">${data.summary.totalCost.toFixed(2)}</p>
            </div>
            <div data-testid="member-summary-sessions">
              <p className="text-slate-500 text-xs">{t.memberProfile.sessionsCount}</p>
              <p className="text-slate-200 font-semibold">{data.summary.sessionsCount}{t.memberProfile.sessionsUnit}</p>
            </div>
            <div data-testid="member-summary-cache">
              <p className="text-slate-500 text-xs">Cache hit</p>
              <p className="text-slate-200 font-semibold">{Math.round(data.summary.cacheHitPct)}%</p>
            </div>
            <div data-testid="member-summary-streak">
              <p className="text-slate-500 text-xs">🔥 Streak</p>
              <p className="text-slate-200 font-semibold">{data.streak}{t.memberProfile.streakDaysUnit}</p>
            </div>
          </div>
        </div>

        {/* Heatmap (cost-based) */}
        <div className="bg-slate-900 rounded-lg p-4" data-testid="member-heatmap-4w">
          <p className="text-sm text-slate-400 mb-4">{t.memberProfile.activityHeatmap4w}</p>
          <ActivityCalendar
            data={calData}
            colorScheme="dark"
            theme={{ dark: ["#1e293b", "#4338ca", "#6366f1", "#818cf8", "#a5b4fc"] }}
            labels={{ legend: { less: "$0", more: "$100+" }, totalCount: "" }}
            showWeekdayLabels
            blockSize={14}
          />
        </div>

        {/* Projects (cost-based) */}
        {data.projects.length > 0 && (
          <div className="bg-slate-900 rounded-lg p-4 space-y-2">
            <p className="text-sm text-slate-400 mb-2">{t.memberProfile.topProjects}</p>
            {data.projects.map((p, i) => (
              <div
                key={p.name}
                data-testid={`member-project-row-${i}`}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-slate-300 flex-1 truncate">{p.name}</span>
                <span className="text-slate-400 w-16 text-right">${p.cost.toFixed(2)}</span>
                <span className="text-slate-600 w-12 text-right text-xs">{p.sessions}{t.memberProfile.sessionsCountUnit}</span>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
