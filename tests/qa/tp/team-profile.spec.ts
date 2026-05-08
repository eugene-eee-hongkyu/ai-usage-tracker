/**
 * [TP] 멤버 공개 프로필 — phase 2.0 PoC 모듈
 * 입력: docs/qa/QA_TP_team_profile.md (17 TC)
 * 자동화 분류: docs/qa-output/qa-automation-map.md (17/17 모두 AUTOMATABLE)
 * 페르소나: C-1 §2 P1·P2·P3 (db/seed/P{n}.sql)
 */
import { test, expect } from "@playwright/test";
import { seed, signInAs, clearSession, patchDailyCost } from "../_shared/auth-helper";

test.describe.configure({ mode: "serial" });

// ─── TP-0 권한 ──────────────────────────────────────────────

test.describe("TP-0 권한", () => {
  test("[TP-0-01] 비로그인 /team/10 → /login 리다이렉트", async ({ page }) => {
    seed("P2");
    await clearSession(page);
    await page.goto("/team/10");
    await expect(page).toHaveURL(/\/login/);
  });

  test("[TP-0-02] 존재하지 않는 userId → API 404 + 화면 not-found 메시지", async ({ page }) => {
    seed("P2");
    await signInAs(page, "P2");
    const res = await page.request.get("/api/members/99999");
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error", "not found");
    // 화면 검증: /team/99999 진입 시 not-found 메시지
    await page.goto("/team/99999");
    await expect(page.getByTestId("member-not-found")).toBeVisible();
    await expect(page.getByTestId("member-not-found")).toContainText("멤버를 찾을 수 없어요");
  });
});

// ─── TP-1 P2 정상-일반 (id=10) ────────────────────────────

test.describe("TP-1 P2 정상-일반 fixture", () => {
  test.beforeAll(() => seed("P2"));
  test.beforeEach(async ({ page }) => signInAs(page, "P2"));

  test("[TP-1-01] summary-cost 텍스트 = $423.78", async ({ page }) => {
    await page.goto("/team/10");
    await expect(page.getByTestId("member-summary-cost")).toContainText("$423.78");
  });

  test("[TP-1-02] summary-sessions 텍스트 = 92회", async ({ page }) => {
    await page.goto("/team/10");
    await expect(page.getByTestId("member-summary-sessions")).toContainText("92");
  });

  test("[TP-1-03] summary-cache 텍스트 = 91% (정수 반올림)", async ({ page }) => {
    await page.goto("/team/10");
    await expect(page.getByTestId("member-summary-cache")).toContainText("91");
    await expect(page.getByTestId("member-summary-cache")).toContainText("%");
  });

  test("[TP-1-04] summary-streak 양수 (30일 daily 전부 cost>0)", async ({ page }) => {
    await page.goto("/team/10");
    const txt = await page.getByTestId("member-summary-streak").textContent();
    const m = txt?.match(/(\d+)/);
    expect(m).not.toBeNull();
    expect(parseInt(m![1], 10)).toBeGreaterThanOrEqual(1);
  });

  test("[TP-1-05] 4주 heatmap 카드 visible", async ({ page }) => {
    await page.goto("/team/10");
    await expect(page.getByTestId("member-heatmap-4w")).toBeVisible();
    // ActivityCalendar 라이브러리 → 자식 SVG/rect count 검증은 라이브러리 구현 의존이라 visible 만 검증
  });

  test("[TP-1-06] projects 행 1~10개 (fixture 3개)", async ({ page }) => {
    await page.goto("/team/10");
    const rows = page.locator('[data-testid^="member-project-row-"]');
    // toHaveCount 는 자동 retry — client-side fetch 완료 대기
    await expect(rows).toHaveCount(3);
  });
});

// ─── TP-1 P3 admin 자기 자신 ─────────────────────────

test.describe("TP-1 P3 admin 자기 자신", () => {
  test.beforeAll(() => seed("P3"));
  test.beforeEach(async ({ page }) => signInAs(page, "P3"));

  test("[TP-1-14] admin (id=12) 자기 프로필 — non-admin 과 동일 렌더 (#5 admin 분기 없음)", async ({ page }) => {
    await page.goto("/team/12");
    await expect(page.getByTestId("member-summary-cost")).toBeVisible();
    await expect(page.getByTestId("member-summary-sessions")).toBeVisible();
    await expect(page.getByTestId("member-summary-cache")).toBeVisible();
    await expect(page.getByTestId("member-summary-streak")).toBeVisible();
    await expect(page.getByTestId("member-heatmap-4w")).toBeVisible();
  });
});

