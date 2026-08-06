import { Page, Locator, expect } from '@playwright/test';

/**
 * The subset of Page/FrameLocator that locator-building code needs.
 * Page and FrameLocator implement this identically, so a page object can
 * be pointed at either the real page or a nested frame without knowing which.
 */
export type Scope = Pick<Page, 'locator' | 'getByTestId' | 'getByText' | 'getByRole' | 'getByPlaceholder'>;

export abstract class BasePage {
  readonly page: Page;
  /** Mutable so VideoPage can repoint it once it knows whether content is in an iframe. */
  protected scope: Scope;

  protected constructor(page: Page, scope?: Scope) {
    this.page = page;
    this.scope = scope ?? page;
  }

  async open(path = '/') {
    await this.page.goto(path);
  }

  async verifyUrlContains(pattern: RegExp, msg = 'wrong url', timeout = 15_000) {
    await expect(this.page, msg).toHaveURL(pattern, { timeout });
  }

  protected async checkVisible(locator: Locator, msg: string, timeout?: number) {
    await expect(locator, msg).toBeVisible(timeout ? { timeout } : undefined);
  }

  protected async checkHidden(locator: Locator, msg: string, timeout?: number) {
    await expect(locator, msg).toBeHidden(timeout ? { timeout } : undefined);
  }
}
