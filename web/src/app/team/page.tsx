"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import Link from "next/link";

type Period = "today" | "week" | "month" | "all";

interface MemberStat {
  userId: number;
  name: string;
  avatarUrl: string | null;
  totalTokens: number;
  totalCost: number;
  oneShotRate: number;
  mvpScore: number;
  topProject: string;
  sessionsCount: number;
}

interface TeamData {
  mvp: (MemberStat & { blurb: string }) | null;
  byTokens: MemberStat[];
  byEfficiency: MemberStat[];
  projects: Record<string, Array<{ userId: number; name: string; tokens: number }>>;
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default function TeamPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("today");
  const [data, setData] = useState<TeamData | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    fetch(`/api/team?period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        const projects = Object.keys(d.projects ?? {});
        if (projects.length > 0 && !selectedProject) setSelectedProject(projects[0]);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, period]);

  if (!data) return (
    <div className="min-h-screen">
      <Nav />
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-500">로딩 중...</div>
      </div>
    </div>
  );

  const periodLabel = period === "today" ? "Today's" : period === "week" ? "이번 주" : period === "month" ? "이번 달" : "전체";

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Period tabs */}
        <div className="flex gap-2">
          {(["today", "week", "month", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-sm transition-colors ${period === p ? "bg-slate-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"}`}
            >
              {p === "today" ? "오늘" : p === "week" ? "이번주" : p === "month" ? "이번달" : "전체"}
            </button>
          ))}
        </div>

        {/* MVP card */}
        {data.mvp ? (
          <Link href={`/team/${data.mvp.userId}`} className="block">
            <div className="bg-gradient-to-r from-yellow-950 to-slate-900 border border-yellow-800 rounded-lg p-4 hover:border-yellow-600 transition-colors">
              <p className="text-yellow-400 font-semibold text-sm mb-1">🏆 {periodLabel} MVP</p>
              <p className="text-xl font-bold text-slate-100">{data.mvp.name}</p>
              <p className="text-sm text-slate-400 mt-1">
                one-shot {data.mvp.oneShotRate}% × {fmtTokens(data.mvp.totalTokens)} tok
              </p>
              <p className="text-xs text-slate-500 mt-1 italic">&ldquo;{data.mvp.blurb}&rdquo;</p>
            </div>
          </Link>
        ) : (
          <div className="bg-slate-900 rounded-lg p-4 text-center text-slate-500 text-sm">
            이 기간에 활동 없어요. 다른 기간 선택 ↑
          </div>
        )}

        {data.byTokens.filter(m => m.sessionsCount === 0).length === data.byTokens.length ? null : (
          <>
            {/* Two columns: most tokens + best efficiency */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 rounded-lg p-4 space-y-2">
                <p className="text-sm text-slate-400 font-medium">최다 사용자</p>
                {data.byTokens.filter(m => m.sessionsCount > 0).map((m, i) => (
                  <Link key={m.userId} href={`/team/${m.userId}`} className="flex items-center justify-between text-sm hover:bg-slate-800 px-1 rounded transition-colors">
                    <span className="text-slate-400 w-5">{i + 1}.</span>
                    <span className="text-slate-200 flex-1">{m.name}</span>
                    <span className="text-slate-400">{fmtTokens(m.totalTokens)}</span>
                  </Link>
                ))}
              </div>

              <div className="bg-slate-900 rounded-lg p-4 space-y-2">
                <p className="text-sm text-slate-400 font-medium">최고 효율</p>
                {data.byEfficiency.filter(m => m.sessionsCount > 0).map((m, i) => (
                  <Link key={m.userId} href={`/team/${m.userId}`} className="flex items-center justify-between text-sm hover:bg-slate-800 px-1 rounded transition-colors">
                    <span className="text-slate-400 w-5">{i + 1}.</span>
                    <span className="text-slate-200 flex-1">{m.name}</span>
                    <span className="text-slate-400">{m.oneShotRate}%</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Project leaderboard */}
            {Object.keys(data.projects).length > 0 && (
              <div className="bg-slate-900 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-slate-400 font-medium">프로젝트별 리더보드</p>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="text-sm bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300"
                  >
                    {Object.keys(data.projects).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                {(data.projects[selectedProject] ?? []).map((m, i) => (
                  <Link key={m.userId} href={`/team/${m.userId}`} className="flex items-center gap-2 text-sm hover:bg-slate-800 px-1 rounded transition-colors">
                    <span className="text-slate-500 w-5">{i + 1}.</span>
                    <span className="text-slate-200 flex-1">{m.name}</span>
                    <span className="text-slate-400">{fmtTokens(m.tokens)}</span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {data.byTokens.length === 1 && (
          <div className="bg-slate-900 rounded-lg p-4 text-center text-slate-400 text-sm">
            아직 1명만 가입했어요.
            <p className="mt-1 text-xs text-slate-500">다른 멤버를 초대해 함께 사용해보세요</p>
          </div>
        )}
      </main>
    </div>
  );
}
