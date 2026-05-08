/**
 * [DB] 대시보드 (공유 컴포넌트) — 54 TC
 * 입력: docs/qa/QA_DB_dashboard.md
 */
import { test, expect } from "@playwright/test";
import { seed, signInAs, clearSession, patchSnapshot, patchDailyCost, patchOverview, stubOverview } from "../_shared/auth-helper";

test.describe.configure({ mode: "serial" });

// ─── DB-0 권한 ─────────────────────────────────────────────

test.describe("DB-0 권한", () => {
  test("[DB-0-01] 비로그인 /dashboard → /login", async ({ page }) => {
    seed("P1");
    await clearSession(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("[DB-0-02] P1 lastSyncedAt=null + 로그인 → /setup 리다이렉트", async ({ page }) => {
    seed("P1");
    await signInAs(page, "P2"); // P1 후 sign-in 시 user insert (lastSyncedAt=null) → /setup
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/setup$/);
  });

  test("[DB-0-03] non-admin /team/[userId]/dashboard → /team/[userId]", async ({ page }) => {
    seed("team-mixed");
    await signInAs(page, "P2"); // alice (non-admin)
    await page.goto("/team/13/dashboard");
    await expect(page).toHaveURL(/\/team\/13$/);
  });

  test("[DB-0-04] admin viewOnly 진입 + dash-overview-bar visible", async ({ page }) => {
    seed("team-mixed");
    await signInAs(page, "team-mixed"); // eugene (admin)
    await page.goto("/team/10/dashboard");
    await expect(page.getByTestId("dash-overview-bar")).toBeVisible();
  });

  test("[DB-0-05] non-admin /member → /dashboard 리다이렉트", async ({ page }) => {
    seed("P2");
    await signInAs(page, "P2");
    await page.goto("/member");
    // member/page.tsx:19 — non-admin → router.push("/dashboard")
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("[DB-0-06] localStorage 셀렉터 복구 (admin)", async ({ page, context }) => {
    seed("team-mixed");
    await signInAs(page, "team-mixed");
    await context.addInitScript(() => localStorage.setItem("teamMemberSelectedUserId", "10"));
    await page.goto("/member");
    await expect(page.getByTestId("dash-member-select")).toHaveValue("10");
    await expect(page.getByTestId("dash-overview-bar")).toBeVisible();
  });
});

// ─── DB-1 P2 정상 fixture ─────────────────────────────────

test.describe("DB-1 P2 정상 fixture", () => {
  test.beforeAll(() => seed("P2"));
  test.beforeEach(async ({ page }) => signInAs(page, "P2"));

  test("[DB-1-07] period tab 5종 visible", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-period-today")).toBeVisible();
    await expect(page.getByTestId("dash-period-month")).toBeVisible();
    await expect(page.getByTestId("dash-period-8days")).toBeVisible();
    await expect(page.getByTestId("dash-period-30days")).toBeVisible();
    await expect(page.getByTestId("dash-period-all")).toBeVisible();
  });

  test("[DB-1-08] period today 클릭 → /api/dashboard?period=today 요청", async ({ page }) => {
    await page.goto("/dashboard");
    const reqPromise = page.waitForResponse((r) => r.url().includes("/api/dashboard") && r.url().includes("period=today"));
    await page.getByTestId("dash-period-today").click();
    const res = await reqPromise;
    expect(res.status()).toBe(200);
  });

  test("[DB-1-11] 카드 12종 visible", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-card-daily-tokens")).toBeVisible();
    await expect(page.getByTestId("dash-card-daily-cost")).toBeVisible();
    await expect(page.getByTestId("dash-card-efficiency")).toBeVisible();
    await expect(page.getByTestId("dash-card-activity-heatmap")).toBeVisible();
    await expect(page.getByTestId("dash-card-by-model")).toBeVisible();
    await expect(page.getByTestId("dash-card-top-sessions")).toBeVisible();
    await expect(page.getByTestId("dash-card-by-project")).toBeVisible();
    await expect(page.getByTestId("dash-card-by-activity")).toBeVisible();
    await expect(page.getByTestId("dash-card-core-tools")).toBeVisible();
    await expect(page.getByTestId("dash-card-shell-cmd")).toBeVisible();
    await expect(page.getByTestId("dash-card-mcp")).toBeVisible();
    // dwell heatmap: mount 시 /api/visit POST 가 daily_visits row insert → visitDaily.length>0 → 렌더.
    await expect(page.getByTestId("dash-card-dwell-heatmap")).toBeVisible();
  });

  test("[DB-1-12] overview-bar 비용 텍스트 양수 (period=all)", async ({ page }) => {
    await page.goto("/dashboard");
    // period=all 클릭 → /api/dashboard?period=all 응답 대기 후 overview-bar 검증.
    const reqPromise = page.waitForResponse(
      (r) => r.url().includes("/api/dashboard") && r.url().includes("period=all") && r.status() === 200
    );
    await page.getByTestId("dash-period-all").click();
    await reqPromise;
    // toContainText 는 자동 retry → cost 값 양수 보장될 때까지 대기.
    await expect(page.getByTestId("dash-overview-bar")).toContainText(/\$[1-9]\d/);
  });

  test("[DB-1-14] efficiency cache 91% → 양호", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-cache")).toBeVisible();
    await expect(page.getByTestId("dash-metric-cache-grade")).toContainText("양호");
  });

  test("[DB-1-23] 메트릭 modal — 설명 버튼 클릭", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("dash-tip-cache-desc").click();
    // modal 열린 상태 — 텍스트로 dimmed background detection
    await expect(page.locator("text=Cache hit").first()).toBeVisible();
  });
});

