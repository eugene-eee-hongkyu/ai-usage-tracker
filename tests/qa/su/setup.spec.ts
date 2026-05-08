/**
 * [SU] 셋업 — 15 TC (자동 14 / 수동 1)
 * 입력: docs/qa/QA_SU_setup.md
 */
import { test, expect } from "@playwright/test";
import { seed, signInAs, clearSession } from "../_shared/auth-helper";

test.describe.configure({ mode: "serial" });

// ─── SU-0 권한 ──────────────────────────────────────────────

test("[SU-0-01] 비로그인 /setup → /login", async ({ page }) => {
  seed("P1");
  await clearSession(page);
  await page.goto("/setup");
  await expect(page).toHaveURL(/\/login(\?|$)/);
});

// ─── SU-1 OS 분기 ──────────────────────────────────────────

test.describe("SU-1 OS 분기 — UA context", () => {
  test.beforeAll(() => seed("P2"));

  test("[SU-1-01] UA Macintosh → 'macOS' + curl install", async ({ browser }) => {
    const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" });
    const page = await ctx.newPage();
    await signInAs(page, "P2");
    await page.goto("/setup");
    await expect(page.getByTestId("setup-os-badge")).toHaveText("macOS");
    const cmd = await page.getByTestId("setup-install-cmd").textContent();
    expect(cmd).toMatch(/^curl -fsSL/);
    expect(cmd).toMatch(/install\.sh \| bash$/);
    await ctx.close();
  });

  test("[SU-1-02] UA Windows → 'Windows' + irm install", async ({ browser }) => {
    const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" });
    const page = await ctx.newPage();
    await signInAs(page, "P2");
    await page.goto("/setup");
    await expect(page.getByTestId("setup-os-badge")).toHaveText("Windows");
    const cmd = await page.getByTestId("setup-install-cmd").textContent();
    expect(cmd).toMatch(/^irm /);
    expect(cmd).toMatch(/install\.ps1 \| iex$/);
    await ctx.close();
  });

  test("[SU-1-03] UA Linux → 'Linux' (코드 fallback) + npx-cmd visible", async ({ browser }) => {
    const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (X11; Linux x86_64)" });
    const page = await ctx.newPage();
    await signInAs(page, "P2");
    await page.goto("/setup");
    // 코드는 mac/windows 외 = "Linux" 라벨 + curl install (mac과 동일 분기)
    await expect(page.getByTestId("setup-os-badge")).toHaveText("Linux");
    // setup-npx-cmd 는 <details> 안 → DOM 존재만 검증 (visible 아님)
    await expect(page.getByTestId("setup-npx-cmd")).toHaveCount(1);
    await ctx.close();
  });
});

// ─── SU-1 npx 명령 텍스트 ──────────────────────────────────

test.describe("SU-1 install / npx 텍스트", () => {
  test.beforeAll(() => seed("P2"));
  test.beforeEach(async ({ page }) => signInAs(page, "P2"));

  test("[SU-1-04] setup-npx-cmd 정확 텍스트", async ({ page }) => {
    await page.goto("/setup");
    // <details> 안에 있어 visible 보장 안 됨 — text only
    const txt = await page.getByTestId("setup-npx-cmd").textContent();
    expect(txt).toBe("npx --yes --ignore-cache github:eugene-eee-hongkyu/ai-usage-tracker init");
  });

  test("[SU-1-05] install 복사 → 클립보드 = setup-install-cmd 텍스트", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/setup");
    const cmd = (await page.getByTestId("setup-install-cmd").textContent()) ?? "";
    await page.getByTestId("setup-install-copy").click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(cmd);
  });
});

// ─── SU-1 tz ──────────────────────────────────────────────

test.describe("SU-1 timezone", () => {
  test.beforeAll(() => seed("P2"));

  test("[SU-1-06] tz=Asia/Seoul context → setup-tz-select value 'Asia/Seoul'", async ({ browser }) => {
    const ctx = await browser.newContext({ timezoneId: "Asia/Seoul" });
    const page = await ctx.newPage();
    await signInAs(page, "P2");
    await page.goto("/setup");
    await expect(page.getByTestId("setup-tz-select")).toHaveValue("Asia/Seoul");
    await ctx.close();
  });

  test("[SU-1-07] tz 변경 → PATCH /api/user/timezone 발생", async ({ browser }) => {
    const ctx = await browser.newContext({ timezoneId: "Asia/Singapore" });
    const page = await ctx.newPage();
    await signInAs(page, "P2");
    await page.goto("/setup");
    const reqPromise = page.waitForRequest((r) => r.url().includes("/api/user/timezone") && r.method() === "PATCH");
    await page.getByTestId("setup-tz-select").selectOption("America/Los_Angeles");
    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({ timezone: "America/Los_Angeles" });
    await ctx.close();
  });
});

