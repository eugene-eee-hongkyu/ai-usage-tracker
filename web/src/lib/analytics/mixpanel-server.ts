// Server-side Mixpanel 트래킹 — Vercel function 에서 직접 HTTP POST.
//
// 토큰: NEXT_PUBLIC_MIXPANEL_TOKEN (client 측과 동일 — write-only project token 이라
// 노출돼도 무방, 별도 server secret 불필요). 미설정 시 모든 호출 no-op.
//
// 별도 npm 패키지 (mixpanel) 안 씀 — 한 endpoint 만 쓰는 use case 에 의존성 추가 과함.
//
// 호출 패턴: fire-and-forget. ingest 응답을 막지 않게 await 안 함.
// 실패 시 console.error 만 — analytics 가 app 로직 영향 X.
//
// distinct_id 정책: client 측 identifyUser(user.id) 와 동일하게 String(user.id).
// → 같은 사용자의 client/server event 가 Mixpanel 에서 같은 row 로 통합.

const TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
const ENDPOINT = "https://api.mixpanel.com/track";
const BUILD = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "dev";

interface ServerTrackProps {
  [key: string]: unknown;
}

/**
 * 서버에서 Mixpanel 이벤트 전송. fire-and-forget — await 안 해도 됨.
 *
 * @param event   event 이름 (EVENTS_SERVER 의 상수 권장)
 * @param distinctId  사용자 id (number → String) 또는 anonymous device id.
 * @param props   추가 properties. source='server' 자동 첨부.
 */
export function trackServer(
  event: string,
  distinctId: number | string,
  props?: ServerTrackProps,
): void {
  if (!TOKEN) return;
  const body = {
    event,
    properties: {
      token: TOKEN,
      distinct_id: String(distinctId),
      time: Math.floor(Date.now() / 1000),
      source: "server",
      app_build: BUILD,
      ...(props ?? {}),
    },
  };
  const payload = `data=${encodeURIComponent(JSON.stringify(body))}`;
  // fetch 의 keepalive 로 lambda 가 빨리 종료해도 request 가 끝까지 가도록.
  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload,
    keepalive: true,
  }).catch((e) => {
    console.error("[mixpanel-server] track failed:", (e as Error).message);
  });
}

/** Server-side event 키 상수. */
export const EVENTS_SERVER = {
  /**
   * 사용자의 *첫* ingest 가 성공한 시점. 가입 → 실제 사용 funnel 의 마지막 노드.
   * `users.last_synced_at` 이 NULL 이었던 ingest 한 번만 fire (서버 측 idempotent).
   *
   * Properties:
   *   - cli_version, claude_code_version (api_tokens.metadata 의 envInfo 에서)
   *   - platform (darwin / win32 / linux)
   *   - device_count (해당 user 의 active api_tokens 수)
   */
  SETUP_COMPLETE: "setup_complete",
} as const;