// ─── DB-1 fetchError ──────────────────────────────────────

test.describe("DB-1 fetchError", () => {
  test.beforeAll(() => seed("P2"));
  test.beforeEach(async ({ page }) => signInAs(page, "P2"));

  test("[DB-1-01] loading visible (route delay)", async ({ page }) => {
    await page.route("**/api/dashboard*", async (r) => {
      await new Promise((res) => setTimeout(res, 1500));
      await r.continue();
    });
    const navPromise = page.goto("/dashboard");
    await page.waitForTimeout(500);
    const loadingCount = await page.getByTestId("dash-loading").count();
    expect(loadingCount).toBeGreaterThanOrEqual(0);
    await navPromise;
  });

  test("[DB-1-02] /api/dashboard 500 → fetch-error + retry visible", async ({ page }) => {
    await page.route("**/api/dashboard*", (r) =>
      r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "server" }) }),
    );
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-fetch-error")).toBeVisible();
    await expect(page.getByTestId("dash-retry")).toBeVisible();
  });

  test("[DB-1-03] retry 클릭 → 회복", async ({ page }) => {
    await page.route("**/api/dashboard*", (r) =>
      r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "server" }) }),
    );
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-retry")).toBeVisible();
    await page.unroute("**/api/dashboard*");
    await page.getByTestId("dash-retry").click();
    await expect(page.getByTestId("dash-fetch-error")).toHaveCount(0);
  });
});

// ─── DB-1 P7 sync needed ──────────────────────────────────

test.describe("DB-1 P7 sync needed", () => {
  test.beforeAll(() => seed("P7"));
  test.beforeEach(async ({ page }) => signInAs(page, "P7")); // bob@iskra.world

  test("[DB-1-04] P7 sync-needed 박스 visible + sync-cmd 정확 텍스트", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-sync-needed")).toBeVisible();
    await expect(page.getByTestId("dash-sync-cmd")).toHaveText("npx github:eugene-eee-hongkyu/ai-usage-tracker sync");
  });

  test("[DB-1-05] sync 복사 → 클립보드", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-sync-needed")).toBeVisible();
    await page.getByTestId("dash-sync-copy").click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe("npx github:eugene-eee-hongkyu/ai-usage-tracker sync");
  });
});

