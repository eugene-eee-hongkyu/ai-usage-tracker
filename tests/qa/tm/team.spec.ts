/**
 * [TM] 팀 랭킹 — 34 TC
 * 입력: docs/qa/QA_TM_team.md
 */
import { test, expect } from "@playwright/test";
import { seed, signInAs, clearSession, patchOverview, patchSnapshot } from "../_shared/auth-helper";

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

// ─── TM-1 P2 정상 ──────────────────────────────────────────

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

  test("[TM-1-21] P2 fixture 30일 daily → industry card visible", async ({ page }) => {
    await page.goto("/team");
    await expect(page.getByTestId("team-card-industry")).toBeVisible();
    await expect(page.getByTestId("team-card-industry")).toContainText("Primus vs 업계");
  });

  test("[TM-1-22] industry-external — 외부 6 출처 텍스트 포함", async ({ page }) => {
    await page.goto("/team");
    await expect(page.getByTestId("team-industry-external")).toContainText("Anthropic 평균 사용자");
    await expect(page.getByTestId("team-industry-external")).toContainText("엔터 active day 평균");
    await expect(page.getByTestId("team-industry-external")).toContainText("as of 2026-05");
  });

  test("[TM-1-23] industry-ours — 5 percentile + active day 평균", async ({ page }) => {
    await page.goto("/team");
    await expect(page.getByTestId("team-industry-ours")).toContainText("active day 평균");
    await expect(page.getByTestId("team-industry-ours")).toContainText("p50");
    await expect(page.getByTestId("team-industry-ours")).toContainText("p75");
    await expect(page.getByTestId("team-industry-ours")).toContainText("p90");
    await expect(page.getByTestId("team-industry-ours")).toContainText("max");
  });

  test("[TM-1-24] industry punch — multiplier 텍스트 (활용 팀)", async ({ page }) => {
    await page.goto("/team");
    const punch = await page.getByTestId("team-industry-punch").textContent();
    expect(punch).toMatch(/엔터 active day 평균/);
    expect(punch).toMatch(/배/);
    expect(punch).toContain("Claude Code 적극 활용 팀");
  });
});

// ─── TM-1 team-mixed (P2+P3+P4+P5+P6) ────────────────────

test.describe("TM-1 team-mixed — admin 시점 다양한 멤버", () => {
  test.beforeAll(() => seed("team-mixed"));
  test.beforeEach(async ({ page }) => signInAs(page, "team-mixed"));

  test("[TM-1-06] P2 alice cache 91 → efficiency 행 visible (양호)", async ({ page }) => {
    await page.goto("/team");
    await expect(page.getByTestId("team-eff-row-10")).toBeVisible();
  });

  test("[TM-1-11] P4 bob (60h stale) → sync-badge yellow + '2일전'", async ({ page }) => {
    await page.goto("/team");
    const badge = page.getByTestId("team-sync-badge-13");
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(/2일전?/);
  });

  test("[TM-1-12] P5 carol (8d stale) → sync-badge red + '⚠'", async ({ page }) => {
    await page.goto("/team");
    const badge = page.getByTestId("team-sync-badge-14");
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(/⚠/);
  });

  test("[TM-1-14] P6 dave (ccusage missing) → ccusage❌ 배지 + tooltip", async ({ page }) => {
    await page.goto("/team");
    // P6 의 efficiency row 자식 (team-eff-row-15) 안 또는 by-member card 안에 있음
    const badge = page.getByTestId("team-ccusage-badge-15").first();
    await expect(badge).toContainText("ccusage❌");
  });

  test("[TM-1-15] admin 진입 → engagement 카드 헤더 'ADMIN' 배지", async ({ page }) => {
    await page.goto("/team");
    // ADMIN 배지는 engagement 카드 + top sessions 카드 헤더 옆에 위치 (admin only).
    await expect(page.getByTestId("team-card-engagement")).toContainText("ADMIN");
  });

  test("[TM-1-16] engagement row + visits cell — P2 alice 양수", async ({ page }) => {
    await page.goto("/team");
    await expect(page.getByTestId("team-card-engagement")).toBeVisible();
    await expect(page.getByTestId("team-eng-row-10")).toBeVisible();
    // monthVisits 는 이번달 daily_visits 합 — 시드 today 5 + 어제 3 + visit POST 자동 카운트.
    // 정확 5 가 아닌 양수만 검증.
    const txt = await page.getByTestId("team-eng-visits-10").textContent();
    const n = parseInt((txt ?? "0").trim(), 10);
    expect(n).toBeGreaterThanOrEqual(1);
  });

  test("[TM-1-17] P5 carol visits 0 → red class", async ({ page }) => {
    await page.goto("/team");
    const cell = page.getByTestId("team-eng-visits-14");
    const cls = await cell.getAttribute("class");
    expect(cls).toMatch(/text-red/);
  });

  test("[TM-1-18] P4 bob visits 2 → yellow class", async ({ page }) => {
    await page.goto("/team");
    const cell = page.getByTestId("team-eng-visits-13");
    const cls = await cell.getAttribute("class");
    expect(cls).toMatch(/text-yellow/);
  });

  test("[TM-1-19] P2 alice visits 5 → normal class (red/yellow 모두 아님)", async ({ page }) => {
    await page.goto("/team");
    const cell = page.getByTestId("team-eng-visits-10");
    const cls = await cell.getAttribute("class");
    expect(cls).not.toMatch(/text-red/);
    expect(cls).not.toMatch(/text-yellow-500/); // yellow-500 이 yellow 케이스
  });

  test("[TM-1-30] engagement 정렬 — stale (P5) 우선 (lastSyncedAt 오래된 순)", async ({ page }) => {
    await page.goto("/team");
    const rows = page.locator('[data-testid^="team-eng-row-"]');
    const firstId = await rows.first().getAttribute("data-testid");
    // P5 carol id=14 lastSyncedAt = NOW-8d (가장 오래) 가 첫 번째여야 함
    expect(firstId).toBe("team-eng-row-14");
  });
});

