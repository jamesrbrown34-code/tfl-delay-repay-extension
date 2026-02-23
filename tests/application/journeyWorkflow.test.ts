import { describe, expect, it } from 'vitest';
import { createJourney } from '../../src/domain/journey';
import { buildClaimSummary, filterJourneysByTier, shouldAutoFill } from '../../src/application/journeyWorkflow';
import { TierService } from '../../src/application/tierService';

describe('journeyWorkflow', () => {
  const now = new Date('2025-02-08T12:00:00Z');

  it('filters to last 7 days for free tier', () => {
    const journeys = [
      createJourney({ journeyDate: '2025-02-07', from: 'A', to: 'B', delayMinutes: 20 }),
      createJourney({ journeyDate: '2025-01-30', from: 'A', to: 'C', delayMinutes: 25 })
    ];

    const result = filterJourneysByTier(journeys, new TierService('free'), now);
    expect(result).toHaveLength(1);
    expect(result[0].journeyDate).toBe('2025-02-07');
  });

  it('keeps full history for paid tier', () => {
    const journeys = [
      createJourney({ journeyDate: '2025-02-07', from: 'A', to: 'B', delayMinutes: 20 }),
      createJourney({ journeyDate: '2025-01-30', from: 'A', to: 'C', delayMinutes: 25 })
    ];

    const result = filterJourneysByTier(journeys, new TierService('paid'), now);
    expect(result).toHaveLength(2);
  });

  it('gates auto-fill to paid only', () => {
    expect(shouldAutoFill(new TierService('free'))).toBe(false);
    expect(shouldAutoFill(new TierService('paid'))).toBe(true);
  });

  it('builds summary for popup/panel', () => {
    const journeys = [
      createJourney({ journeyDate: '2025-02-07', from: 'A', to: 'B', delayMinutes: 20 }),
      createJourney({ journeyDate: '2025-02-06', from: 'A', to: 'C', delayMinutes: 25 })
    ];

    expect(buildClaimSummary(journeys, 12.5, 'in_progress')).toEqual({
      eligibleClaims: 2,
      estimatedTotalRefund: 12.5,
      submissionProgressState: 'in_progress'
    });
  });
});
