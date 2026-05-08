/**
 * ⚠️ 이 파일은 e2e-framework v3.2 에서 관리됩니다.
 * consumer repo로 카피된 후엔 직접 수정하지 마세요.
 * 변경 필요 시: e2e-framework repo에 PR → consumer 재카피.
 */

// tests/qa/_shared/helpers.ts
// 모든 QA spec이 공유하는 글로벌 헬퍼.
// 모듈별 헬퍼(navigateToSubscription 등)는 각 spec 파일 또는 모듈별 helper에 둔다.
//
// phase2-code-generation.md §Phase 2.0 PoC 단계에서 패턴 확정 후
// 모든 spec이 이 파일을 import하도록 강제한다.
//
// import { isVisibleSoft, safeClick, safeFill, is404 } from '../_shared/helpers';

import type { Page, Locator } from '@playwright/test';

/**
 * 페이지에 element가 있는지 부드럽게 확인 (없으면 false).
 * 가드용 — 다음 동작이 element 존재에 의존할 때 사용.
 */
export async function isVisibleSoft(
  locator: Locator,
  timeout = 2000,
): Promise<boolean> {
  return locator
    .first()
    .isVisible({ timeout })
    .catch(() => false);
}

/**
 * 안전하게 클릭 시도 (실패해도 throw 안 함).
 * 반환값: 클릭 성공 여부.
 */
export async function safeClick(
  locator: Locator,
  timeout = 5000,
): Promise<boolean> {
  try {
    await locator.click({ timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * 안전하게 fill 시도 (실패해도 throw 안 함).
 * 반환값: fill 성공 여부.
 */
export async function safeFill(
  locator: Locator,
  value: string,
  timeout = 5000,
): Promise<boolean> {
  try {
    await locator.fill(value, { timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * 404 페이지 도달 여부.
 */
export async function is404(page: Page): Promise<boolean> {
  return page
    .getByText('페이지를 찾을 수 없습니다')
    .first()
    .isVisible({ timeout: 1500 })
    .catch(() => false);
}

/**
 * SPA Navigation 패턴 — automation-patterns.md §0
 * 직접 URL 진입 대신 홈 → GNB 클릭 패턴 사용.
 *
 * 일부 GNB는 normal click이 동작하지 않으므로 dispatchEvent('click') 사용.
 * 페이지 로드는 catch로 감싸 staging 응답 지연 시에도 spec이 hang되지 않게 함.
 */
export async function navigateViaGnb(
  page: Page,
  gnbLabel: string | RegExp,
  options: { loadTimeout?: number; visibilityTimeout?: number } = {},
): Promise<boolean> {
  const { loadTimeout = 20000, visibilityTimeout = 5000 } = options;
  await page.goto('/');
  const menu =
    typeof gnbLabel === 'string'
      ? page.getByText(gnbLabel).first()
      : page.getByText(gnbLabel).first();
  if (!(await isVisibleSoft(menu, visibilityTimeout))) return false;
  await menu.dispatchEvent('click');
  await page.waitForLoadState('load', { timeout: loadTimeout }).catch(() => {});
  return true;
}
