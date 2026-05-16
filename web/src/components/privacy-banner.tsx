"use client";

import { useEffect, useState } from "react";

// 첫 진입 시 한 번 dismiss 가능 banner. dismiss 후엔 footer 작은 form 으로 항상 노출.
// 인터뷰 진우님 "어디까지 수집되는지 / 모든 프롬프트가 저장되나? 궁금" 응답 반영.
//
// 카피 — "수집 안 함" 명시 (negative claim 이 trust 강함).

const DISMISS_KEY = "privacy_banner_dismissed_v1";

export function PrivacyBanner() {
  const [dismissed, setDismissed] = useState<boolean | null>(null); // null = 초기, true/false = 결정

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  // SSR 또는 초기 — 깜박임 방지를 위해 null 상태에선 banner 안 그림
  if (dismissed === null) return null;

  if (!dismissed) {
    return (
      <div
        data-testid="privacy-banner"
        className="bg-slate-900 border-b border-slate-700 px-4 py-2.5"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 text-xs font-mono">
          <span className="text-slate-300">
            🔒 이 도구는 <span className="text-emerald-400 font-bold">token count · 도구명만</span> 수집합니다.{" "}
            <span className="text-rose-400 font-bold">코드 · 프롬프트 · Claude 응답은 수집되지 않습니다.</span>
          </span>
          <button
            data-testid="privacy-banner-dismiss"
            onClick={() => {
              try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
              setDismissed(true);
            }}
            className="text-slate-500 hover:text-slate-200 text-sm shrink-0"
            aria-label="안내 닫기"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  // Dismiss 후 — footer 작은 form (페이지 하단에 별도 렌더링은 사용처에서)
  return null;
}

// 페이지 footer 에 항상 노출되는 작은 보조 텍스트. PrivacyBanner 가 dismiss 됐든 안 됐든 같이 둘 수 있음.
export function PrivacyFooterNote() {
  return (
    <p data-testid="privacy-footer-note" className="text-[10px] font-mono text-slate-600 text-center py-3">
      🔒 메타데이터만 수집 — 코드 · 프롬프트 · 응답 텍스트 수집 안 됨
    </p>
  );
}
