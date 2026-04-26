"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import Link from "next/link";

type Period = "today" | "week" | "month" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  today: "오늘", week: "이번주", month: "이번달", all: "전체",
};

interface MemberStat {
  userId: number;
  name: string;
  avatarUrl: string | null;
  totalCost: number;
  sessionsCount: number;
  cacheHitPct: number;
  overallOneShot: number;
  efficiencyScore: number;
  topProject: string;
}

interface TeamData {
  mvp: (MemberStat & { blurb: string }) | null;
  byOneShotRate: MemberStat[];
  byEfficiency: MemberStat[];
  bySessions: MemberStat[];
}

export default function TeamPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("all");
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetch(`/api/team?period=${period}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [session, period]);

  if (!data) return (
    <div className="min-h-screen">
      <Nav />
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-500">로딩 중...</div>
      </div>
    </div>
  );

  const hasData = data.byEfficiency.length > 0;

  return (
    <div className="min-h-screen">
      <Nav />

      {/* Period Tabs */}
      <div className="border-b border-neutral-800">
        <div className="max-w-3xl mx-auto px-4 pt-3 pb-2 flex gap-1">
          {(["today", "week", "month", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`w-16 text-center py-1 rounded text-xs font-mono transition-colors ${period === p ? "bg-indigo-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"}`}
            >{PERIOD_LABELS[p]}</button>
          ))}
        </div>
      </div>

      <main className={`max-w-3xl mx-auto px-4 py-6 space-y-6 transition-opacity duration-150 ${loading ? "opacity-40 pointer-events-none" : "opacity-100"}`}>

        {/* MVP card */}
        {data.mvp ? (
          <Link href={`/team/${data.mvp.userId}`} className="block">
            <div className="bg-gradient-to-r from-yellow-950 to-slate-900 border border-yellow-800 rounded-lg p-4 hover:border-yellow-600 transition-colors">
              <p className="text-yellow-400 font-semibold text-sm mb-1">🏆 MVP</p>
              <p className="text-xl font-bold text-slate-100">{data.mvp.name}</p>
              <p className="text-sm text-slate-400 mt-1">
                one-shot {Math.round(data.mvp.overallOneShot * 100)}% · cache {Math.round(data.mvp.cacheHitPct)}% · 효율 {data.mvp.efficiencyScore}
              </p>
              <p className="text-xs text-slate-500 mt-1 italic">&ldquo;{data.mvp.blurb}&rdquo;</p>
            </div>
          </Link>
        ) : (
          <div className="bg-slate-900 rounded-lg p-4 text-center text-slate-500 text-sm">
            {hasData ? "해당 기간에 활동 데이터가 없어요." : "아직 데이터가 없어요. CLI 설치 후 세션을 종료하면 데이터가 수집됩니다."}
          </div>
        )}

        {hasData && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 최고 정확도 */}
            <div className="bg-slate-900 rounded-lg p-4 space-y-2">
              <p className="text-sm text-slate-400 font-medium">최고 정확도</p>
              <p className="text-xs text-slate-600">one-shot rate 순</p>
              {data.byOneShotRate.map((m, i) => (
                <Link key={m.userId} href={`/team/${m.userId}`} className="flex items-center gap-1 text-sm hover:bg-slate-800 px-1 rounded transition-colors">
                  <span className="text-slate-500 w-5">{i + 1}.</span>
                  <span className="text-slate-200 flex-1 truncate">{m.name}</span>
                  <span className="text-slate-300 font-medium text-xs">{Math.round(m.overallOneShot * 100)}%</span>
                </Link>
              ))}
            </div>

            {/* 최고 효율 */}
            <div className="bg-slate-900 rounded-lg p-4 space-y-2">
              <p className="text-sm text-slate-400 font-medium">최고 효율</p>
              <p className="text-xs text-slate-600">one-shot × cache / 비용</p>
              {data.byEfficiency.map((m, i) => (
                <Link key={m.userId} href={`/team/${m.userId}`} className="flex items-center gap-1 text-sm hover:bg-slate-800 px-1 rounded transition-colors">
                  <span className="text-slate-500 w-5">{i + 1}.</span>
                  <span className="text-slate-200 flex-1 truncate">{m.name}</span>
                  <span className="text-slate-300 font-medium text-xs">{m.efficiencyScore}</span>
                </Link>
              ))}
            </div>

            {/* 최다 활동 */}
            <div className="bg-slate-900 rounded-lg p-4 space-y-2">
              <p className="text-sm text-slate-400 font-medium">최다 활동</p>
              <p className="text-xs text-slate-600">세션 수 순</p>
              {data.bySessions.map((m, i) => (
                <Link key={m.userId} href={`/team/${m.userId}`} className="flex items-center gap-1 text-sm hover:bg-slate-800 px-1 rounded transition-colors">
                  <span className="text-slate-500 w-5">{i + 1}.</span>
                  <span className="text-slate-200 flex-1 truncate">{m.name}</span>
                  <span className="text-slate-300 font-medium text-xs">{m.sessionsCount}회</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {data.byEfficiency.length === 1 && (
          <div className="bg-slate-900 rounded-lg p-4 text-center text-slate-400 text-sm">
            아직 1명만 가입했어요.
            <p className="mt-1 text-xs text-slate-500">다른 멤버를 초대해 함께 사용해보세요</p>
          </div>
        )}
      </main>
    </div>
  );
}