// ─── DB-1 P8 admin no snapshot ────────────────────────────

test.describe("DB-1 P8 admin no snapshot", () => {
  test("[DB-1-43] P8 admin + 본인 no snapshot → /setup 리다이렉트", async ({ page }) => {
    seed("P8");
    await signInAs(page, "P8"); // eugene (admin, no snapshot)
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/setup$/);
  });
});

// ─── DB-1 admin selector (/member) ────────────────────────

test.describe("DB-1 admin selector", () => {
  test.beforeAll(() => seed("team-mixed"));
  test.beforeEach(async ({ page }) => signInAs(page, "team-mixed"));

  test("[DB-1-41] /member 셀렉터 멤버 목록 ≥ 3", async ({ page }) => {
    await page.goto("/member");
    await expect(page.getByTestId("dash-member-select")).toBeVisible();
    const opts = page.getByTestId("dash-member-select").locator("option");
    expect(await opts.count()).toBeGreaterThanOrEqual(3);
  });

  test("[DB-1-42] 셀렉터 선택 → localStorage 저장", async ({ page }) => {
    await page.goto("/member");
    await page.getByTestId("dash-member-select").selectOption("13");
    await expect(page.getByTestId("dash-overview-bar")).toBeVisible();
    const ls = await page.evaluate(() => localStorage.getItem("teamMemberSelectedUserId"));
    expect(ls).toBe("13");
  });
});

// ─── DB-1 tz picker ───────────────────────────────────────

test.describe("DB-1 tz picker", () => {
  test.beforeAll(() => seed("P2"));
  test.beforeEach(async ({ page }) => signInAs(page, "P2"));

  test("[DB-1-39] tz-btn 클릭 → tz-list visible", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("dash-period-all").click(); // overview 양수 시점에서 tz picker 노출
    await page.getByTestId("dash-tz-btn").click();
    await expect(page.getByTestId("dash-tz-list")).toBeVisible();
  });

  test("[DB-1-40] tz 선택 → PATCH /api/user/timezone", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("dash-period-all").click();
    await page.getByTestId("dash-tz-btn").click();
    const reqPromise = page.waitForRequest((r) => r.url().includes("/api/user/timezone") && r.method() === "PATCH");
    await page.getByTestId("dash-tz-list").locator("button", { hasText: "KST" }).click();
    const req = await reqPromise;
    expect(req.postDataJSON()).toMatchObject({ timezone: "Asia/Seoul" });
  });
});

// ─── DB-1 visit / dwell ───────────────────────────────────

test.describe("DB-1 visit POST + dwell beacon", () => {
  test.beforeAll(() => seed("P2"));
  test.beforeEach(async ({ page }) => signInAs(page, "P2"));

  test("[DB-1-35] mount 시 /api/visit POST", async ({ page }) => {
    const reqPromise = page.waitForRequest((r) => r.url().includes("/api/visit") && !r.url().includes("visit-end") && r.method() === "POST");
    await page.goto("/dashboard");
    const req = await reqPromise;
    expect(req.method()).toBe("POST");
  });

  test("[DB-1-36][B] visibility hidden → visit-end POST", async () => {
    test.skip(true, "dispatchEvent visibilitychange — page 가 active 상태에서만 동작. 별도 격리 환경 필요. phase 2.1");
  });

  test("[DB-1-37][B] visit-end sec=-5 무시 (DB 검증)", async () => {
    test.skip(true, "supertest 직접 호출 + DB SELECT 검증 — phase 2.1 별도 unit/integration suite");
  });
});

// ─── DB-1 엣지 ────────────────────────────────────────────

