"use client";

// nav 우측 ⓘ 아이콘 — 클릭 시 동봉/권장 의존성 버전 표시.
//
// .dmg (Local): "동봉됨" 라벨 — `app` 줄 추가 (installer 버전)
// 클라우드: "권장 버전" 라벨 — `app` 줄 생략

import { useEffect, useRef, useState } from "react";
import { useMessages } from "@/lib/use-i18n";

interface AboutData {
  mode: "local" | "cloud";
  app: string | null;
  node: string;
  codeburn: string;
  ccusage: string;
  buildSha: string;
  buildRef: string;
}

const CLIENT_BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";
const CLIENT_BUILD_REF = process.env.NEXT_PUBLIC_BUILD_REF ?? "local";

function shortSha(sha: string): string {
  return sha === "dev" || sha === "local" ? sha : sha.slice(0, 7);
}

export function AboutPopover() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AboutData | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { m } = useMessages();

  useEffect(() => {
    if (!open || data) return;
    fetch("/api/about")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, [open, data]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        data-testid="nav-about-toggle"
        onClick={() => setOpen(!open)}
        aria-label={m.about.title}
        title={m.about.title}
        className="w-6 h-6 rounded-full border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 text-xs flex items-center justify-center transition-colors"
      >
        i
      </button>
      {open && (
        <div
          data-testid="nav-about-popover"
          className="absolute right-0 top-8 z-50 min-w-[240px] bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-3 text-xs"
        >
          <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
            {data ? (data.mode === "local" ? m.about.headerLocal : m.about.headerCloud) : m.about.loading}
          </p>
          {data ? (
            <>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono">
                {data.app && (
                  <>
                    <dt className="text-slate-500">App</dt>
                    <dd className="text-slate-200">v{data.app}</dd>
                  </>
                )}
                <dt className="text-slate-500">Node</dt>
                <dd className="text-slate-200">{data.node}</dd>
                <dt className="text-slate-500">codeburn</dt>
                <dd className="text-slate-200">{data.codeburn}</dd>
                <dt className="text-slate-500">ccusage</dt>
                <dd className="text-slate-200">{data.ccusage}</dd>
                <dt className="text-slate-500">Page</dt>
                <dd className="text-slate-200" title={`${CLIENT_BUILD_REF} @ ${CLIENT_BUILD_SHA}`}>
                  {shortSha(CLIENT_BUILD_SHA)}
                </dd>
                <dt className="text-slate-500">Server</dt>
                <dd
                  className={CLIENT_BUILD_SHA !== data.buildSha ? "text-amber-400" : "text-slate-200"}
                  title={`${data.buildRef} @ ${data.buildSha}`}
                >
                  {shortSha(data.buildSha)}
                </dd>
              </dl>
              {CLIENT_BUILD_SHA !== data.buildSha && CLIENT_BUILD_SHA !== "dev" && (
                <div className="mt-3 pt-2 border-t border-slate-700">
                  <p className="text-amber-400 text-[11px] mb-2">
                    이전 버전을 보고 있어요. 새로고침하면 최신 화면으로 갱신됩니다.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded text-[11px] font-mono border border-amber-500/40 transition-colors"
                  >
                    새로고침
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-slate-500">···</p>
          )}
        </div>
      )}
    </div>
  );
}
