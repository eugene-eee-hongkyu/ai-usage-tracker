"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import Link from "next/link";
import type { Suggestion } from "@/lib/rules";

interface DetailData {
  projects: Record<string, { tokens: number; cost: number; oneShotEdits: number; totalEdits: number }>;
  suggestions: Suggestion[];
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
    fetch("/api/dashboard?period=month")
      .then((r) => r.json())
      .then((d) => setData(d));
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
          <p className="text-sm text-slate-400 mb-3">프로젝트별</p>
          {Object.entries(data.projects)
            .sort(([, a], [, b]) => b.tokens - a.tokens)
            .map(([project, stat]) => {
              const oneShotRate = stat.totalEdits > 0
                ? Math.round((stat.oneShotEdits / stat.totalEdits) * 100)
                : 0;
              return (
                <div key={project} className="flex items-center justify-between text-sm py-1 border-b border-slate-800 last:border-0">
                  <span className="text-slate-200 flex-1">{project}</span>
                  <span className="text-slate-400 w-20 text-right">{(stat.tokens / 1_000_000).toFixed(1)}M</span>
                  <span className="text-slate-400 w-16 text-right">${stat.cost.toFixed(2)}</span>
                  <span className="text-slate-400 w-24 text-right">one-shot {oneShotRate}%</span>
                </div>
              );
            })}
        </div>

        {/* 5 suggestions */}
        <div className="bg-slate-900 rounded-lg p-4 space-y-4">
          <p className="text-sm text-slate-400">5개 제안</p>
          {data.suggestions.length === 0 && (
            <p className="text-slate-500 text-sm">제안이 없습니다. 계속 잘 사용하고 계세요!</p>
          )}
          {data.suggestions.map((s, i) => (
            <SuggestionCard key={i} suggestion={s} index={i + 1} />
          ))}
        </div>
      </main>
    </div>
  );
}

function SuggestionCard({ suggestion, index }: { suggestion: Suggestion; index: number }) {
  const [acted, setActs] = useState<string | null>(null);

  const feedback = async (action: string) => {
    setActs(action);
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suggestionType: suggestion.type, action }),
    });
  };

  return (
    <div className="border border-slate-700 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-slate-200">
          {index}. {suggestion.title}
          {suggestion.confidence === "low" && (
            <span className="ml-2 text-xs text-yellow-500">[신뢰도:낮음]</span>
          )}
        </p>
      </div>
      <p className="text-xs text-slate-400">{suggestion.detail}</p>
      <div className="flex items-center gap-3 text-xs">
        {acted === "done" ? (
          <span className="text-green-400">✅ 완료 처리됨</span>
        ) : acted === "dismiss" ? (
          <span className="text-slate-500">무시됨</span>
        ) : (
          <>
            <button
              onClick={() => feedback("done")}
              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 transition-colors"
            >
              Done
            </button>
            <button
              onClick={() => feedback("dismiss")}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 transition-colors"
            >
              무시
            </button>
          </>
        )}
        <span className="text-slate-600 ml-auto">이 추정 어때요?</span>
        <button
          onClick={() => feedback("thumbs_up")}
          className={`hover:scale-110 transition-transform ${acted === "thumbs_up" ? "opacity-100" : "opacity-60 hover:opacity-100"}`}
        >👍</button>
        <button
          onClick={() => feedback("thumbs_down")}
          className={`hover:scale-110 transition-transform ${acted === "thumbs_down" ? "opacity-100" : "opacity-60 hover:opacity-100"}`}
        >👎</button>
      </div>
    </div>
  );
}
