"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Nav } from "@/components/nav";
import Link from "next/link";
import { ActivityCalendar } from "react-activity-calendar";

interface MemberData {
  user: { id: number; name: string; avatarUrl: string | null };
  summary: { totalTokens: number; totalCost: number; oneShotRate: number; sessionsCount: number };
  daily: Array<{ date: string; tokens: number; cost: number }>;
  streak: number;
  projects: Array<{ name: string; tokens: number }>;
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default function MemberProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;
  const [data, setData] = useState<MemberData | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    fetch(`/api/members/${userId}`)
      .then((r) => r.json())
      .then(setData);
  }, [session, userId]);

  if (!data) return (
    <div className="min-h-screen">
      <Nav />
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-500">로딩 중...</div>
      </div>
    </div>
  );

  // Build activity calendar data (need all dates in range)
  const today = new Date();
  const calData = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const found = data.daily.find((r) => r.date === key);
    calData.push({
      date: key,
      count: found ? Math.min(Math.ceil(found.tokens / 100_000), 4) : 0,
      level: found ? Math.min(Math.ceil(found.tokens / 500_000), 4) as 0 | 1 | 2 | 3 | 4 : 0 as 0 | 1 | 2 | 3 | 4,
    });
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
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs">토큰 (4주)</p>
              <p className="text-slate-200 font-semibold">{fmtTokens(data.summary.totalTokens)}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">비용</p>
              <p className="text-slate-200 font-semibold">${data.summary.totalCost.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">One-shot</p>
              <p className="text-slate-200 font-semibold">{data.summary.oneShotRate}%</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">🔥 Streak</p>
              <p className="text-slate-200 font-semibold">{data.streak}일</p>
            </div>
          </div>
        </div>

        {/* Heatmap */}
        <div className="bg-slate-900 rounded-lg p-4">
          <p className="text-sm text-slate-400 mb-4">활동 히트맵 (4주)</p>
          <ActivityCalendar
            data={calData}
            colorScheme="dark"
            theme={{ dark: ["#1e293b", "#4338ca", "#6366f1", "#818cf8", "#a5b4fc"] }}
            labels={{ legend: { less: "적음", more: "많음" } }}
            showWeekdayLabels
            blockSize={14}
          />
        </div>

        {/* Projects */}
        {data.projects.length > 0 && (
          <div className="bg-slate-900 rounded-lg p-4 space-y-2">
            <p className="text-sm text-slate-400 mb-2">주요 프로젝트</p>
            {data.projects.slice(0, 5).map((p) => (
              <div key={p.name} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{p.name}</span>
                <span className="text-slate-400">{fmtTokens(p.tokens)}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
