"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import Link from "next/link";

interface Project { name: string; cost: number; sessions: number; avgCost: number }

interface DetailData {
  projects: Project[];
}

export default function DashboardDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DetailData | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/dashboard?period=all")
      .then((r) => r.json())
      .then((d) => setData({ projects: d.projects ?? [] }));
  }, [session]);

  if (!data) return (
    <div className="min-h-screen">
      <Nav />
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-500">로딩 중...</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-200 text-sm">← 메인</Link>
          <h1 className="font-semibold text-slate-200">개인 디테일</h1>
        </div>

        {/* Project breakdown */}
        <div className="bg-slate-900 rounded-lg p-4 space-y-2">
          <p className="text-sm text-slate-400 mb-3">프로젝트별 (전체 기간)</p>
          {data.projects.length === 0 && (
            <p className="text-slate-500 text-sm">프로젝트 데이터가 없습니다.</p>
          )}
          {data.projects.map((p) => (
            <div key={p.name} className="flex items-center justify-between text-sm py-1 border-b border-slate-800 last:border-0">
              <span className="text-slate-200 flex-1 truncate">{p.name}</span>
              <span className="text-slate-400 w-16 text-right">${p.cost.toFixed(2)}</span>
              <span className="text-slate-500 w-14 text-right">{p.sessions}회</span>
              <span className="text-slate-600 w-20 text-right text-xs">${p.avgCost.toFixed(2)}/회</span>
            </div>
          ))}
        </div>

        {/* codeburn optimize guide */}
        <div className="bg-slate-900 rounded-lg p-4 space-y-3">
          <p className="text-sm text-slate-400">최적화 제안</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Claude Code 사용 패턴을 분석한 최적화 제안은 터미널에서 codeburn optimize를 실행하면 확인할 수 있습니다.
          </p>
          <div className="bg-slate-800 rounded p-3 font-mono text-xs text-emerald-400">
            codeburn optimize
          </div>
          <p className="text-xs text-slate-600">
            codeburn이 설치되어 있지 않다면 →{" "}
            <span className="font-mono text-slate-500">npm install -g codeburn</span>
          </p>
        </div>
      </main>
    </div>
  );
}
