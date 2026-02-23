import { ClaimQueue } from '../application/claimQueue';
import { TierService } from '../application/tierService';
import { filterEligibleJourneys } from '../domain/eligibility';
import { TfLScraper } from '../infrastructure/tflScraper';
import { STORAGE_KEYS } from '../shared/constants';
import type { Journey, Settings } from '../shared/types';
import { StatusPanel } from './statusPanel';

interface PopupDeps {
  doc: Document;
  settings: Settings;
  claimQueue: ClaimQueue;
}

interface StoredEligibleJourneysPayload {
  savedAt: string;
  journeys: Journey[];
}

export interface EligibleJourneyStore {
  save(journeys: Journey[]): Promise<void>;
}

class ChromeEligibleJourneyStore implements EligibleJourneyStore {
  async save(journeys: Journey[]): Promise<void> {
    const payload: StoredEligibleJourneysPayload = {
      savedAt: new Date().toISOString(),
      journeys
    };

    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return;
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.eligibleJourneysForManualUpload]: payload });
  }
}

export class PopupController {
  private readonly scraper = new TfLScraper();
  private readonly tierService: TierService;
  private readonly statusPanel: StatusPanel;
  private readonly eligibleJourneyStore: EligibleJourneyStore;

  constructor(private readonly deps: PopupDeps, eligibleJourneyStore: EligibleJourneyStore = new ChromeEligibleJourneyStore()) {
    this.tierService = TierService.fromSettings(deps.settings);
    this.statusPanel = new StatusPanel(this.deps.doc.getElementById('summaryBox') as HTMLElement);
    this.eligibleJourneyStore = eligibleJourneyStore;
  }

  analyse(doc: Document): Journey[] {
    const parsed = this.scraper.parseJourneyRows(doc);
    return filterEligibleJourneys(parsed);
  }

  async runPaidFlow(journeys: Journey[]): Promise<void> {
    if (!this.tierService.canAutoFill()) {
      await this.eligibleJourneyStore.save(journeys);
      this.statusPanel.setStatus(`Free tier: auto-submit unavailable. Eligible journeys saved for manual upload (${journeys.length} journey${journeys.length === 1 ? '' : 's'}).`);
      return;
    }

    this.deps.claimQueue.enqueueJourneys(journeys);
    while (this.deps.claimQueue.size()) {
      await this.deps.claimQueue.processNext();
    }

    this.statusPanel.setStatus(`Processed ${journeys.length} paid-tier claims.`);
  }
}
