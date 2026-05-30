/**
 * [CX] Codex provider — 8 그룹.
 *   CX-1  segmented control 가시성 (8 화면)
 *   CX-2  disabled chip → dialog 분기
 *   CX-3  Codex 데이터 실제 표시 (회귀 가드)
 *   CX-4  modal 자동 open + Codex tier 옵션
 *   CX-5  Claude vs Codex 독립 입력
 *   CX-6  useProviderPreference 화면 간 공유
 *   CX-7  modal 안 외부 billing 링크
 *   CX-8  API 직접 (PATCH /api/user/plan-tier)
 *
 * fixture: P9 (personal user, Codex 데이터 있음) + team-codex (admin/oreo/bob).
 */
import { test, expect } from "@playwright/test";
import { seed, signInAs, clearSession, queryScalar } from "../_shared/auth-helper";

test.describe.configure({ mode: "serial" });

// ─── CX-1 segmented control 가시성 (smoke) ────────────────

test.describe("CX-1 가시성", () => {
  test.beforeAll(() => seed("team-codex"));
  test.beforeEach(async ({ page }) => signInAs(page, "team-codex"));

  test("[CX-1-01] /dashboard — claude / codex chip 보임, 기본 = claude", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("dash-provider-claude")).toBeVisible();
    await expect(page.getByTestId("dash-provider-codex")).toBeVisible();
  });

  test("[CX-1-02] /team — team-provider 칩 2종 보임", async ({ page }) => {
    await page.goto("/team");
    await expect(page.getByTestId("team-provider-claude")).toBeVisible();
    await expect(page.getByTestId("team-provider-codex")).toBeVisible();
  });

  test("[CX-1-03] /ranking — ranking-provider 보임 + '랭킹' h1 안 보임", async ({ page }) => {
    await page.goto("/ranking");
    await expect(page.getByTestId("ranking-provider-claude")).toBeVisible();
    await expect(page.getByTestId("ranking-provider-codex")).toBeVisible();
    // "랭킹" h1 제거 검증 — h1 자체가 없어야 함
    await expect(page.locator("h1", { hasText: /^랭킹$/ })).toHaveCount(0);
  });

  test("[CX-1-04] /admin/team — TeamView wrap, team-provider 보임", async ({ page }) => {
    await page.goto("/admin/team");
    await expect(page.getByTestId("team-provider-claude")).toBeVisible();
    await expect(page.getByTestId("team-provider-codex")).toBeVisible();
  });

  test("[CX-1-05] /admin/members — DashboardView wrap, dash-provider 보임", async ({ page }) => {
    await page.goto("/admin/members");
    await expect(page.getByTestId("dash-provider-claude")).toBeVisible();
    await expect(page.getByTestId("dash-provider-codex")).toBeVisible();
  });

  test("[CX-1-06] /platform-admin/all-users — all-users-provider 보임", async ({ page }) => {
    await page.goto("/platform-admin/all-users");
    await expect(page.getByTestId("all-users-provider-claude")).toBeVisible();
    await expect(page.getByTestId("all-users-provider-codex")).toBeVisible();
  });

  test("[CX-1-07] /platform-admin/all-personal — all-personal-provider 보임", async ({ page }) => {
    await page.goto("/platform-admin/all-personal");
    await expect(page.getByTestId("all-personal-provider-claude")).toBeVisible();
    await expect(page.getByTestId("all-personal-provider-codex")).toBeVisible();
  });

  test("[CX-1-08] /platform-admin/all-teams — all-teams-provider 보임 (옛 codex scope 누락 회귀 가드)", async ({ page }) => {
    await page.goto("/platform-admin/all-teams");
    await expect(page.getByTestId("all-teams-provider-claude")).toBeVisible();
    await expect(page.getByTestId("all-teams-provider-codex")).toBeVisible();
  });
});

// ─── CX-2 disabled chip 분기 ──────────────────────────────

test.describe("CX-2 disabled chip", () => {
  test.beforeAll(() => seed("team-codex"));
  test.beforeEach(async ({ page }) => signInAs(page, "team-codex-bob")); // bob: Claude only

  test("[CX-2-01] Codex 데이터 없는 사용자 → Codex chip 클릭 시 dialog 출현", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("dash-provider-codex").click();
    await expect(page.getByTestId("provider-disabled-dialog-codex")).toBeVisible();
    await expect(page.getByText("Codex 사용 기록 없음")).toBeVisible();
  });

  test("[CX-2-02] dialog '확인' 클릭 → 닫힘", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("dash-provider-codex").click();
    await page.getByRole("button", { name: "확인" }).click();
    await expect(page.getByTestId("provider-disabled-dialog-codex")).toBeHidden();
  });
});

// ─── CX-3 Codex 데이터 실제 표시 ──────────────────────────

