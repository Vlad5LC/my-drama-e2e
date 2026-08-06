import { Page } from '@playwright/test';
import { BasePage } from '../base.page';
import { TIMEOUTS } from '../../config/constants';
import { TestIds } from '../../config/test-ids';

/**
 * In this environment, submitting the email form logs the user in directly —
 * there is no separate OTP-entry step to automate (verified manually: a short
 * spinner, then the modal closes and the header switches to the signed-in state).
 */
export class SignInModal extends BasePage {
  readonly emailInput;
  readonly continueWithEmailButton;

  constructor(page: Page) {
    super(page);
    this.emailInput = this.scope.getByTestId(TestIds.loginModalEmailInput);
    this.continueWithEmailButton = this.scope.getByTestId(TestIds.loginModalSubmitButton);
  }

  async checkModalIsOpen() {
    await this.checkVisible(this.emailInput, 'Sign in modal did not open — email input is not visible');
  }

  async enterEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async clickContinueWithEmail() {
    await this.continueWithEmailButton.click();
  }

  async signInWithEmail(email: string) {
    await this.checkModalIsOpen();
    await this.enterEmail(email);
    await this.clickContinueWithEmail();
    await this.checkHidden(
      this.continueWithEmailButton,
      'Sign in did not complete — modal is still open',
      TIMEOUTS.auth,
    );
  }
}
