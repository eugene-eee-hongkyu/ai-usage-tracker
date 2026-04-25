"use client";

import { useEffect, useRef, useState } from "react";
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

const GUIDES: Record<string, { why: string; steps: string[] }> = {
  cache_hit: {
    why: "캐시 읽기 토큰은 일반 입력 토큰의 약 10% 가격입니다. Cache hit 80%이면 입력 비용의 약 70%를 절감할 수 있습니다. Claude는 동일한 시스템 프롬프트(CLAUDE.md + 파일 내용)가 반복될 때 이전 결과를 캐시에서 읽습니다.",
    steps: [
      "CLAUDE.md를 5KB 이하로 줄이기 — 파일이 클수록 캐시 분할 포인트가 자주 바뀌어 hit율이 떨어집니다",
      "세션 간 간격 5분 이내 유지 — 캐시 TTL은 5분입니다. 쉬었다 오면 캐시가 만료됩니다",
      "/compact 또는 세션 재시작 최소화 — 새 컨텍스트가 시작되면 캐시를 처음부터 다시 씁니다",
      "불필요한 대형 파일 참조 제거 — CONTEXT.md, 대용량 로그 파일을 프롬프트에 넣으면 캐시 효율이 떨어집니다",
    ],
  },
  opus_heavy: {
    why: "Opus는 Sonnet 대비 약 5배 비쌉니다. 코드 편집, 리팩터링, 테스트 작성, 버그 수정 등 대부분의 일상 작업은 Sonnet으로 충분합니다. Opus의 강점은 새로운 아키텍처 설계, 복잡한 알고리즘 구상 등 고난도 추론이 필요한 경우입니다.",
    steps: [
      "Claude Code에서 /model 명령으로 기본 모델을 Sonnet으로 변경하세요",
      "Opus는 새 프로젝트 아키텍처 설계, 복잡한 알고리즘 설계 시에만 선택적으로 사용하세요",
      "\"이 작업에 Opus가 꼭 필요한가?\" 스스로 물어보고, 코드 구현·편집 작업이라면 Sonnet으로 전환하세요",
      "CLAUDE.md에 defaultModel 힌트를 추가해 Claude가 자동으로 적절한 모델을 선택하도록 도울 수 있습니다",
    ],
  },
  high_retry: {
    why: "재시도가 많다는 것은 Claude가 첫 번째 시도에서 요구사항을 파악하지 못했다는 신호입니다. 재시도마다 동일한 컨텍스트를 반복 처리하므로 토큰과 시간이 낭비됩니다.",
    steps: [
      "\"수정해줘\" 대신 \"A 파일의 B 함수를 C로 바꿔줘, D는 유지\" 형태로 구체적으로 지시하세요",
      "CLAUDE.md에 자주 쓰는 패턴, 코드 컨벤션, 금지 사항을 미리 정의해두세요",
      "복잡한 작업은 단계별로 나눠서 각 단계를 확인한 후 다음 단계를 지시하세요",
      "관련 파일을 먼저 Read하거나 \"이 파일을 먼저 읽어봐\" 라고 요청해 맥락을 공유한 후 작업을 지시하세요",
    ],
  },
  low_utilization: {
    why: "Claude Code Pro/Max 요금제는 5시간 슬라이딩 윈도우로 heavy usage limit이 적용됩니다. 짧은 세션이 분산되면 매월 정액을 내면서 실제 사용량은 적어지는 비효율이 발생합니다.",
    steps: [
      "짧은 1-2분 세션 여러 개 대신 20-30분 집중 세션으로 묶어서 사용하세요",
      "세션 시작 전 작업 목록을 3-5개 미리 준비해 유휴 시간을 최소화하세요",
      "한 세션에서 연관된 작업을 연속으로 처리하세요 (파일 수정 → 테스트 → 리뷰 → 문서 업데이트)",
      "\"잠깐 다른 일 하고 올게\"보다 세션 완결 후 재시작이 캐시 효율도 높습니다",
    ],
  },
  mcp_unused: {
    why: "MCP(Model Context Protocol) 서버를 통해 Claude가 브라우저, 데이터베이스, 외부 서비스에 직접 접근할 수 있습니다. 반복적으로 하는 수동 작업(UI 확인, DB 조회, API 테스트)을 Claude에게 위임할 수 있습니다.",
    steps: [
      "Playwright MCP: 브라우저 자동화 — UI 테스트, 웹 스크래핑, 폼 입력을 Claude가 직접 실행",
      "DB MCP: 데이터베이스 직접 쿼리 — 스키마 확인, 데이터 조회, 마이그레이션 검증",
      "Filesystem MCP: 대용량 파일 조작, 디렉터리 전체 탐색 효율화",
      "설치 방법: Claude Code에서 /mcp 명령으로 사용 가능한 MCP 서버 확인 후 추가하세요",
    ],
  },
};

function SuggestionCard({ suggestion, index }: { suggestion: Suggestion; index: number }) {
  const [acted, setActs] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const storageKey = `guide-${suggestion.type}`;
  const initialized = useRef(false);
  const guide = GUIDES[suggestion.type];

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      if (localStorage.getItem(storageKey) === "closed") setExpanded(false);
    } catch {}
  }, [storageKey]);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    try {
      if (!next) localStorage.setItem(storageKey, "closed");
      else localStorage.removeItem(storageKey);
    } catch {}
  };

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

      {guide && (
        <div className="space-y-2">
          <button
            onClick={toggleExpanded}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {expanded ? "▲ 닫기" : "▼ 어떻게 개선하나요?"}
          </button>
          {expanded && (
            <div className="bg-slate-800 rounded-lg p-3 space-y-3">
              <div>
                <p className="text-xs text-slate-300 font-medium mb-1">왜 중요한가요?</p>
                <p className="text-xs text-slate-400 leading-relaxed">{guide.why}</p>
              </div>
              <div>
                <p className="text-xs text-slate-300 font-medium mb-1">개선 방법</p>
                <ol className="space-y-1">
                  {guide.steps.map((step, i) => (
                    <li key={i} className="text-xs text-slate-400 leading-relaxed flex gap-2">
                      <span className="text-slate-500 shrink-0">{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 text-xs pt-1">
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