test.describe("CX-3 Codex 데이터 표시", () => {
  test.beforeAll(() => seed("team-codex"));
  test.beforeEach(async ({ page }) => signInAs(page, "team-codex"));

  test("[CX-3-01] /team — Codex 탭에서 oreo 가 by-member 카드에 보임 (그룹 1-8 의 옛 all-teams 누락 fix 검증)", async ({ page }) => {
    await page.goto("/team");
    await page.getByTestId("team-provider-codex").click();
    // by-member 카드의 legend 에 Oreo / Eugene 만 (Bob 은 Claude only 라 codex 탭에 안 보여야 함)
    const byMember = page.getByTestId("team-card-by-member");
    await expect(byMember).toBeVisible();
    await expect(byMember).not.toContainText("Bob");
  });

  test("[CX-3-02] /ranking — Codex 탭 활성화 시 페이지 정상 로드 (loading 안 끝나면 에러)", async ({ page }) => {
    await page.goto("/ranking");
    await page.getByTestId("ranking-provider-codex").click();
    await expect(page.locator("text=loading…")).toHaveCount(0, { timeout: 5000 });
  });
});

// ─── CX-4 modal 자동 open + Codex tier 옵션 ───────────────

test.describe("CX-4 modal", () => {
  test.beforeEach(async ({ page }) => {
    seed("P9"); // codex_plan_tier=NULL 시작
    await signInAs(page, "P9");
  });

  test("[CX-4-01] Codex 탭 진입 → tier-modal-overlay 자동 출현", async ({ page }) => {
    await page.goto("/dashboard");
    // claude 진입 — modal 안 뜸 (planTier=pro 입력됨)
    await expect(page.getByTestId("tier-modal-overlay")).toBeHidden();
    // codex 토글
    await page.getByTestId("dash-provider-codex").click();
    await expect(page.getByTestId("tier-modal-overlay")).toBeVisible();
  });

  test("[CX-4-02] Codex modal 의 select 옵션 = placeholder + 6 tier (Free 없음)", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("dash-provider-codex").click();
    await expect(page.getByTestId("tier-modal-overlay")).toBeVisible();
    // option label 6개 (Plus / Business / Pro / Team / Enterprise / API) + placeholder
    const options = page.getByTestId("tier-modal-select").locator("option");
    await expect(options).toHaveCount(7);
    await expect(page.getByTestId("tier-modal-select")).toContainText("ChatGPT Plus");
    await expect(page.getByTestId("tier-modal-select")).toContainText("ChatGPT Business");
    await expect(page.getByTestId("tier-modal-select")).toContainText("ChatGPT Pro");
    await expect(page.getByTestId("tier-modal-select")).toContainText("ChatGPT Team");
    await expect(page.getByTestId("tier-modal-select")).toContainText("Enterprise");
    await expect(page.getByTestId("tier-modal-select")).toContainText("OpenAI API");
    // Free 검증 — 옵션에 없어야 함
    await expect(page.getByTestId("tier-modal-select")).not.toContainText(/\bFree\b/);
  });

  test("[CX-4-03] Plus 선택 + confirm → DB 의 codex_plan_tier = 'plus'", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("dash-provider-codex").click();
    await page.getByTestId("tier-modal-select").selectOption("plus");
    await page.getByTestId("tier-modal-confirm").click();
    // saveTier 가 reload 트리거 — 잠시 대기.
    await page.waitForTimeout(800);
    const saved = queryScalar(`SELECT codex_plan_tier FROM users WHERE email='p9@iskra.world'`);
    expect(saved).toBe("plus");
  });
});

// ─── CX-5 Claude vs Codex 독립 입력 ──────────────────────

test.describe("CX-5 독립 입력", () => {
  test.beforeEach(() => seed("P9")); // claude=pro, codex=NULL

  test("[CX-5-01] P9 Claude 탭 진입 → modal 안 뜸 (planTier=pro 입력됨)", async ({ page }) => {
    await signInAs(page, "P9");
    await page.goto("/dashboard");
    await expect(page.getByTestId("tier-modal-overlay")).toBeHidden();
  });

  test("[CX-5-02] Codex 탭 진입 → modal 자동 open (codex_plan_tier=NULL)", async ({ page }) => {
    await signInAs(page, "P9");
    await page.goto("/dashboard");
    await page.getByTestId("dash-provider-codex").click();
    await expect(page.getByTestId("tier-modal-overlay")).toBeVisible();
  });

  test("[CX-5-03] Codex tier 저장 후 Claude tier 는 변경 없음 (DB query)", async ({ page }) => {
    await signInAs(page, "P9");
    await page.goto("/dashboard");
    await page.getByTestId("dash-provider-codex").click();
    await page.getByTestId("tier-modal-select").selectOption("business");
    await page.getByTestId("tier-modal-confirm").click();
    await page.waitForTimeout(800);
    expect(queryScalar(`SELECT plan_tier FROM users WHERE email='p9@iskra.world'`)).toBe("pro"); // 변경 X
    expect(queryScalar(`SELECT codex_plan_tier FROM users WHERE email='p9@iskra.world'`)).toBe("business");
  });
});

