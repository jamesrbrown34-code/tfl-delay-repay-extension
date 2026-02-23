import { describe, expect, it, vi } from 'vitest';
import { PopupController, type EligibleJourneyStore } from '../../src/ui/popupController';
import { TfLScraper } from '../../src/infrastructure/tflScraper';
import { buildJourney } from '../helpers/factories';
import type { Journey, Settings } from '../../src/shared/types';

function createDoc(): Document {
  document.body.innerHTML = '<div id="summaryBox"></div>';
  return document;
}


function isoDateDaysAgo(days: number): string {
  const now = new Date();
  now.setDate(now.getDate() - days);
  return now.toISOString().slice(0, 10);
}

function createSettings(tier: 'free' | 'paid'): Settings {
  return {
    tier,
    autoDetectOnLoad: false,
    testMode: false,
    testModeRealJourneys: false
  };
}

describe('PopupController', () => {
  it('filters ineligible journeys during analysis', () => {
    const parseSpy = vi.spyOn(TfLScraper.prototype, 'parseJourneyRows').mockReturnValue([
      buildJourney({ delayMinutes: 20, journeyDate: isoDateDaysAgo(1) }),
      buildJourney({ delayMinutes: 10, from: 'X', to: 'Y', journeyDate: isoDateDaysAgo(1) })
    ]);

    const controller = new PopupController({
      doc: createDoc(),
      settings: createSettings('paid'),
      claimQueue: {} as never
    });

    const result = controller.analyse(document);

    expect(result).toHaveLength(1);
    expect(result[0].delayMinutes).toBe(20);
    parseSpy.mockRestore();
  });

  it('stores eligible journeys for manual upload when user is free tier', async () => {
    const journeys = [buildJourney({ from: 'A', to: 'B' }), buildJourney({ from: 'B', to: 'C' })];
    const save = vi.fn().mockResolvedValue(undefined) as unknown as EligibleJourneyStore['save'];

    const queue = {
      enqueueJourneys: vi.fn(),
      size: vi.fn(() => 0),
      processNext: vi.fn()
    };

    const controller = new PopupController(
      {
        doc: createDoc(),
        settings: createSettings('free'),
        claimQueue: queue as never
      },
      { save }
    );

    await controller.runPaidFlow(journeys);

    expect(save).toHaveBeenCalledWith(journeys);
    expect(queue.enqueueJourneys).not.toHaveBeenCalled();
    const summaryText = document.getElementById('summaryBox')?.textContent || '';
    expect(summaryText).toContain('saved for manual upload');
    expect(summaryText).toContain('(2 journeys)');
  });

  it('processes queue end-to-end for paid tier and does not save manual upload payload', async () => {
    const journeys: Journey[] = [buildJourney({ from: 'A', to: 'B' }), buildJourney({ from: 'C', to: 'D' })];
    const save = vi.fn().mockResolvedValue(undefined) as unknown as EligibleJourneyStore['save'];

    let remaining = 2;
    const queue = {
      enqueueJourneys: vi.fn(),
      size: vi.fn(() => remaining),
      processNext: vi.fn(async () => {
        remaining -= 1;
        return null;
      })
    };

    const controller = new PopupController(
      {
        doc: createDoc(),
        settings: createSettings('paid'),
        claimQueue: queue as never
      },
      { save }
    );

    await controller.runPaidFlow(journeys);

    expect(queue.enqueueJourneys).toHaveBeenCalledWith(journeys);
    expect(queue.processNext).toHaveBeenCalledTimes(2);
    expect(save).not.toHaveBeenCalled();
    expect(document.getElementById('summaryBox')?.textContent).toContain('Processed 2 paid-tier claims.');
  });
});
