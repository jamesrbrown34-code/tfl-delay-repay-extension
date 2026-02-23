import { ClaimQueue } from '../application/claimQueue';
import { TierService } from '../application/tierService';
import { filterEligibleJourneys } from '../domain/eligibility';
import { TfLAutomation } from '../infrastructure/tflAutomation';
import { TfLScraper } from '../infrastructure/tflScraper';
import { ExtensionLogger } from '../infrastructure/logger';
import type { BackendClient, Settings } from '../shared/types';

const logger = new ExtensionLogger('content-script');
const scraper = new TfLScraper();

const noopBackend: BackendClient = {
  async enqueueClaim() {},
  async updateClaimStatus() {}
};

async function getSettings(): Promise<Settings> {
  const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  return response?.settings ?? { tier: 'free', autoDetectOnLoad: false, testMode: false, testModeRealJourneys: false };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'ANALYSE_JOURNEYS') {
    const journeys = scraper.parseJourneyRows(document);
    const eligible = filterEligibleJourneys(journeys);
    sendResponse({ ok: true, parsedJourneys: journeys, eligibleJourneys: eligible });
    return true;
  }

  if (message?.type === 'START_SERVICE_DELAY_WORKFLOW') {
    getSettings().then(async (settings) => {
      const tierService = TierService.fromSettings(settings);
      const queue = new ClaimQueue(noopBackend, logger);
      const journeys = (message.journeys ?? []).filter((item: unknown): item is any => Boolean(item));

      if (tierService.canAutoFill()) {
        queue.enqueueJourneys(journeys);
      }

      const automation = new TfLAutomation(document, logger);
      await automation.navigateToServiceDelayRefund();
      sendResponse({ ok: true, queued: queue.size(), requiresManualClick: !tierService.canAutoFill() });
    });
    return true;
  }

  return undefined;
});
