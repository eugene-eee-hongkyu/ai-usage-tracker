"use client";

// 스크롤 깊이 마일스톤 (25/50/75/100%) 자동 트래킹 hook.
// 페이지당 each milestone once — Set 으로 dedup.
// passive listener + Set lookup 만 → scroll 성능 영향 무시 가능.
//
// 사용처: dashboard / team / ranking 등 긴 스크롤 페이지의 client component
// 최상위에서 useTrackScrollDepth("dashboard") 한 줄.
//
// 짧은 페이지 (스크롤바 없는) 는 page mount 직후 25% (실제로는 100%) 가 즉시
// 발사 — 의도된 동작. "페이지 전체가 한눈에 보였다" 신호로 해석.

import { useEffect } from "react";
import { track, EVENTS } from "@/lib/analytics/mixpanel";

const MILESTONES = [25, 50, 75, 100] as const;

export function useTrackScrollDepth(screen: string): void {
  useEffect(() => {
    const fired = new Set<number>();

    function emit() {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      // 페이지가 viewport 보다 짧으면 docH <= 0 → 100% 로 간주.
      const pct = docH <= 0 ? 100 : (window.scrollY / docH) * 100;
      for (const m of MILESTONES) {
        if (pct >= m && !fired.has(m)) {
          fired.add(m);
          track(EVENTS.SCROLL_DEPTH, { screen, milestone: m });
        }
      }
    }

    // 첫 paint 직후 1회 — 짧은 페이지의 100% milestone 즉시 fire.
    emit();
    window.addEventListener("scroll", emit, { passive: true });
    // 리사이즈로 docH 변하면 milestone 재계산.
    window.addEventListener("resize", emit, { passive: true });
    return () => {
      window.removeEventListener("scroll", emit);
      window.removeEventListener("resize", emit);
    };
  }, [screen]);
}