// ─── TM-1 industry comparison 분기 ──────────────────────

test.describe("TM-1 industry 분기", () => {
  test.beforeAll(() => seed("P2"));
  test.beforeEach(async ({ page }) => signInAs(page, "P2"));

  test("[TM-1-25] industryComparison undefined → 카드 미렌더", async ({ page }) => {
    await page.route("**/api/team*", async (r) => {
      const original = await r.fetch();
      const body = await original.json();
      delete body.industryComparison;
      await r.fulfill({ response: original, json: body });
    });
    await page.goto("/team");
    await expect(page.getByTestId("team-summary-bar")).toBeVisible();
    await expect(page.getByTestId("team-card-industry")).toHaveCount(0);
  });

  test("[TM-1-26] activeDayCount=0 → 카드 미렌더", async ({ page }) => {
    await page.route("**/api/team*", async (r) => {
      const original = await r.fetch();
      const body = await original.json();
      if (body.industryComparison) body.industryComparison.activeDayCount = 0;
      await r.fulfill({ response: original, json: body });
    });
    await page.goto("/team");
    await expect(page.getByTestId("team-summary-bar")).toBeVisible();
    await expect(page.getByTestId("team-card-industry")).toHaveCount(0);
  });
});

// ─── TM-1 efficiency cell BG 5단계 (patchOverview 활용) ──

test.describe("TM-1 efficiency cell BG 5단계", () => {
  test.beforeAll(() => {
    seed("team-mixed");
    // team route period=all 분기에서 snap.cacheHitPct 컬럼 사용 → patchSnapshot.
    patchSnapshot(10, { cache_hit_pct: 96 }); // 탁월
    patchSnapshot(13, { cache_hit_pct: 91 }); // 양호
    patchSnapshot(14, { cache_hit_pct: 80 }); // 보통
    patchSnapshot(15, { cache_hit_pct: 70 }); // 부족
    patchSnapshot(12, { cache_hit_pct: 50 }); // 경고
  });
  test.beforeEach(async ({ page }) => signInAs(page, "team-mixed"));

  // team page default period="month" 인데 team route line 230 분기에서 raw_json.month.overview 우선.
  // patchOverview 는 raw_json.all.overview 만 변경 → period=all 클릭 후 검증.

  test("[TM-1-06b] alice cache=96 → cell title='탁월'", async ({ page }) => {
    await page.goto("/team");
    await page.getByTestId("team-period-all").click();
    await expect(page.getByTestId("team-eff-cache-10")).toHaveAttribute("title", "탁월");
  });
  test("[TM-1-07] bob cache=91 → cell title='양호'", async ({ page }) => {
    await page.goto("/team");
    await page.getByTestId("team-period-all").click();
    await expect(page.getByTestId("team-eff-cache-13")).toHaveAttribute("title", "양호");
  });
  test("[TM-1-08] carol cache=80 → cell title='보통'", async ({ page }) => {
    await page.goto("/team");
    await page.getByTestId("team-period-all").click();
    await expect(page.getByTestId("team-eff-cache-14")).toHaveAttribute("title", "보통");
  });
  test("[TM-1-09] dave cache=70 → cell title='부족'", async ({ page }) => {
    await page.goto("/team");
    await page.getByTestId("team-period-all").click();
    await expect(page.getByTestId("team-eff-cache-15")).toHaveAttribute("title", "부족");
  });
  test("[TM-1-10] eugene cache=50 → cell title='경고'", async ({ page }) => {
    await page.goto("/team");
    await page.getByTestId("team-period-all").click();
    await expect(page.getByTestId("team-eff-cache-12")).toHaveAttribute("title", "경고");
  });
});