// ─── TP-1 P1 신규 (rows=0) ────────────────────────────

test.describe("TP-1 P1 신규 fixture", () => {
  test("[TP-1-13][B] P1 (rows=0) /api/members/10 → 404", async ({ page }) => {
    seed("P1");
    // P1 은 자체 user 도 없음 → signInAs 가 callback signIn 단계에서 user insert 시도
    // 우리 P1 fixture 는 TRUNCATE 만이라 sign-in 시도 user 신규 insert → 페르소나가 P1 정의에서 벗어남
    // → 별도 user 만 INSERT 후 다른 userId 조회로 404 검증
    await page.request.post("/api/auth/callback/credentials").catch(() => undefined); // best-effort
    // 우회: P2 시드 + 99999 (TP-0-02 와 동일) — 별도 TC 로 의미. 여기선 [B] 명시.
    test.skip(true, "P1 정의가 user row 0 인데 sign-in 자체가 user insert → P1 + 자기 조회 모순. [B] BLOCKED — A-2 §4 #5 의 'rows=0' UX 명시 필요. spec 동작은 TP-0-02 가 대체.");
  });
});

// ─── TP-1 heatmap 5단계 색 (data-level + fill attr) ──────

test.describe("TP-1 heatmap 5단계", () => {
  // /api/members/[userId] 응답 daily 는 raw_json.all.daily 사용. patchDailyCost 로 변형.
  // C-1 §4-3 활동 임계: =0 / <5 / 5~24.99 / 25~99.99 / ≥100

  test.beforeEach(async ({ page }) => {
    seed("P2");
    await signInAs(page, "P2");
  });

  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  test("[TP-1-07] cost=0 → level 0 fill #1e293b", async ({ page }) => {
    patchDailyCost(10, yesterday, 0);
    await page.goto("/team/10");
    const rect = page.locator(`[data-testid="member-heatmap-4w"] rect[data-date="${yesterday}"]`);
    await expect(rect).toHaveAttribute("fill", "#1e293b");
  });

  test("[TP-1-08] cost=4 → level 1 fill #4338ca", async ({ page }) => {
    patchDailyCost(10, yesterday, 4);
    await page.goto("/team/10");
    const rect = page.locator(`[data-testid="member-heatmap-4w"] rect[data-date="${yesterday}"]`);
    await expect(rect).toHaveAttribute("fill", "#4338ca");
  });

  test("[TP-1-09] cost=24 → level 2 fill #6366f1", async ({ page }) => {
    patchDailyCost(10, yesterday, 24);
    await page.goto("/team/10");
    const rect = page.locator(`[data-testid="member-heatmap-4w"] rect[data-date="${yesterday}"]`);
    await expect(rect).toHaveAttribute("fill", "#6366f1");
  });

  test("[TP-1-10] cost=99 → level 3 fill #818cf8", async ({ page }) => {
    patchDailyCost(10, yesterday, 99);
    await page.goto("/team/10");
    const rect = page.locator(`[data-testid="member-heatmap-4w"] rect[data-date="${yesterday}"]`);
    await expect(rect).toHaveAttribute("fill", "#818cf8");
  });

  test("[TP-1-11] cost=100 → level 4 fill #a5b4fc", async ({ page }) => {
    patchDailyCost(10, yesterday, 100);
    await page.goto("/team/10");
    const rect = page.locator(`[data-testid="member-heatmap-4w"] rect[data-date="${yesterday}"]`);
    await expect(rect).toHaveAttribute("fill", "#a5b4fc");
  });

  test("[TP-1-15] daily 모두 0 → streak=0", async ({ page }) => {
    // P2 fixture 의 모든 daily 행 cost=0 으로 일괄 변형 → activeDateSet 비어있음 → streak=0.
    const url = process.env.DATABASE_URL!;
    const { execSync } = await import("node:child_process");
    execSync(
      `psql "${url}" -c "UPDATE user_snapshots SET raw_json = jsonb_set(raw_json, '{all,daily}', (SELECT jsonb_agg(jsonb_set(d, '{cost}', '0'::jsonb)) FROM jsonb_array_elements(raw_json->'all'->'daily') d)) WHERE user_id = 10"`,
      { stdio: "pipe" },
    );
    await page.goto("/team/10");
    await expect(page.getByTestId("member-summary-streak")).toContainText("0");
  });
});
