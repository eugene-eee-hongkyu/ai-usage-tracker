/**
 * [SS] 셋업 상태 — 15 TC (모두 자동)
 * 입력: docs/qa/QA_SS_setup_status.md
 */
import { test, expect } from "@playwright/test";
import { seed, signInAs, clearSession, patchSync } from "../_shared/auth-helper";

test.describe.configure({ mode: "serial" });

// ─── SS-0 권한 ──────────────────────────────────────────────

test.describe("SS-0 권한", () => {
  test("[SS-0-01] 비로그인 /setup-status → /login", async ({ page }) => {
    seed("P1");
    await clearSession(page);
    await page.goto("/setup-status");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});

// ─── SS-1 P2 정상 ──────────────────────────────────────────

test.describe("SS-1 P2 정상 작동", () => {
  test.beforeAll(() => seed("P2"));
  test.beforeEach(async ({ page }) => signInAs(page, "P2"));

  test("[SS-1-01] P2 lastSyncedAt 신선 → status-overall '정상 작동 중'", async ({ page }) => {
    await page.goto("/setup-status");
    await expect(page.getByTestId("status-overall")).toContainText("정상 작동 중");
    await expect(page.getByTestId("status-stale-warning")).toHaveCount(0);
  });

  test("[SS-1-04] step 3종 visible", async ({ page }) => {
    await page.goto("/setup-status");
    await expect(page.getByTestId("status-step-cli")).toBeVisible();
    await expect(page.getByTestId("status-step-hook")).toBeVisible();
    await expect(page.getByTestId("status-step-first-session")).toBeVisible();
  });

  test("[SS-1-05] cli 명령 클립보드 복사", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/setup-status");
    await page.getByTestId("status-copy-cli").click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe("npx github:eugene-eee-hongkyu/ai-usage-tracker init");
  });

  test("[SS-1-11] status-faq-no-data 토글", async ({ page }) => {
    await page.goto("/setup-status");
    const faq = page.getByTestId("status-faq-no-data");
    await faq.click();
    await expect(faq).toHaveJSProperty("open", true);
  });

  test("[SS-1-12] status-faq-reset-key 토글", async ({ page }) => {
    await page.goto("/setup-status");
    const faq = page.getByTestId("status-faq-reset-key");
    await faq.click();
    await expect(faq).toHaveJSProperty("open", true);
  });

  test("[SS-1-13] status-faq-backfill 토글", async ({ page }) => {
    await page.goto("/setup-status");
    const faq = page.getByTestId("status-faq-backfill");
    await faq.click();
    await expect(faq).toHaveJSProperty("open", true);
  });

  test("[SS-1-14] status-faq-win-hook 토글", async ({ page }) => {
    await page.goto("/setup-status");
    const faq = page.getByTestId("status-faq-win-hook");
    await faq.click();
    await expect(faq).toHaveJSProperty("open", true);
  });
});

// ─── SS-1 P1 신규 ──────────────────────────────────────────

test.describe("SS-1 P1 신규", () => {
  test("[SS-1-02] P1 lastSyncedAt=null → '셋업 진행 중'", async ({ page }) => {
    seed("P1");
    // P1 은 user 없음 — sign-in 시 NextAuth signIn callback 이 user insert.
    // setup-status 응답: lastSyncedAt=null, sessionsCount=0, ready=false.
    await signInAs(page, "P2"); // signInAs 가 user insert 후 P1 상태와 유사 (snapshot 없음)
    await page.goto("/setup-status");
    await expect(page.getByTestId("status-overall")).toContainText("셋업 진행 중");
  });
});

// ─── SS-1 P5 stale ──────────────────────────────────────────

test.describe("SS-1 P5 stale 8일", () => {
  test.beforeAll(() => seed("P5"));
  test.beforeEach(async ({ page }) => signInAs(page, "P5"));

  test("[SS-1-03] P5 lastSyncedAt 8일 → ⚠ 박스 visible", async ({ page }) => {
    await page.goto("/setup-status");
    await expect(page.getByTestId("status-stale-warning")).toBeVisible();
    await expect(page.getByTestId("status-stale-warning")).toContainText("수집이 멈췄을 수 있어요");
  });
});

// ─── SS-1 fetchError ──────────────────────────────────────

test.describe("SS-1 fetchError", () => {
  test.beforeAll(() => seed("P2"));
  test.beforeEach(async ({ page }) => signInAs(page, "P2"));

  test("[SS-1-09] /api/setup/status 500 → fetch-error + retry visible", async ({ page }) => {
    await page.route("**/api/setup/status", (r) => r.fulfill({ status: 500, body: "{}" }));
    await page.goto("/setup-status");
    await expect(page.getByTestId("status-fetch-error")).toBeVisible();
    await expect(page.getByTestId("status-retry")).toBeVisible();
  });

  test("[SS-1-10] retry 클릭 → 회복", async ({ page }) => {
    let firstCall = true;
    await page.route("**/api/setup/status", (r) => {
      if (firstCall) {
        firstCall = false;
        r.fulfill({ status: 500, body: "{}" });
      } else {
        r.continue();
      }
    });
    await page.goto("/setup-status");
    await expect(page.getByTestId("status-retry")).toBeVisible();
    await page.getByTestId("status-retry").click();
    await expect(page.getByTestId("status-overall")).toBeVisible();
    await expect(page.getByTestId("status-fetch-error")).toHaveCount(0);
  });
});

// ─── SS-1 boundary ─────────────────────────────────────────

test.describe("SS-1 stale boundary", () => {
  test("[SS-1-06] stale-warning 텍스트 = '⚠️ 수집이 멈췄을 수 있어요'", async ({ page }) => {
    seed("P5");
    await signInAs(page, "P5");
    await page.goto("/setup-status");
    await expect(page.getByTestId("status-stale-warning")).toContainText("⚠️ 수집이 멈췄을 수 있어요");
  });

  test("[SS-1-07] stale 23h boundary → 미렌더", async ({ page }) => {
    seed("P5"); // base
    patchSync(14, 23); // user 14 → last_synced_at NOW - 23h (24h 임계 미만)
    await signInAs(page, "P5");
    await page.goto("/setup-status");
    await expect(page.getByTestId("status-stale-warning")).toHaveCount(0);
  });

  test("[SS-1-08] stale 25h boundary → 렌더", async ({ page }) => {
    seed("P5");
    patchSync(14, 25); // 25h (24h 임계 초과)
    await signInAs(page, "P5");
    await page.goto("/setup-status");
    await expect(page.getByTestId("status-stale-warning")).toBeVisible();
  });
});