// ─── TM-1 empty / fetchError ────────────────────────────

test.describe("TM-1 empty + fetchError", () => {
  test.beforeAll(() => seed("P3"));
  test.beforeEach(async ({ page }) => signInAs(page, "P3"));

  test("[TM-1-04] byEfficiency 빈 응답 (route stub) → team-empty 메시지", async ({ page }) => {
    await page.route("**/api/team*", async (r) => {
      const original = await r.fetch();
      const body = await original.json();
      body.byEfficiency = [];
      body.bySessions = [];
      body.dailyByMember = [];
      await r.fulfill({ response: original, json: body });
    });
    await page.goto("/team");
    await expect(page.getByTestId("team-empty")).toBeVisible();
    await expect(page.getByTestId("team-empty")).toContainText("해당 기간에 활동 데이터가 없어요");
  });

  test("[TM-1-29] /api/team 500 → team-fetch-error + retry visible", async ({ page }) => {
    seed("P2");
    await signInAs(page, "P2");
    await page.route("**/api/team*", (r) =>
      r.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );
    await page.goto("/team");
    await expect(page.getByTestId("team-fetch-error")).toBeVisible();
    await expect(page.getByTestId("team-retry")).toBeVisible();
  });
});

// ─── TM 잔여 — multiplier / stale 멤버 / by-member 색 ──

test.describe("TM 잔여", () => {
  test("[TM-1-27] multiplier 3.0 정확 (activeDayAvg=39 stub)", async ({ page }) => {
    seed("P2");
    await signInAs(page, "P2");
    await page.route("**/api/team*", async (r) => {
      const original = await r.fetch();
      const body = await original.json();
      if (body.industryComparison) {
        body.industryComparison.activeDayAvg = 39;
        body.industryComparison.activeDayCount = 30;
      }
      await r.fulfill({ response: original, json: body });
    });
    await page.goto("/team");
    await expect(page.getByTestId("team-industry-punch")).toContainText("3.0배");
  });

  test("[TM-1-31] stale 멤버 (P5 carol) cost 0 처리", async ({ page }) => {
    seed("team-mixed");
    await signInAs(page, "team-mixed");
    await page.goto("/team");
    // P5 carol id=14 → today.daily 비어있어 stale 필터 적용. cost 셀이 $0.00.
    // period=month default → ov.cost = month.overview.totalCost = 0.
    const cell = page.getByTestId("team-eff-cost-14");
    await expect(cell).toContainText("$0");
  });

  test("[TM-1-05] activity / cost 카드 visible (P2)", async ({ page }) => {
    seed("P2");
    await signInAs(page, "P2");
    await page.goto("/team");
    await expect(page.getByTestId("team-card-activity")).toBeVisible();
    await expect(page.getByTestId("team-card-cost")).toBeVisible();
  });

  test("[TM-1-13] 미수신 배지 (lastSyncedAt=null user)", async ({ page }) => {
    seed("team-mixed");
    await signInAs(page, "team-mixed");
    // team-mixed 의 alice (id=10) 의 lastSyncedAt 을 null 로 변형 → '미수신' 배지
    const { execSync } = await import("node:child_process");
    execSync(
      `psql "${process.env.DATABASE_URL}" -c "UPDATE users SET last_synced_at = NULL WHERE id = 10"`,
      { stdio: "pipe" },
    );
    await page.goto("/team");
    await expect(page.getByTestId("team-sync-badge-10")).toContainText("미수신");
  });

  test("[TM-1-20] top-sessions 응답 length ≤ 15 (서버 cap, supertest)", async ({ page }) => {
    seed("team-mixed");
    await signInAs(page, "team-mixed");
    // 서버측 cap 검증 — /api/team 응답의 topSessions.length 가 15 이하
    const res = await page.request.get("/api/team?period=all");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.topSessions)).toBe(true);
    expect(body.topSessions.length).toBeLessThanOrEqual(15);
  });

  test("[TM-1-28] by-member 차트 visible — dailyByMember stub", async ({ page }) => {
    seed("team-mixed");
    await signInAs(page, "team-mixed");
    // dailyByMember 응답을 길이 > 1 + memberNames 8명으로 stub → by-member 카드 렌더
    await page.route("**/api/team*", async (r) => {
      const original = await r.fetch();
      const body = await original.json();
      const today = new Date();
      const dates = Array.from({ length: 5 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (4 - i));
        return d.toISOString().slice(0, 10);
      });
      body.memberNames = ["A", "B", "C", "D", "E", "F", "G", "H"];
      body.dailyByMember = dates.map((date) => {
        const row: Record<string, unknown> = { date };
        for (const n of body.memberNames as string[]) row[n] = Math.random() * 10;
        return row;
      });
      await r.fulfill({ response: original, json: body });
    });
    await page.goto("/team");
    await expect(page.getByTestId("team-card-by-member")).toBeVisible();
  });
});
