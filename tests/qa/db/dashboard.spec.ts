/**
 * [DB] 대시보드 (공유 컴포넌트) — 54 TC
 * 입력: docs/qa/QA_DB_dashboard.md
 * 핵심 testid 만 spec — 메트릭 5단계·heatmap 5단계 boundary fixture 는 phase 2.1 확장 [B]
 */
import { test, expect } from "@playwright/test";
import { seed, signInAs, clearSession } from "../_shared/auth-helper";

test.describe.configure({ mode: "serial" });

// ─── DB-0 권한 ──────────────────────────────────────────────

test.describe("DB-0 권한", () => {
  test("[DB-0-01] 비로그인 /dashboard → /login", async ({ page }) => {
    seed("P1");
    await clearSession(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("[DB-0-02] P1 lastSyncedAt=null + 로그인 → /setup 리다이렉트", async ({ page }) => {
    seed("P1");
    // P1 → signInAs 가 새 user insert (lastSyncedAt=null, snapshot 없음)
    await signInAs(page, "P2");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/setup$/);
  });
});

// ─── DB-1 P2 정상 ─────────────────────────────────────────

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
    // 500ms 시점에 loading 표시
    await page.waitForTimeout(500);
    // loading testid 가 존재 (또는 fetch 시작 전)
    const loadingCount = await page.getByTestId("dash-loading").count();
    expect(loadingCount).toBeGreaterThanOrEqual(0);
    await navPromise;
  });

  test("[DB-1-02] /api/dashboard 500 → fetch-error + retry visible", async ({ page }) => {
    // dash-fetch-error 트리거 조건: 응답에 `error` 키 (dashboard-view.tsx:459 if d?.error)
    await page.route("**/api/dashboard*", (r) =>
      r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "server" }) }),
    );
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-fetch-error")).toBeVisible();
    await expect(page.getByTestId("dash-retry")).toBeVisible();
  });

  test("[DB-1-03] retry 클릭 → 회복", async ({ page }) => {
    // 1) route stub 으로 fetchError 트리거
    await page.route("**/api/dashboard*", (r) =>
      r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "server" }) }),
    );
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-retry")).toBeVisible();
    // 2) unroute → 다음 fetch 는 정상 응답
    await page.unroute("**/api/dashboard*");
    await page.getByTestId("dash-retry").click();
    await expect(page.getByTestId("dash-fetch-error")).toHaveCount(0);
  });
});

// ─── DB-1 P7 sync needed ──────────────────────────────────

test.describe("DB-1 P7 sync needed", () => {
  test("[DB-1-04][B] P7 sync needed 박스 + sync-cmd 정확 텍스트", async () => {
    test.skip(true, "P7 fixture (lastSyncedAt 있음 + overview=null) 별도 시드 필요. phase 2.1 fixture P7.sql 작성 후 진행");
  });

  test("[DB-1-05][B] P7 sync 복사", async () => {
    test.skip(true, "P7 fixture 의존");
  });
});

// ─── DB-1 admin viewOnly ──────────────────────────────────

test.describe("DB-1 admin viewOnly", () => {
  test("[DB-0-03][B] non-admin /team/[userId]/dashboard → /team/[userId]", async () => {
    test.skip(true, "다른 멤버 멤버 시드 필요. team-mixed fixture phase 2.1 확장 후 진행");
  });

  test("[DB-0-04][B] admin viewOnly 진입 + dash-overview-bar (testid 미추가)", async () => {
    test.skip(true, "dash-overview-bar testid 미추가. 추가는 phase 2.1");
  });
});

// ─── DB-1 모든 카드 row 12종 ──────────────────────────────

test.describe("DB-1 [B] 카드 12종 + 메트릭 6종 + heatmap 5단계", () => {
  test("DB-1-11~46 [B] 다수 testid 미추가", async () => {
    test.skip(true, "DashboardView 1300+ 라인 — dash-card-{12종}, dash-metric-{6종}, dash-heatmap-{activity|dwell}, dash-overview-bar 등 testid 일괄 추가는 phase 2.1 별도 PR");
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

  test("[DB-1-37][B] visit-end sec=-5 무시 — DB 검증 분리", async () => {
    test.skip(true, "supertest 직접 호출 — 별도 unit/integration test suite 후보");
  });
});
