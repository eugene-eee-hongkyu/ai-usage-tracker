"use client";

// 섹션 dwell (in-viewport 시간) 자동 트래킹.
//
// 사용 패턴:
//   1) dashboard-view / team-view 등의 client component 최상위에서
//      useTrackSectionDwell("dashboard") 한 줄.
//   2) 추적할 카드 div 에 data-track-dwell="<section_name>" attribute 부여.
//      → 옛 카드 div 의 className/data-testid 손대지 않음, attribute 하나만 추가.
//
// 동작:
//   - MutationObserver 가 새 카드 등장 감지 (loading → 데이터 로드 후 cards render).
//   - IntersectionObserver (threshold 0.5) 가 50%+ 보일 때 timer 시작.
//   - 50% 아래로 내려가거나 visibilitychange hidden 시 timer stop + dwell 누적.
//   - flush 시점: visibilitychange hidden / pagehide / hook unmount.
//   - 500ms 미만 dwell 은 noise 로 간주, 발사 안 함.
//   - flush 후 state reset → 같은 페이지의 다음 cycle 부터 새로 카운트.
//
// 발사: SECTION_DWELL event { screen, section, dwell_ms, view_count }.

import { useEffect } from "react";
import { track, EVENTS } from "@/lib/analytics/mixpanel";

interface SectionState {
  dwellMs: number;
  viewCount: number;
  enterAt: number | null;
}

const MIN_DWELL_MS = 500;        // noise floor
const INTERSECTION_THRESHOLD = 0.5;

export function useTrackSectionDwell(screen: string): void {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const tracked = new Map<Element, { name: string; state: SectionState }>();

    const intersection = new IntersectionObserver(
      (entries) => {
        const now = performance.now();
        const visible = document.visibilityState === "visible";
        for (const entry of entries) {
          const t = tracked.get(entry.target);
          if (!t) continue;
          if (entry.isIntersecting && visible) {
            if (t.state.enterAt == null) {
              t.state.enterAt = now;
              t.state.viewCount += 1;
            }
          } else if (t.state.enterAt != null) {
            t.state.dwellMs += now - t.state.enterAt;
            t.state.enterAt = null;
          }
        }
      },
      { threshold: INTERSECTION_THRESHOLD },
    );

    function scan() {
      // 새로 등장한 카드만 추가 — 이미 추적 중인 것은 idempotent.
      document.querySelectorAll<HTMLElement>("[data-track-dwell]").forEach((el) => {
        if (tracked.has(el)) return;
        const name = el.getAttribute("data-track-dwell") ?? "unknown";
        tracked.set(el, { name, state: { dwellMs: 0, viewCount: 0, enterAt: null } });
        intersection.observe(el);
      });
    }

    // dashboard-view 는 loading → data 페이즈를 거치므로 mutation 으로 새 카드 등장 감지.
    const mutation = new MutationObserver(scan);
    mutation.observe(document.body, { childList: true, subtree: true });
    scan();

    function flush() {
      const now = performance.now();
      for (const t of tracked.values()) {
        // 진행 중 dwell 마감
        if (t.state.enterAt != null) {
          t.state.dwellMs += now - t.state.enterAt;
          t.state.enterAt = null;
        }
        if (t.state.dwellMs >= MIN_DWELL_MS) {
          track(EVENTS.SECTION_DWELL, {
            screen,
            section: t.name,
            dwell_ms: Math.round(t.state.dwellMs),
            view_count: t.state.viewCount,
          });
        }
        // reset — 같은 페이지의 다음 cycle (tab 다시 활성 등) 부터 새로 누적.
        t.state.dwellMs = 0;
        t.state.viewCount = 0;
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") flush();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flush);

    return () => {
      intersection.disconnect();
      mutation.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [screen]);
}
