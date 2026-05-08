/**
 * [TP] 멤버 공개 프로필 — phase 2.0 PoC 모듈
 * 입력: docs/qa/QA_TP_team_profile.md (17 TC)
 * 자동화 분류: docs/qa-output/qa-automation-map.md (17/17 모두 AUTOMATABLE)
 * 페르소나: C-1 §2 P1·P2·P3 (db/seed/P{n}.sql)
 */
import { test, expect } from "@playwright/test";
import { seed, signInAs, clearSession } from "../_shared/auth-helper";

test.describe.configure({ mode: "serial" });

// ─── TP-0 권한 ──────────────────────────────────────────────

test.describe("TP-0 권한", () => {
  test("TP-0-01 비로그인 /team/10 → /login 리다이렉트", async ({ page }) => {
    seed("P2");
    await clearSession(page);
    await page.goto("/team/10");
    await expect(page).toHaveURL(/\/login/);
  });

  test("TP-0-02 [B] 존재하지 않는 userId → 404 응답", async ({ page }) => {
    seed("P2");
    await signInAs(page, "P2");
    const res = await page.request.get("/api/members/99999");
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error", "not found");
  });
});

// ─── TP-1 P2 정상-일반 (id=10) ────────────────────────────

test.describe("TP-1 P2 정상-일반 fixture", () => {
  test.beforeAll(() => seed("P2"));
  test.beforeEach(async ({ page }) => signInAs(page, "P2"));

  test("TP-1-01 summary-cost 텍스트 = $423.78", async ({ page }) => {
    await page.goto("/team/10");
    await expect(page.getByTestId("member-summary-cost")).toContainText("$423.78");
  });

  test("TP-1-02 summary-sessions 텍스트 = 92회", async ({ page }) => {
    await page.goto("/team/10");
    await expect(page.getByTestId("member-summary-sessions")).toContainText("92");
  });

  test("TP-1-03 summary-cache 텍스트 = 91% (정수 반올림)", async ({ page }) => {
    await page.goto("/team/10");
    await expect(page.getByTestId("member-summary-cache")).toContainText("91");
    await expect(page.getByTestId("member-summary-cache")).toContainText("%");
  });

  test("TP-1-04 summary-streak 양수 (30일 daily 전부 cost>0)", async ({ page }) => {
    await page.goto("/team/10");
    const txt = await page.getByTestId("member-summary-streak").textContent();
    const m = txt?.match(/(\d+)/);
    expect(m).not.toBeNull();
    expect(parseInt(m![1], 10)).toBeGreaterThanOrEqual(1);
  });

  test("TP-1-05 4주 heatmap 카드 visible", async ({ page }) => {
    await page.goto("/team/10");
    await expect(page.getByTestId("member-heatmap-4w")).toBeVisible();
    // ActivityCalendar 라이브러리 → 자식 SVG/rect count 검증은 라이브러리 구현 의존이라 visible 만 검증
  });

  test("TP-1-06 projects 행 1~10개 (fixture 3개)", async ({ page }) => {
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

  test("TP-1-14 admin (id=12) 자기 프로필 — non-admin 과 동일 렌더 (#5 admin 분기 없음)", async ({ page }) => {
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
  test("TP-1-13 [B] P1 (rows=0) /api/members/10 → 404", async ({ page }) => {
    seed("P1");
    // P1 은 자체 user 도 없음 → signInAs 가 callback signIn 단계에서 user insert 시도
    // 우리 P1 fixture 는 TRUNCATE 만이라 sign-in 시도 user 신규 insert → 페르소나가 P1 정의에서 벗어남
    // → 별도 user 만 INSERT 후 다른 userId 조회로 404 검증
    await page.request.post("/api/auth/callback/credentials").catch(() => undefined); // best-effort
    // 우회: P2 시드 + 99999 (TP-0-02 와 동일) — 별도 TC 로 의미. 여기선 [B] 명시.
    test.skip(true, "P1 정의가 user row 0 인데 sign-in 자체가 user insert → P1 + 자기 조회 모순. [B] BLOCKED — A-2 §4 #5 의 'rows=0' UX 명시 필요. spec 동작은 TP-0-02 가 대체.");
  });
});

// ─── TP-1 데이터 검증 (heatmap 5단계 색) ──────────────

test.describe("TP-1 heatmap 5단계 색", () => {
  // 라이브러리 (react-activity-calendar) 가 fill 속성을 inline style 로 넣는지, CSS class 로 넣는지에 따라
  // selector 가 달라지므로, fixture cost 만 다르게 시드 + member-heatmap-4w 의 자식 색 검증을
  // 단순화: '카드가 visible + cost>0 일 때 0이 아닌 fill 가진 cell 1개 이상' 으로 한정.
  // 정확한 fill hex 검증은 라이브러리 동작 확인 후 별도 확장.

  test("TP-1-07~11 heatmap 카드 visible — boundary fixture 별도 시드는 phase 2.1 에서 확장 ([B])", async ({ page }) => {
    seed("P2");
    await signInAs(page, "P2");
    await page.goto("/team/10");
    await expect(page.getByTestId("member-heatmap-4w")).toBeVisible();
    // 모든 daily cost=14.5 (level 2) 라 5단계 cell 검증 못 함 — 별도 fixture P2-grade-* 필요
    // [B] 비고: phase 2.1 에서 db/seed/P2-cost-{0,4,24,99,100}.sql 5종 추가 후 spec 분리
  });

  test("TP-1-15 daily=0 30일 → streak=0", async ({ page }) => {
    // P2 fixture 는 cost=14.5 양수. streak=0 검증을 위해 별도 fixture (P2-zero-cost) 필요.
    // 일단 [B]: phase 2.1 fixture 확장 후 진행.
    test.skip(true, "P2 fixture 변형 (cost=0 30일) 필요. phase 2.1 fixture 확장 후 진행.");
  });
});