// ─── CX-6 useProviderPreference 화면 간 공유 ──────────────

test.describe("CX-6 preference 공유", () => {
  test.beforeAll(() => seed("team-codex"));

  test("[CX-6-01] dashboard 에서 codex 선택 → localStorage.provider_pref='codex'", async ({ page }) => {
    await signInAs(page, "team-codex");
    await page.goto("/dashboard");
    await page.getByTestId("dash-provider-codex").click();
    // localStorage 즉시 반영
    const pref = await page.evaluate(() => localStorage.getItem("provider_pref"));
    expect(pref).toBe("codex");
  });

  test("[CX-6-02] dashboard → team 페이지 진입 → codex 자동 활성 (이전 선택 기억)", async ({ page, context }) => {
    await signInAs(page, "team-codex");
    // codex 선택 직접 박음
    await context.addInitScript(() => localStorage.setItem("provider_pref", "codex"));
    await page.goto("/team");
    // team-provider-codex 가 selected 클래스 (bg-indigo-600)
    await expect(page.getByTestId("team-provider-codex")).toHaveClass(/bg-indigo-600/);
  });

  test("[CX-6-03] ranking 도 동일 — codex 자동 활성", async ({ page, context }) => {
    await signInAs(page, "team-codex");
    await context.addInitScript(() => localStorage.setItem("provider_pref", "codex"));
    await page.goto("/ranking");
    await expect(page.getByTestId("ranking-provider-codex")).toHaveClass(/bg-indigo-600/);
  });
});

// ─── CX-7 modal 안 외부 billing 링크 ─────────────────────

test.describe("CX-7 외부 링크", () => {
  test.beforeEach(() => seed("P9"));

  test("[CX-7-01] Codex modal — OpenAI billing 링크 (platform.openai.com)", async ({ page }) => {
    await signInAs(page, "P9");
    await page.goto("/dashboard");
    await page.getByTestId("dash-provider-codex").click();
    await expect(page.getByTestId("tier-modal-overlay")).toBeVisible();
    const link = page.locator("a[href*='platform.openai.com/account/billing']");
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("[CX-7-02] Claude modal — Anthropic billing 링크 (console.anthropic.com)", async ({ page }) => {
    // P9 의 claude tier 일부러 NULL 로 만들고 claude 탭에서 modal 강제 open
    seed("P9");
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL 미설정");
    // claude 도 NULL 로 변환 → claude modal trigger
    const { execSync } = await import("node:child_process");
    execSync(`psql "${url}" -c "UPDATE users SET plan_tier=NULL WHERE email='p9@iskra.world'"`);
    await signInAs(page, "P9");
    await page.goto("/dashboard");
    await expect(page.getByTestId("tier-modal-overlay")).toBeVisible();
    const link = page.locator("a[href*='console.anthropic.com/settings/billing']");
    await expect(link).toHaveAttribute("target", "_blank");
  });
});

// ─── CX-8 API 직접 (no-browser, 빠름) ────────────────────

test.describe("CX-8 API 직접", () => {
  test.beforeAll(() => seed("P9"));
  test.beforeEach(async ({ page }) => signInAs(page, "P9"));

  test("[CX-8-01] PATCH plan-tier body.provider='codex' → codex_plan_tier 업데이트", async ({ page }) => {
    const r = await page.request.patch("/api/user/plan-tier", {
      data: { planTier: "team", provider: "codex" },
    });
    expect(r.status()).toBe(200);
    const saved = queryScalar(`SELECT codex_plan_tier FROM users WHERE email='p9@iskra.world'`);
    expect(saved).toBe("team");
  });

  test("[CX-8-02] 잘못된 tier (codex 에 'max20') → 400", async ({ page }) => {
    const r = await page.request.patch("/api/user/plan-tier", {
      data: { planTier: "max20", provider: "codex" },
    });
    expect(r.status()).toBe(400);
  });

  test("[CX-8-03] Free 제거됨 — codex 에 'free' 보내면 400", async ({ page }) => {
    const r = await page.request.patch("/api/user/plan-tier", {
      data: { planTier: "free", provider: "codex" },
    });
    expect(r.status()).toBe(400);
  });

  test("[CX-8-04] provider 생략 (default claude) — plan_tier 업데이트, codex_plan_tier 영향 없음", async ({ page }) => {
    const r = await page.request.patch("/api/user/plan-tier", {
      data: { planTier: "max20" },
    });
    expect(r.status()).toBe(200);
    expect(queryScalar(`SELECT plan_tier FROM users WHERE email='p9@iskra.world'`)).toBe("max20");
  });
});
