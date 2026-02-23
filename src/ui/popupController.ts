import { ClaimQueue } from '../application/claimQueue';
import { TierService } from '../application/tierService';
import { filterEligibleJourneys } from '../domain/eligibility';
import { TfLScraper } from '../infrastructure/tflScraper';
import type { Journey, Settings } from '../shared/types';
import { StatusPanel } from './statusPanel';

interface PopupDeps {
  doc: Document;
  settings: Settings;
  claimQueue: ClaimQueue;
}

export class PopupController {
  private readonly scraper = new TfLScraper();
  private readonly tierService: TierService;
  private readonly statusPanel: StatusPanel;

  constructor(private readonly deps: PopupDeps) {
    this.tierService = TierService.fromSettings(deps.settings);
    this.statusPanel = new StatusPanel(this.deps.doc.getElementById('summaryBox') as HTMLElement);
  }

  analyse(doc: Document): Journey[] {
    const parsed = this.scraper.parseJourneyRows(doc);
    return filterEligibleJourneys(parsed);
  }

  async runPaidFlow(journeys: Journey[]): Promise<void> {
    if (!this.tierService.canAutoFill()) {
      this.statusPanel.setStatus('Free tier: auto-submit unavailable.');
      return;
    }

    this.deps.claimQueue.enqueueJourneys(journeys);
    while (this.deps.claimQueue.size()) {
      await this.deps.claimQueue.processNext();
    }

    this.statusPanel.setStatus(`Processed ${journeys.length} paid-tier claims.`);
  }
}
