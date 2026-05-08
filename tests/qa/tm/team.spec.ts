/**
 * [TM] 팀 랭킹 — 34 TC
 * 입력: docs/qa/QA_TM_team.md
 * 핵심 testid 만 spec — efficiency cell 색·industry 6 row 등 phase 2.1 [B]
 */
import { test, expect } from "@playwright/test";
import { seed, signInAs, clearSession } from "../_shared/auth-helper";

test.describe.configure({ mode: "serial" });

// ─── TM-0 권한 ──────────────────────────────────────────────

test.describe("TM-0 권한", () => {
  test("[TM-0-01] 비로그인 /team → /login", async ({ page }) => {
    seed("P1");
    await clearSession(page);
    await page.goto("/team");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("[TM-0-02] P2 non-admin → engagement / top-sessions 미렌더", async ({ page }) => {
    seed("P2");
    await signInAs(page, "P2");
    await page.goto("/team");
    await expect(page.getByTestId("team-card-engagement")).toHaveCount(0);
    await expect(page.getByTestId("team-card-top-sessions")).toHaveCount(0);
  });

  test("[TM-0-03] P3 admin → engagement / top-sessions visible", async ({ page }) => {
    seed("P3");
    await signInAs(page, "P3");
    await page.goto("/team");
    await expect(page.getByTestId("team-card-engagement")).toBeVisible();
    await expect(page.getByTestId("team-card-top-sessions")).toBeVisible();
  });
});

// ─── TM-1 P2 ───────────────────────────────────────────────

test.describe("TM-1 P2 정상", () => {
  test.beforeAll(() => seed("P2"));
  test.beforeEach(async ({ page }) => signInAs(page, "P2"));

  test("[TM-1-01] period tab 5종 visible", async ({ page }) => {
    await page.goto("/team");
    await expect(page.getByTestId("team-period-today")).toBeVisible();
    await expect(page.getByTestId("team-period-month")).toBeVisible();
    await expect(page.getByTestId("team-period-8days")).toBeVisible();
    await expect(page.getByTestId("team-period-30days")).toBeVisible();
    await expect(page.getByTestId("team-period-all")).toBeVisible();
  });

  test("[TM-1-02] period 8days 클릭 → /api/team?period=8days 요청", async ({ page }) => {
    await page.goto("/team");
    const reqPromise = page.waitForResponse((r) => r.url().includes("/api/team") && r.url().includes("period=8days"));
    await page.getByTestId("team-period-8days").click();
    const res = await reqPromise;
    expect(res.status()).toBe(200);
  });

  test("[TM-1-03] summary-bar visible", async ({ page }) => {
    await page.goto("/team");
    await expect(page.getByTestId("team-summary-bar")).toBeVisible();
  });

  test("[TM-1-21] P2 fixture (30일 daily) → industry card visible", async ({ page }) => {
    await page.goto("/team");
    await expect(page.getByTestId("team-card-industry")).toBeVisible();
    await expect(page.getByTestId("team-card-industry")).toContainText("Primus vs 업계");
  });

  test("[TM-1-24] industry punch — multiplier 텍스트 (활용 팀)", async ({ page }) => {
    await page.goto("/team");
    const punch = await page.getByTestId("team-industry-punch").textContent();
    expect(punch).toMatch(/엔터 active day 평균/);
    expect(punch).toMatch(/배/);
    expect(punch).toContain("Claude Code 적극 활용 팀");
  });
});

// ─── TM-1 empty ───────────────────────────────────────────

test.describe("TM-1 empty", () => {
  test("[TM-1-04][B] 모든 멤버 시드 0 → empty 메시지", async () => {
    test.skip(true, "P3 admin 만 시드 + 다른 멤버 0 fixture 필요. team-empty 시드는 phase 2.1");
  });
});

// ─── TM-1 efficiency / engagement 5단계 ──────────────────

test.describe("TM-1 [B] efficiency cell 색 5단계", () => {
  test("TM-1-06~10 [B] efficiency cell BG 클래스 검증", async () => {
    test.skip(true, "C-1 §4-1 5단계 boundary fixture (cache 96/91/80/59 + composite 0.88/0.6/0.32) 별도 시드 필요. phase 2.1 fixture 확장");
  });

  test("TM-1-11~15 [B] sync badge / ccusage 배지 / ADMIN", async () => {
    test.skip(true, "P4(stale-2) / P5(stale-7) / P6(ccusage-missing) 멤버 시드 필요. phase 2.1");
  });

  test("TM-1-16~20 [B] engagement 행 / visits / top-sessions cap", async () => {
    test.skip(true, "daily_visits 시드 + topSessions 배열 시드 별도 필요. phase 2.1");
  });
});

// ─── TM-1 industry 상세 ───────────────────────────────────

test.describe("TM-1 [B] industry 외부/우리 6 row", () => {
  test("TM-1-22~23 [B] industry external 6 row + ours 5 percentile", async () => {
    test.skip(true, "team-industry-external / team-industry-ours testid 미추가. phase 2.1 별도 PR");
  });

  test("[TM-1-25][B] industryComparison undefined → 미렌더", async () => {
    test.skip(true, "page.route stub 으로 응답에서 industryComparison 키 제거 — 검증은 가능하나 dependent on testid. phase 2.1");
  });

  test("[TM-1-26][B] activeDayCount=0 → 미렌더", async () => {
    test.skip(true, "ccusage daily 0건 fixture 별도 시드. phase 2.1");
  });

  test("[TM-1-27][B] multiplier 3.0배 정확 fixture", async () => {
    test.skip(true, "activeDayAvg=39 정확 시드 — fixture cost 합 30일 평균 $39 필요. phase 2.1");
  });
});