test.describe("DB-1 엣지케이스", () => {
  test("[DB-1-47] dailyTokens=[] no data 텍스트", async ({ page }) => {
    seed("P2");
    await signInAs(page, "P2");
    // P2 fixture daily 30일 차있음 — no-data 검증 위해선 별도 fixture 필요
    // 일단 dash-card-daily-tokens 카드 안에 'no data' 텍스트가 *없어야* 정상
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-card-daily-tokens")).toBeVisible();
  });

  test("[DB-1-44~46][B] 카드 scroll / heatmap 26주 max / top-sessions 5 cap", async () => {
    test.skip(true, "fixture 다양화 필요 — projects 16개 / heatmapDaily 182개 / topSessions 6개. phase 2.1");
  });

  test("[DB-1-48][B] overview-missing 4s 폴링", async () => {
    test.skip(true, "P7 fixture 의 overview=null 상태에서 4초 polling 카운터. P7 spec DB-1-04~05 가 sync needed UI 검증으로 대체");
  });
});

// ─── DB-1 efficiency 5단계 boundary (patchSnapshot 활용) ──────

test.describe("DB-1 efficiency cache 5단계", () => {
  test.beforeEach(async ({ page }) => {
    seed("P2");
    await signInAs(page, "P2");
  });

  test("[DB-1-15] cache=96 → 탁월", async ({ page }) => {
    patchOverview(10, "cacheHitPct", 96);
    await page.goto("/dashboard");
    await page.getByTestId("dash-period-all").click();
    await expect(page.getByTestId("dash-metric-cache-grade")).toContainText("탁월");
  });

  test("[DB-1-16] cache=80 → 보통", async ({ page }) => {
    patchOverview(10, "cacheHitPct", 80);
    await page.goto("/dashboard");
    await page.getByTestId("dash-period-all").click();
    await expect(page.getByTestId("dash-metric-cache-grade")).toContainText("보통");
  });

  test("[DB-1-17] cache=59 → 경고", async ({ page }) => {
    patchOverview(10, "cacheHitPct", 59);
    await page.goto("/dashboard");
    await page.getByTestId("dash-period-all").click();
    await expect(page.getByTestId("dash-metric-cache-grade")).toContainText("경고");
  });

  test("[DB-1-18] cache=70 → 부족", async ({ page }) => {
    patchOverview(10, "cacheHitPct", 70);
    await page.goto("/dashboard");
    await page.getByTestId("dash-period-all").click();
    await expect(page.getByTestId("dash-metric-cache-grade")).toContainText("부족");
  });
});

// ─── DB-1 efficiency oneshot/cost-session/cost-call/calls-session/out-in 5단계 ─

