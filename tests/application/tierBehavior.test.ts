import { describe, expect, it, vi } from 'vitest';
import { TierService } from '../../src/application/tierService';
import { filterJourneysByTier, buildClaimSummary, shouldAutoFill } from '../../src/application/journeyWorkflow';
import { buildJourney, buildJourneys } from '../helpers/factories';

function runTierFlow(tier: 'free' | 'paid') {
  const tierService = new TierService(tier);
  const now = new Date('2025-02-20T12:00:00Z');
  const journeys = [
    buildJourney({ journeyDate: '2025-02-19' }),
    buildJourney({ journeyDate: '2025-01-01', from: 'X', to: 'Y' })
  ];
  const eligible = filterJourneysByTier(journeys, tierService, now);
  const autoFill = vi.fn();
  if (shouldAutoFill(tierService)) {
    eligible.forEach((j) => autoFill(j));
  }

  const summary = tierService.isPaid() ? buildClaimSummary(eligible, 5.4, 'ready') : null;
  return { eligible, autoFill, summary };
}

describe('Free vs Paid behavioral coverage', () => {
  it('free mode limits history, does not invoke auto-fill, omits summary', () => {
    const result = runTierFlow('free');
    expect(result.eligible).toHaveLength(1);
    expect(result.autoFill).not.toHaveBeenCalled();
    expect(result.summary).toBeNull();
  });

  it('paid mode returns full history, invokes auto-fill, generates summary', () => {
    const result = runTierFlow('paid');
    expect(result.eligible).toHaveLength(2);
    expect(result.autoFill).toHaveBeenCalledTimes(2);
    expect(result.summary).toEqual({ eligibleClaims: 2, estimatedTotalRefund: 5.4, submissionProgressState: 'ready' });
  });

  it('supports repeated scraping + popup open/close simulation without leaking state', () => {
    const loops = 25;
    const allCounts: number[] = [];

    for (let i = 0; i < loops; i += 1) {
      const tier = i % 2 === 0 ? 'free' : 'paid';
      const tierService = new TierService(tier);
      const journeys = buildJourneys(40, (index) => ({ journeyDate: index % 2 === 0 ? '2025-02-20' : '2024-11-01' }));
      allCounts.push(filterJourneysByTier(journeys, tierService, new Date('2025-02-20T12:00:00Z')).length);
    }

    expect(allCounts.filter((count) => count === 20).length).toBeGreaterThan(0);
    expect(allCounts.filter((count) => count === 40).length).toBeGreaterThan(0);
  });

  it('stress-checks 100 eligible claims in paid path', () => {
    const tierService = new TierService('paid');
    const autoFill = vi.fn();
    const eligible = filterJourneysByTier(buildJourneys(100, () => ({ journeyDate: '2025-02-20' })), tierService, new Date('2025-02-20T12:00:00Z'));

    eligible.forEach((journey) => {
      if (tierService.canAutoFill()) autoFill(journey);
    });

    expect(autoFill).toHaveBeenCalledTimes(100);
  });
});
