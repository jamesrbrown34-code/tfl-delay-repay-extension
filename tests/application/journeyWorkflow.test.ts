import { describe, expect, it } from 'vitest';
import { buildJourneys, buildJourney } from '../helpers/factories';
import { buildClaimSummary, filterJourneysByTier, shouldAutoFill } from '../../src/application/journeyWorkflow';
import { TierService } from '../../src/application/tierService';

describe('journeyWorkflow', () => {
  const now = new Date('2025-02-08T12:00:00Z');

  it('free mode returns only 7-day journeys (mutation resistance for removed filter)', () => {
    const journeys = [
      buildJourney({ journeyDate: '2025-02-07' }),
      buildJourney({ journeyDate: '2025-01-29', from: 'C', to: 'D' })
    ];

    const result = filterJourneysByTier(journeys, new TierService('free'), now);
    expect(result).toHaveLength(1);
    expect(result[0].journeyDate).toBe('2025-02-07');
  });

  it('paid mode keeps full valid history', () => {
    const journeys = [
      buildJourney({ journeyDate: '2025-02-07' }),
      buildJourney({ journeyDate: '2025-01-01', from: 'E', to: 'F' })
    ];

    expect(filterJourneysByTier(journeys, new TierService('paid'), now)).toHaveLength(2);
  });

  it('drops malformed journey dates in free mode instead of crashing', () => {
    const journeys = [buildJourney({ journeyDate: 'not-a-date' }), buildJourney({ journeyDate: '2025-02-08' })];
    const result = filterJourneysByTier(journeys, new TierService('free'), now);

    expect(result).toHaveLength(1);
    expect(result[0].journeyDate).toBe('2025-02-08');
  });

  it('uses midnight-normalized cutoff so same-day timestamps are included', () => {
    const journeys = [
      buildJourney({ journeyDate: '2025-02-01T00:00:00.000Z', from: 'A', to: 'B' }),
      buildJourney({ journeyDate: '2025-01-31T23:59:59.999Z', from: 'C', to: 'D' })
    ];

    const result = filterJourneysByTier(journeys, new TierService('free'), now);
    expect(result.map((journey) => journey.from)).toEqual(['A']);
  });

  it('keeps malformed dates in paid mode because no history filter is applied', () => {
    const journeys = [buildJourney({ journeyDate: 'not-a-date' }), buildJourney({ journeyDate: '2025-02-08' })];
    const result = filterJourneysByTier(journeys, new TierService('paid'), now);

    expect(result).toHaveLength(2);
    expect(result[0].journeyDate).toBe('not-a-date');
  });

  it('gates auto-fill strictly to paid tier', () => {
    expect(shouldAutoFill(new TierService('free'))).toBe(false);
    expect(shouldAutoFill(new TierService('paid'))).toBe(true);
  });

  it('builds deterministic summary payload', () => {
    const journeys = [buildJourney(), buildJourney({ from: 'X', to: 'Y' })];
    expect(buildClaimSummary(journeys, 12.34, 'in_progress')).toEqual({
      eligibleClaims: 2,
      estimatedTotalRefund: 12.34,
      submissionProgressState: 'in_progress'
    });
  });

  it('supports summaries for zero journeys and negative totals (debt/reversal scenarios)', () => {
    expect(buildClaimSummary([], -1.23, 'blocked')).toEqual({
      eligibleClaims: 0,
      estimatedTotalRefund: -1.23,
      submissionProgressState: 'blocked'
    });
  });

  it('handles stress input of 500 journeys without state bleed', () => {
    const journeys = buildJourneys(500, (i) => ({
      journeyDate: i % 2 === 0 ? '2025-02-08' : '2024-12-01'
    }));

    const freeFiltered = filterJourneysByTier(journeys, new TierService('free'), now);
    const paidFiltered = filterJourneysByTier(journeys, new TierService('paid'), now);

    expect(freeFiltered.length).toBe(250);
    expect(paidFiltered.length).toBe(500);
  });

  it('supports rapid tier switching snapshots', () => {
    const journeys = buildJourneys(20, (i) => ({ journeyDate: i < 10 ? '2025-02-08' : '2024-12-01' }));
    const tiers = [new TierService('free'), new TierService('paid'), new TierService('free')];

    const lengths = tiers.map((tier) => filterJourneysByTier(journeys, tier, now).length);
    expect(lengths).toEqual([10, 20, 10]);
  });
});