// ─── SU-1 폴링 + step ─────────────────────────────────────

test.describe("SU-1 폴링 + step + 대시보드 이동", () => {
  test.beforeAll(() => seed("P2"));

  test("[SU-1-08] not ready → step-hook visible (진행중)", async ({ page }) => {
    await signInAs(page, "P2");
    await page.route("**/api/setup/status", (r) =>
      r.fulfill({
        status: 200,
        body: JSON.stringify({
          ready: false,
          lastSyncedAt: null,
          sessionsCount: 0,
          steps: { cli_installed: false, hook_registered: false, first_session: false },
        }),
      }),
    );
    await page.goto("/setup");
    await expect(page.getByTestId("setup-step-hook")).toBeVisible();
    await expect(page.getByTestId("setup-go-dashboard")).toHaveCount(0);
  });

  test("[SU-1-09] ready → setup-go-dashboard visible + 텍스트", async ({ page }) => {
    await signInAs(page, "P2");
    await page.route("**/api/setup/status", (r) =>
      r.fulfill({
        status: 200,
        body: JSON.stringify({
          ready: true,
          lastSyncedAt: "2026-05-08T10:00:00Z",
          sessionsCount: 1,
          steps: { cli_installed: true, hook_registered: true, first_session: true },
        }),
      }),
    );
    await page.goto("/setup");
    await expect(page.getByTestId("setup-go-dashboard")).toBeVisible();
    await expect(page.getByTestId("setup-go-dashboard")).toContainText("대시보드로 가기");
  });

  test("[SU-1-10] setup-go-dashboard 클릭 → /dashboard URL", async ({ page }) => {
    await signInAs(page, "P2");
    await page.route("**/api/setup/status", (r) =>
      r.fulfill({
        status: 200,
        body: JSON.stringify({
          ready: true,
          lastSyncedAt: "2026-05-08T10:00:00Z",
          sessionsCount: 1,
          steps: { cli_installed: true, hook_registered: true, first_session: true },
        }),
      }),
    );
    await page.goto("/setup");
    await expect(page.getByTestId("setup-go-dashboard")).toBeVisible();
    await page.getByTestId("setup-go-dashboard").click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("[SU-1-11] 폴링 2s — /api/setup/status 5.5초간 ≥2회 호출", async ({ page }) => {
    await signInAs(page, "P2");
    let count = 0;
    await page.route("**/api/setup/status", (r) => {
      count++;
      r.fulfill({
        status: 200,
        body: JSON.stringify({
          ready: false,
          lastSyncedAt: null,
          sessionsCount: 0,
          steps: { cli_installed: false, hook_registered: false, first_session: false },
        }),
      });
    });
    await page.goto("/setup");
    await page.waitForTimeout(5500);
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

// ─── SU-1 엣지케이스 ─────────────────────────────────────

test.describe("SU-1 엣지", () => {
  test("[SU-1-12] tz invalid → PATCH 400", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await import("../_shared/auth-helper").then(({ seed, signInAs }) => {
      seed("P2");
      return signInAs(page, "P2");
    });
    const res = await page.request.patch("/api/user/timezone", {
      data: { timezone: "not_a_real_tz" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid timezone");
    await ctx.close();
  });

  test("[SU-1-13][M] 진짜 install.sh + launchctl", async () => {
    test.skip(true, "C-1 §3 #2 다섯째 — OS 권한 밖 (launchctl bootstrap). 친구 1명 수동 검증 (CONTEXT.md Hold 플래그 패턴)");
  });

  test("[SU-1-14][B] /api/setup/status 500 → 페이지 동작", async () => {
    test.skip(true, "A-2 §4 #2 docs 부족 — fetch 실패 UX 미정. spec 시도 후 docs 보강 필요");
  });
});
