// Mixpanel funnel·event 트래킹 단일 module — aiusage.z21labs.world 측.
//
// 환경변수 NEXT_PUBLIC_MIXPANEL_TOKEN 필요 (Vercel build env, 양쪽 같은 토큰).
// 토큰 없으면 모든 호출 no-op — dev 환경·env 미설정 시 안전.
//
// Cross-domain 정합 (ai.z21labs.world ↔ aiusage.z21labs.world):
//   - persistence: 'cookie' + cross_subdomain_cookie: true → 쿠키를 부모 도메인
//     `.z21labs.world` 에 박음. 양쪽 모두 같은 distinct_id 자동 매칭.
//   - eduluck 의 localStorage 패턴은 origin 단위라 cross-domain 안 됨 — 일부러 cookie 채택.
//
// 사용자 식별 모델:
//   - 가입 전 (랜딩·로그인 화면): anonymous distinct_id (쿠키 자동 생성)
//   - 로그인 직후 dashboard mount 시점: identifyUser(session.user.id) → user_id 로 alias.
//     같은 사용자가 다른 device 에서 로그인해도 같은 user 로 통합.
//
// 자동 첨부:
//   - source: window.location.host — ai.z21labs.world / aiusage.z21labs.world 구분
//   - app_build: NEXT_PUBLIC_BUILD_VERSION (next.config 의 git rev count)

import mixpanel from "mixpanel-browser";

const TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
const BUILD = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "dev";
const DEBUG = process.env.NEXT_PUBLIC_MIXPANEL_DEBUG === "1";

let initialized = false;
let identifiedUserId: string | null = null;

/** App 시작 시 1회 호출 (RootLayout 의 AnalyticsBridge). */
export function initAnalytics(): void {
  if (!TOKEN || initialized || typeof window === "undefined") return;
  try {
    mixpanel.init(TOKEN, {
      debug: DEBUG,
      track_pageview: false,          // 명시 이벤트로만 — page 단위 추적 정밀
      persistence: "cookie",          // ★ cross-subdomain 핵심
      cross_subdomain_cookie: true,   // ★ default 인데 명시
      secure_cookie: true,            // https-only
      ignore_dnt: false,              // DNT 존중
    });
    initialized = true;
  } catch {
    // silent — analytics 실패가 app 동작 막지 않게
  }
}

/** 로그인 직후 1회 — anonymous distinct_id 를 user_id 로 alias. */
export function identifyUser(
  userId: number | string,
  props?: Record<string, unknown>
): void {
  if (!initialized || !userId) return;
  const idStr = String(userId);
  if (identifiedUserId === idStr) return;
  try {
    mixpanel.identify(idStr);
    if (props) {
      mixpanel.people.set({
        $first_seen: new Date().toISOString(),
        app_build: BUILD,
        ...props,
      });
    }
    identifiedUserId = idStr;
  } catch {
    // silent
  }
}

/** 이벤트 트래킹. source·app_build 자동 첨부. */
export function track(event: string, props?: Record<string, unknown>): void {
  if (!initialized || typeof window === "undefined") return;
  try {
    mixpanel.track(event, {
      source: window.location.host,
      app_build: BUILD,
      ...(props ?? {}),
    });
  } catch {
    // silent
  }
}

/** 이벤트 키 상수 — funnel 일관성 위해 한곳에. */
export const EVENTS = {
  // 랜딩
  LANDING_VIEW: "landing_view",
  LANDING_CTA_CLICK: "landing_cta_click",
  LANDING_TEAM_FUNNEL_CLICK: "landing_team_funnel_click",
  // 인증
  LOGIN_VIEW: "login_view",
  OAUTH_START: "oauth_start",             // props: { provider: 'github'|'google' }
  SIGNIN_COMPLETE: "signin_complete",     // identify 직후 1회
  // 핵심 화면 진입
  DASHBOARD_VIEW: "dashboard_view",
  TEAM_VIEW: "team_view",
  RANKING_VIEW: "ranking_view",
  // 인터랙션 (2026-05-29 추가)
  PERIOD_CLICK: "period_click",                     // props: { screen, period }
  HISTORICAL_PERIOD_CLICK: "historical_period_click", // props: { screen, kind: 'day'|'week'|'month', offset }
  INFO_CLICK: "info_click",                         // props: { screen, target } — e.g., target: 'version'
  FOOTER_LINK_CLICK: "footer_link_click",           // props: { screen, target: 'changelog'|'suggest' }
  // 스크롤 깊이 (25/50/75/100 마일스톤, 페이지당 each once)
  SCROLL_DEPTH: "scroll_depth",                     // props: { screen, milestone: 25|50|75|100 }
} as const;
