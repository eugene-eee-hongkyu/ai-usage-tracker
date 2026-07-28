import { useEffect, useRef } from "react";

// 다른 브라우저 탭에 있다가 돌아오면(visibilitychange visible / window focus) 콜백 실행.
// dashboard / team / unified 뷰가 공유 — 탭 재활성화 시 즉시 데이터 refetch 트리거용.
// next-auth 의 refetchOnWindowFocus(세션 왕복 후 지연 refetch) 대신 이걸로 즉시·일관 처리.
export function useRefetchOnVisible(onVisible: () => void) {
  const cb = useRef(onVisible);
  cb.current = onVisible;
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") cb.current();
    };
    document.addEventListener("visibilitychange", handler);
    window.addEventListener("focus", handler);
    return () => {
      document.removeEventListener("visibilitychange", handler);
      window.removeEventListener("focus", handler);
    };
  }, []);
}
