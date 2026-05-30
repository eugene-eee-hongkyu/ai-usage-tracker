"use client";

// nav 우측 ⓘ 아이콘 — 클릭 시 동봉/권장 의존성 버전 표시.
//
// .dmg (Local): "동봉됨" 라벨 — `app` 줄 추가 (installer 버전)
// 클라우드: "권장 버전" 라벨 — `app` 줄 생략

import { useEffect, useRef, useState } from "react";
import { useMessages } from "@/lib/use-i18n";
import { track, EVENTS } from "@/lib/analytics/mixpanel";

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

  // 자동 버전 체크 — mount 시 1회 + 5분 polling + 탭 active 복귀 시 즉시 refetch.
  // 옛 동작은 popover 열어야만 fetch — 사용자가 (i) 안 누르면 새 빌드 인지 못함.
  // 이제는 buildSha 가 다르면 (i) 우상단 빨간 점 → popover 안에 새로고침 버튼.
  // polling 5분 = SHA 갱신 인지 지연 상한. 트래픽 미미 (응답 작음).
  useEffect(() => {
    let cancelled = false;
    const fetchAbout = () => {
      fetch("/api/about")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (!cancelled) setData(d); })
        .catch(() => { /* network 에러는 침묵 — 다음 poll 에서 자동 재시도 */ });
    };
    fetchAbout();
    const id = setInterval(fetchAbout, 5 * 60_000);
    const onVis = () => { if (document.visibilityState === "visible") fetchAbout(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // hasUpdate — client 번들 SHA 와 server 응답 SHA 가 다르면 true. dev / local
  // 빌드는 비교 무의미 (SHA = "dev") 라 제외.
  const hasUpdate = !!data && data.buildSha !== CLIENT_BUILD_SHA && CLIENT_BUILD_SHA !== "dev";

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
        onClick={() => {
          // open 으로 토글되는 시점만 (close 는 무시) — 첫 열림 신호가 더 가치 있음.
          if (!open) track(EVENTS.INFO_CLICK, { target: "version" });
          setOpen(!open);
        }}
        aria-label={m.about.title}
        title={hasUpdate ? `${m.about.title} (새 버전 있음)` : m.about.title}
        className="relative w-6 h-6 rounded-full border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 text-xs flex items-center justify-center transition-colors"
      >
        i
        {hasUpdate && (
          <span
            data-testid="nav-about-update-dot"
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-slate-950"
            aria-hidden="true"
          />
        )}
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
              {hasUpdate && (
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
