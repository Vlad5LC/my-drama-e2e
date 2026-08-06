import { Page, expect } from '@playwright/test';
import { BasePage, Scope } from '../base.page';
import { TestIds, byTestId } from '../../config/test-ids';

/**
 * Paywall shown when a locked episode is opened. The DOM duplicates several
 * nodes here (desktop/mobile breakpoint variants, and a second full "choose
 * your plan" block further down the page) — every locator below is either
 * filtered to `visible: true` or scoped as a descendant of an already
 * disambiguated container, to consistently resolve to the one block a mobile
 * user actually sees without scrolling.
 *
 * SAFETY: tests only assert paywall visibility/content. Nothing here ever
 * clicks "Get Full Access" or enters payment details.
 */
export class PaywallModal extends BasePage {
  readonly modalContainer;
  readonly paywallContainer;
  readonly discountTimer;
  readonly plansSection;
  readonly plansTitle;
  readonly planCards;
  readonly termsCheckbox;
  readonly getFullAccessButton;

  constructor(page: Page, scope: Scope) {
    super(page, scope);
    // modal-container is a zero-size portal wrapper — only asserted as attached, not visible;
    // paywall-long-dark is the node with real layout.
    this.modalContainer = this.scope.getByTestId(TestIds.modalContainer).first();
    this.paywallContainer = this.scope.getByTestId(TestIds.paywallContainer).filter({ visible: true }).first();
    this.discountTimer = this.scope.getByTestId(TestIds.paywallTimer).filter({ visible: true }).first();
    this.plansSection = this.scope.getByTestId(TestIds.paywallPlansSection).filter({ visible: true }).first();
    this.plansTitle = this.scope.getByTestId(TestIds.paywallPlansTitle).filter({ visible: true }).first();
    // The page repeats the "choose your plan" block further down (both copies pass
    // visible:true) — scoping to plansSection's descendants keeps only the first block.
    this.planCards = this.plansSection.getByTestId(TestIds.paywallPlanCard);
    this.termsCheckbox = this.scope.getByTestId(TestIds.paywallTermsCheckbox).filter({ visible: true }).first();
    this.getFullAccessButton = this.scope.getByTestId(TestIds.premiumModalButton).filter({ visible: true }).first();
  }

  async checkIsVisible() {
    await expect(this.modalContainer, 'Paywall modal container is not attached').toBeAttached();
    await this.checkVisible(this.paywallContainer, 'Paywall content is not visible');
    await this.checkVisible(this.plansSection, 'Paywall plans section is not visible');
  }

  /**
   * Negative check for free episodes — confirms a paywall wasn't shown when it shouldn't be.
   * toBeHidden() alone passes the instant it's checked — a paywall that appears with a short
   * delay (a real bug) might just not be visible *yet*, letting this pass a broken page. Give
   * it a beat to show up before asserting it never did.
   */
  async checkIsNotVisible() {
    await this.page.waitForTimeout(2_000);
    await this.checkHidden(this.paywallContainer, 'Paywall is visible for content that should be free');
  }

  async checkDiscountTimerIsVisible() {
    await this.checkVisible(this.discountTimer, 'Paywall discount timer is not visible');
    await expect(this.discountTimer, 'Discount timer does not show a mm:ss countdown').toContainText(/\d{1,2}:\d{2}/);
  }

  async checkPlansAreListed(expectedCount = 3) {
    await expect(this.planCards, `Expected ${expectedCount} subscription plans`).toHaveCount(expectedCount);
  }

  async checkEachPlanHasPrice() {
    const count = await this.planCards.count();
    for (let i = 0; i < count; i += 1) {
      // Requires a real decimal amount (e.g. "55.00"/"55,00"), not just any lone digit —
      // a plan card showing a bare "3" (e.g. from "3 plans") would wrongly pass a plain
      // `\d+` check. Currency symbol isn't asserted since it varies by geo/A-B test — see
      // docs/exploration-notes.md, "Paywall modal".
      await expect(this.planCards.nth(i), `Plan card #${i} has no visible price`).toContainText(/\d+[.,]\d{2}\b/);
    }
  }

  planCardByIndex(index: number) {
    return this.plansSection.locator(byTestId(TestIds.paywallPlanCard, `[data-plan-index="${index}"]`));
  }

  /** null means no plan is currently selected — distinct from a valid index, so callers must handle it explicitly. */
  async getSelectedPlanIndex(): Promise<number | null> {
    const count = await this.planCards.count();
    for (let i = 0; i < count; i += 1) {
      if ((await this.planCards.nth(i).getAttribute('data-plan-selected')) === 'true') {
        return Number(await this.planCards.nth(i).getAttribute('data-plan-index'));
      }
    }
    return null;
  }

  async selectPlan(index: number) {
    await this.planCardByIndex(index).click();
  }

  async checkPlanIsSelected(index: number) {
    await expect(this.planCardByIndex(index), `Plan #${index} is not selected`).toHaveAttribute(
      'data-plan-selected',
      'true',
    );
  }

  async checkTermsCheckboxIsVisible() {
    await this.checkVisible(this.termsCheckbox, 'Terms and conditions checkbox is not visible');
  }

  async checkGetFullAccessButtonIsVisible() {
    await this.checkVisible(this.getFullAccessButton, '"Get Full Access" button is not visible');
    await expect(this.getFullAccessButton, '"Get Full Access" button is disabled').toBeEnabled();
  }
}
