import { AutomationError } from '../shared/errors';
import type { Journey, Logger } from '../shared/types';

export class TfLAutomation {
  constructor(
    private readonly doc: Document,
    private readonly logger: Logger
  ) {}

  async navigateToServiceDelayRefund(): Promise<void> {
    const refundsLink = this.doc.querySelector('a[href*="service-delay-refunds"]') as HTMLAnchorElement | null;
    if (!refundsLink) throw new AutomationError('Service delay refund link not found');
    refundsLink.click();
    this.logger.info('Navigated to service delay refund page');
  }

  async autofillJourney(_journey: Journey): Promise<void> {
    this.logger.info('Autofilling journey claim form');
    // Real selectors are intentionally encapsulated here.
  }

  async submit(): Promise<void> {
    const submitButton = this.doc.querySelector('button[type="submit"], input[type="submit"]') as HTMLElement | null;
    if (!submitButton) throw new AutomationError('Submit button not found');
    submitButton.click();
    this.logger.info('Submitted claim');
  }
}