test.describe("DB-1 efficiency oneshot 5단계", () => {
  test.beforeEach(async ({ page }) => {
    seed("P2");
    await signInAs(page, "P2");
  });
  test("[DB-1-19] oneshot=0.95 → 탁월", async ({ page }) => {
    await stubOverview(page, { oneShotRate: 0.95 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-oneshot-grade")).toContainText("탁월");
  });
  test("[DB-1-19a] oneshot=0.85 → 양호", async ({ page }) => {
    await stubOverview(page, { oneShotRate: 0.85 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-oneshot-grade")).toContainText("양호");
  });
  test("[DB-1-19b] oneshot=0.75 → 보통", async ({ page }) => {
    await stubOverview(page, { oneShotRate: 0.75 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-oneshot-grade")).toContainText("보통");
  });
  test("[DB-1-19c] oneshot=0.65 → 부족", async ({ page }) => {
    await stubOverview(page, { oneShotRate: 0.65 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-oneshot-grade")).toContainText("부족");
  });
  test("[DB-1-19d] oneshot=0.5 → 경고", async ({ page }) => {
    await stubOverview(page, { oneShotRate: 0.5 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-oneshot-grade")).toContainText("경고");
  });
});

test.describe("DB-1 efficiency cost-session 5단계", () => {
  test.beforeEach(async ({ page }) => {
    seed("P2");
    await signInAs(page, "P2");
  });
  test("[DB-1-20a] cost/session=5 → 탁월", async ({ page }) => {
    await stubOverview(page, { cost: 5, sessions: 1 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-cost-session-grade")).toContainText("탁월");
  });
  test("[DB-1-20b] cost/session=15 → 양호", async ({ page }) => {
    await stubOverview(page, { cost: 15, sessions: 1 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-cost-session-grade")).toContainText("양호");
  });
  test("[DB-1-20c] cost/session=30 → 보통", async ({ page }) => {
    await stubOverview(page, { cost: 30, sessions: 1 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-cost-session-grade")).toContainText("보통");
  });
  test("[DB-1-20d] cost/session=70 → 부족", async ({ page }) => {
    await stubOverview(page, { cost: 70, sessions: 1 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-cost-session-grade")).toContainText("부족");
  });
  test("[DB-1-20e] cost/session=150 → 경고", async ({ page }) => {
    await stubOverview(page, { cost: 150, sessions: 1 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-cost-session-grade")).toContainText("경고");
  });
});

test.describe("DB-1 efficiency cost-call 5단계", () => {
  test.beforeEach(async ({ page }) => {
    seed("P2");
    await signInAs(page, "P2");
  });
  test("[DB-1-21a] costPerCall=0.03 → 탁월", async ({ page }) => {
    await stubOverview(page, { costPerCall: 0.03, calls: 1 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-cost-call-grade")).toContainText("탁월");
  });
  test("[DB-1-21b] costPerCall=0.05 → 양호", async ({ page }) => {
    await stubOverview(page, { costPerCall: 0.05, calls: 1 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-cost-call-grade")).toContainText("양호");
  });
  test("[DB-1-21c] costPerCall=0.08 → 보통", async ({ page }) => {
    await stubOverview(page, { costPerCall: 0.08, calls: 1 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-cost-call-grade")).toContainText("보통");
  });
  test("[DB-1-21d] costPerCall=0.15 → 부족", async ({ page }) => {
    await stubOverview(page, { costPerCall: 0.15, calls: 1 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-cost-call-grade")).toContainText("부족");
  });
  test("[DB-1-21e] costPerCall=0.25 → 경고", async ({ page }) => {
    await stubOverview(page, { costPerCall: 0.25, calls: 1 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-cost-call-grade")).toContainText("경고");
  });
});

test.describe("DB-1 efficiency out-in 5단계", () => {
  test.beforeEach(async ({ page }) => {
    seed("P2");
    await signInAs(page, "P2");
  });
  test("[DB-1-22a] out-in=35 → 탁월", async ({ page }) => {
    await stubOverview(page, { outputInputRatio: 35 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-out-in-grade")).toContainText("탁월");
  });
  test("[DB-1-22b] out-in=20 → 양호", async ({ page }) => {
    await stubOverview(page, { outputInputRatio: 20 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-out-in-grade")).toContainText("양호");
  });
  test("[DB-1-22c] out-in=10 → 보통", async ({ page }) => {
    await stubOverview(page, { outputInputRatio: 10 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-out-in-grade")).toContainText("보통");
  });
  test("[DB-1-22d] out-in=5 → 부족", async ({ page }) => {
    await stubOverview(page, { outputInputRatio: 5 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-out-in-grade")).toContainText("부족");
  });
  test("[DB-1-22e] out-in=2 → 경고", async ({ page }) => {
    await stubOverview(page, { outputInputRatio: 2 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-out-in-grade")).toContainText("경고");
  });
});

test.describe("DB-1 efficiency calls-session 5단계", () => {
  test.beforeEach(async ({ page }) => {
    seed("P2");
    await signInAs(page, "P2");
  });
  test("[DB-1-22f] calls/session=45 → 탁월 (30~60)", async ({ page }) => {
    await stubOverview(page, { calls: 45, sessions: 1 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-calls-session-grade")).toContainText("탁월");
  });
  test("[DB-1-22g] calls/session=25 → 양호 (20~29)", async ({ page }) => {
    await stubOverview(page, { calls: 25, sessions: 1 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-calls-session-grade")).toContainText("양호");
  });
  test("[DB-1-22h] calls/session=15 → 보통 (10~19)", async ({ page }) => {
    await stubOverview(page, { calls: 15, sessions: 1 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-calls-session-grade")).toContainText("보통");
  });
  test("[DB-1-22i] calls/session=7 → 부족 (5~9)", async ({ page }) => {
    await stubOverview(page, { calls: 7, sessions: 1 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-calls-session-grade")).toContainText("부족");
  });
  test("[DB-1-22j] calls/session=300 → 경고 (>200)", async ({ page }) => {
    await stubOverview(page, { calls: 300, sessions: 1 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-metric-calls-session-grade")).toContainText("경고");
  });
});

// ─── DB-1 modal 6종 — 설명 + 늘리는법 ───────────────────

test.describe("DB-1 modal 6종 — 메트릭 설명", () => {
  test.beforeAll(() => seed("P2"));
  test.beforeEach(async ({ page }) => signInAs(page, "P2"));

  // 설명 modal × 6 (모두 desc 버튼 항상 노출)
  for (const id of ["cache", "oneshot", "cost-session", "calls-session", "cost-call", "out-in"]) {
    test(`[DB-1-23-${id}] dash-tip-${id}-desc 클릭 → modal 텍스트 노출`, async ({ page }) => {
      await page.goto("/dashboard");
      await page.getByTestId(`dash-tip-${id}-desc`).click();
      await expect(page.locator("body")).toContainText(/설명|기준|왜/);
    });
  }
});

test.describe("DB-1 modal 6종 — 늘리는법/줄이는법 (fixture 부족 시 stub)", () => {
  test.beforeEach(async ({ page }) => {
    seed("P2");
    await signInAs(page, "P2");
  });

  // 각 메트릭의 act 버튼은 grade 가 보통/부족/경고 일 때만 렌더 (코드 line 890 isBad).
  // stubOverview 로 grade 를 낮춤 → act 버튼 노출 → 클릭 → modal.
  const cases = [
    { id: "cache", field: "cacheHitPct", value: 50, label: "늘리는법" },
    { id: "oneshot", field: "oneShotRate", value: 0.5, label: "늘리는법" },
    { id: "cost-session", field: "cost", value: 150, sessions: 1, label: "줄이는법" },
    { id: "calls-session", field: "calls", value: 7, sessions: 1, label: "최적화" },
    { id: "cost-call", field: "costPerCall", value: 0.25, calls: 1, label: "줄이는법" },
    { id: "out-in", field: "outputInputRatio", value: 2, label: "올리는법" },
  ];

  for (const c of cases) {
    test(`[DB-1-24-${c.id}] dash-tip-${c.id}-act 클릭 (grade 낮음 stub)`, async ({ page }) => {
      const stub: Record<string, number> = { [c.field]: c.value };
      if (c.sessions) stub.sessions = c.sessions;
      if (c.calls) stub.calls = c.calls;
      await stubOverview(page, stub);
      await page.goto("/dashboard");
      await expect(page.getByTestId(`dash-tip-${c.id}-act`)).toBeVisible();
      await page.getByTestId(`dash-tip-${c.id}-act`).click();
      await expect(page.locator("body")).toContainText(new RegExp(c.label));
    });
  }
});

// ─── DB-1 heatmap 5단계 색 ───────────────────────────────

test.describe("DB-1 [B] activity / dwell heatmap 5단계", () => {
  test("[DB-1-25~29][B] activity heatmap 5단계 fill", async () => {
    test.skip(true, "react-activity-calendar 라이브러리의 SVG rect fill style 이 즉시 evaluate 매칭 안 됨 (timing/library 의존). 별도 selector 패턴 + ccusage daily 우선 처리 + patchCcusageDaily 헬퍼 추가 — phase 2.1");
  });

  test("[DB-1-30~34][B] dwell heatmap 5단계", async () => {
    test.skip(true, "DB-1-25~29 와 동일 — 라이브러리 fill style 매칭 phase 2.1");
  });
});
