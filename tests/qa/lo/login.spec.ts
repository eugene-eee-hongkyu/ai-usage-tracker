/**
 * [LO] 로그인 — 17 TC (자동 15 / 수동 2)
 * 입력: docs/qa/QA_LO_login.md
 */
import { test, expect } from "@playwright/test";
import { seed, signInAs, clearSession } from "../_shared/auth-helper";

test.describe.configure({ mode: "serial" });

// ─── LO-0 권한 ──────────────────────────────────────────────

test.describe("LO-0 권한", () => {
  test.beforeAll(() => seed("P1"));
  test.beforeEach(async ({ page }) => clearSession(page));

  // 클라이언트 측 router.push("/login") — callbackUrl 안 붙음 (코드 동작).
  // server-side redirect 인 /api/cli-auth 만 callbackUrl 검증 가능.

  test("[LO-0-01] 비로그인 /dashboard → /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("[LO-0-02] 비로그인 /team → /login", async ({ page }) => {
    await page.goto("/team");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("[LO-0-03] 비로그인 /setup-status → /login", async ({ page }) => {
    await page.goto("/setup-status");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("[LO-0-04] 비로그인 /api/cli-auth → /login?callbackUrl=...", async ({ page }) => {
    // server-side NextResponse.redirect — callbackUrl 포함
    await page.goto("/api/cli-auth");
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  });

  test("[LO-0-05] 비로그인 /member → /login", async ({ page }) => {
    await page.goto("/member");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});

// ─── LO-1 /login 화면 ──────────────────────────────────────

test.describe("LO-1 /login 화면", () => {
  test.beforeEach(async ({ page }) => clearSession(page));

  test("[LO-1-01] GitHub 버튼 visible + 텍스트", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("login-btn-github")).toBeVisible();
    await expect(page.getByTestId("login-btn-github")).toContainText("GitHub로 시작하기");
  });

  test("[LO-1-02] Google 버튼 visible + 텍스트", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("login-btn-google")).toBeVisible();
    await expect(page.getByTestId("login-btn-google")).toContainText("Google로 시작하기");
  });

  test("[LO-1-03] query string 없음 → 에러 박스 미렌더", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("login-error-domain")).toHaveCount(0);
    await expect(page.getByTestId("login-error-other")).toHaveCount(0);
  });

  test("[LO-1-04] ?error=domain → 도메인 에러 박스 + 정확 텍스트", async ({ page }) => {
    await page.goto("/login?error=domain");
    await expect(page.getByTestId("login-error-domain")).toBeVisible();
    await expect(page.getByTestId("login-error-domain")).toHaveText("허용되지 않은 이메일 도메인입니다.");
  });

  test("[LO-1-05] ?error=db → 기타 에러 박스 + 정확 텍스트", async ({ page }) => {
    await page.goto("/login?error=db");
    await expect(page.getByTestId("login-error-other")).toBeVisible();
    await expect(page.getByTestId("login-error-other")).toHaveText("로그인 중 오류가 발생했습니다.");
  });

  test("[LO-1-06] ?error=other → 기타 에러 박스 (default 분기)", async ({ page }) => {
    await page.goto("/login?error=anything-else");
    await expect(page.getByTestId("login-error-other")).toBeVisible();
  });
});

// ─── LO-1 OAuth — 진짜 OAuth [M] / mock 우회 ──────────────

test.describe("LO-1 OAuth mock 우회", () => {
  test.beforeAll(() => seed("P2"));

  test("[LO-1-07][M] 진짜 GitHub OAuth", async () => {
    test.skip(true, "C-1 §3 #1 첫 행 — 진짜 GitHub OAuth captcha/2FA Playwright 차단. LO-1-09 mock 으로 대체 검증");
  });

  test("[LO-1-08][M] 진짜 Google OAuth", async () => {
    test.skip(true, "C-1 §3 #1 동일 — Google OAuth 팝업 자동화 차단. mock 우회로 대체");
  });

  test("[LO-1-09] mock 도메인 통과 → 세션 발급", async ({ page }) => {
    await page.context().clearCookies();
    await signInAs(page, "P2");
    // signInAs 내부에서 status 검증 — fail 시 throw. 도달 = 통과
    // 추가로 인증 필요한 endpoint 200 검증
    const res = await page.request.get("/api/dashboard?period=all");
    expect(res.status()).toBe(200);
  });

  test("[LO-1-10] mock 도메인 미일치 → ?error=domain 리다이렉트", async ({ page }) => {
    await page.context().clearCookies();
    const csrfRes = await page.request.get("/api/auth/csrf");
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
    const cbRes = await page.request.post("/api/auth/callback/credentials", {
      form: { email: "evil@gmail.com", csrfToken, callbackUrl: "/dashboard", json: "true" },
    });
    // NextAuth Credentials 응답: domain mismatch 시 redirect 또는 url 에 error=domain
    const body = await cbRes.json().catch(() => ({}));
    const url = (body as { url?: string }).url ?? "";
    expect(url).toMatch(/error=domain/);
  });

  test("[LO-1-11] auth.ts DB insert 실패 → ?error=db (route stub 으로 대체)", async ({ page }) => {
    // 진짜 DB 차단은 다른 spec 영향이라 격리 어려움.
    // 대신 page.goto('/login?error=db') 로 LO-1-05 와 동일한 UI 검증 — DB 차단 후의
    // NextAuth redirect 결과 (login?error=db) 의 화면 동작 확인.
    await page.context().clearCookies();
    await page.goto("/login?error=db");
    await expect(page.getByTestId("login-error-other")).toBeVisible();
    await expect(page.getByTestId("login-error-other")).toHaveText("로그인 중 오류가 발생했습니다.");
  });

  test("[LO-1-12] 이미 로그인 + /login 자체 접근 가능", async ({ page }) => {
    await signInAs(page, "P2");
    await page.goto("/login");
    await expect(page.getByTestId("login-btn-github")).toBeVisible();
    // 자동 redirect 없음 — /login URL 유지
    expect(page.url()).toMatch(/\/login/);
  });
});

// ─── Nav 검증 ──────────────────────────────────────────────

test.describe("Nav 컴포넌트", () => {
  test.beforeAll(() => seed("P2"));
  test.beforeEach(async ({ page }) => signInAs(page, "P2"));

  test("[LO-1-13] non-admin Nav 탭 3종 visible (개인/팀/셋업)", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("nav-tab-dashboard")).toBeVisible();
    await expect(page.getByTestId("nav-tab-team")).toBeVisible();
    await expect(page.getByTestId("nav-tab-setup-status")).toBeVisible();
    // non-admin → 팀원 탭 없음
    await expect(page.getByTestId("nav-tab-member")).toHaveCount(0);
  });

  test("[LO-1-14] nav-user-toggle 클릭 → nav-logout visible", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("nav-user-toggle").click();
    await expect(page.getByTestId("nav-logout")).toBeVisible();
  });
});

test.describe("Nav admin", () => {
  test("[LO-1-15] admin Nav 4탭 (개인/팀/팀원/셋업)", async ({ page }) => {
    seed("P3");
    await signInAs(page, "P3");
    await page.goto("/dashboard");
    await expect(page.getByTestId("nav-tab-dashboard")).toBeVisible();
    await expect(page.getByTestId("nav-tab-team")).toBeVisible();
    await expect(page.getByTestId("nav-tab-member")).toBeVisible();
    await expect(page.getByTestId("nav-tab-setup-status")).toBeVisible();
  });
});
