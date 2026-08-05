import { useEffect, useRef } from "react";

// 뷰 방문/체류 추적 (개인·팀·통합 3뷰 공유).
//
//  - 방문 수: mount 시 + 다른 탭 갔다 돌아올 때(visibilitychange visible / window focus)
//    마다 /api/visit POST → 서버가 (user, team, today) 방문 count +1. 하루 종일 열어둔
//    채 탭만 오가도 "이 탭에 몇 번 왔는지" 가 집계된다. (2026-07-28 refetchOnWindowFocus
//    off 이후, 예전엔 세션 재검증 부작용으로 우연히 세지던 탭 복귀 방문이 사라졌던 것을
//    의도적으로 되살림.) focus + visibilitychange 가 탭 복귀 시 함께 발생하는 것은 짧은
//    디바운스로 1회만 센다.
//  - 체류 시간: visible 구간을 누적하다 hide / unmount 시 sendBeacon 으로 /api/visit-end
//    전송 → daily_visits.total_dwell_seconds 가산. 방문 count 와 함께 늘어나야 평균 체류
//    (avgDwellSec = dwell / count) 가 희석되지 않으므로 3뷰 모두 동일 적용.
//
// enabled=false (세션 미확정 / 미인증) 면 아무것도 안 한다. 모든 전송 실패는 무시(UI 영향 0).
export function useVisitTracking(enabled: boolean) {
  const lastPing = useRef(0);
  useEffect(() => {
    if (!enabled) return;

    const ping = () => {
      const now = Date.now();
      if (now - lastPing.current < 1500) return; // focus + visibilitychange 중복 억제
      lastPing.current = now;
      fetch("/api/visit", { method: "POST" }).catch(() => {});
    };

    let visibleSince: number | null = document.visibilityState === "visible" ? Date.now() : null;
    let accumulated = 0;
    const flush = () => {
      if (visibleSince) {
        accumulated += Date.now() - visibleSince;
        visibleSince = null;
      }
      const sec = Math.floor(accumulated / 1000);
      if (sec <= 0) return;
      accumulated = 0;
      try {
        const blob = new Blob([JSON.stringify({ sec })], { type: "application/json" });
        navigator.sendBeacon("/api/visit-end", blob);
      } catch {
        // ignore
      }
    };

    ping(); // mount 시 방문 1

    const onVis = () => {
      if (document.visibilityState === "visible") {
        visibleSince = Date.now();
        ping(); // 탭 복귀마다 방문 +1
      } else {
        flush();
      }
    };
    const onFocus = () => {
      if (document.visibilityState === "visible") ping();
    };
    const onUnload = () => flush();

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pagehide", onUnload);
    return () => {
      flush(); // unmount 시에도 누적분 전송
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pagehide", onUnload);
    };
  }, [enabled]);
}
