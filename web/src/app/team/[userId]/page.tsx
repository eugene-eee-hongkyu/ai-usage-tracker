"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Nav } from "@/components/nav";
import Link from "next/link";
import { ActivityCalendar } from "react-activity-calendar";
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
  const [data, setData] = useState<MemberData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

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
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-12 text-center space-y-4" data-testid="member-not-found">
        <Link href="/team" className="text-slate-400 hover:text-slate-200 text-sm inline-block">← 팀랭킹</Link>
        <p className="text-slate-300 text-lg">⚠ 멤버를 찾을 수 없어요</p>
        <p className="text-slate-500 text-sm">잘못된 ID 일 수 있어요.</p>
        <Link href="/team" className="inline-block px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded transition-colors">
          팀랭킹으로 돌아가기
        </Link>
      </main>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen">
      <Nav />
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-500">로딩 중...</div>
      </div>
    </div>
  );

  // user 있고 snapshots 없음 → 빈 데이터 메시지 (sessionsCount=0 + daily 0)
  if (data.summary.sessionsCount === 0 && data.daily.length === 0) {
    return (
      <div className="min-h-screen">
        <Nav />
        <main className="max-w-3xl mx-auto px-4 py-12 text-center space-y-4" data-testid="member-empty">
          <Link href="/team" className="text-slate-400 hover:text-slate-200 text-sm inline-block">← 팀랭킹</Link>
          <h1 className="font-semibold text-slate-200">{data.user.name} 프로필</h1>
          <p className="text-slate-500 text-sm">아직 데이터가 없어요</p>
          <p className="text-slate-600 text-xs">사용자가 첫 Claude Code 세션을 종료하면 자동으로 수집됩니다.</p>
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
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/team" className="text-slate-400 hover:text-slate-200 text-sm">← 팀랭킹</Link>
          <h1 className="font-semibold text-slate-200">{data.user.name} 프로필</h1>
        </div>

        {/* Summary */}
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div data-testid="member-summary-cost">
              <p className="text-slate-500 text-xs">총 비용</p>
              <p className="text-slate-200 font-semibold">${data.summary.totalCost.toFixed(2)}</p>
            </div>
            <div data-testid="member-summary-sessions">
              <p className="text-slate-500 text-xs">세션 수</p>
              <p className="text-slate-200 font-semibold">{data.summary.sessionsCount}회</p>
            </div>
            <div data-testid="member-summary-cache">
              <p className="text-slate-500 text-xs">Cache hit</p>
              <p className="text-slate-200 font-semibold">{Math.round(data.summary.cacheHitPct)}%</p>
            </div>
            <div data-testid="member-summary-streak">
              <p className="text-slate-500 text-xs">🔥 Streak</p>
              <p className="text-slate-200 font-semibold">{data.streak}일</p>
            </div>
          </div>
        </div>

        {/* Heatmap (cost-based) */}
        <div className="bg-slate-900 rounded-lg p-4" data-testid="member-heatmap-4w">
          <p className="text-sm text-slate-400 mb-4">활동 히트맵 (4주, 비용 기준)</p>
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
            <p className="text-sm text-slate-400 mb-2">주요 프로젝트</p>
            {data.projects.map((p, i) => (
              <div
                key={p.name}
                data-testid={`member-project-row-${i}`}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-slate-300 flex-1 truncate">{p.name}</span>
                <span className="text-slate-400 w-16 text-right">${p.cost.toFixed(2)}</span>
                <span className="text-slate-600 w-12 text-right text-xs">{p.sessions}회</span>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
