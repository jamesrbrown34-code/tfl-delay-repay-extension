import { describe, expect, it } from 'vitest';
import { CLAIM_WINDOW_DAYS, MIN_DELAY_MINUTES } from '../../src/shared/constants';
import { evaluateEligibility, filterEligibleJourneys, isConcessionFare, isWithinClaimWindow } from '../../src/domain/eligibility';
import { buildJourney } from '../helpers/factories';

describe('eligibility', () => {
  const now = new Date('2025-02-15T09:00:00.000Z');

  it('accepts a journey at exact minimum delay threshold', () => {
    const journey = buildJourney({ journeyDate: '2025-02-10', delayMinutes: MIN_DELAY_MINUTES, ticketType: 'PAYG' });
    const result = evaluateEligibility(journey, now);

    expect(result).toEqual({ eligible: true, reasons: [] });
  });

  it('rejects just-below-threshold delays', () => {
    const result = evaluateEligibility(buildJourney({ journeyDate: '2025-02-10', delayMinutes: MIN_DELAY_MINUTES - 1 }), now);

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('Delay under minimum threshold');
  });

  it('accepts just-above-threshold delays', () => {
    const result = evaluateEligibility(buildJourney({ journeyDate: '2025-02-10', delayMinutes: MIN_DELAY_MINUTES + 1 }), now);

    expect(result.eligible).toBe(true);
  });

  it('rejects invalid dates and records reason', () => {
    const result = evaluateEligibility(buildJourney({ journeyDate: 'not-a-date', delayMinutes: 30 }), now);

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('Outside claim window');
  });

  it('rejects concession fares across keyword variants', () => {
    expect(isConcessionFare('Freedom Pass')).toBe(true);
    expect(isConcessionFare('60+ Oyster card')).toBe(true);
    expect(isConcessionFare('PAYG')).toBe(false);
  });

  it('enforces claim-window boundary inclusively at cutoff day', () => {
    const boundaryDate = new Date(now);
    boundaryDate.setDate(boundaryDate.getDate() - CLAIM_WINDOW_DAYS);

    expect(isWithinClaimWindow(boundaryDate.toISOString(), now)).toBe(true);
    boundaryDate.setDate(boundaryDate.getDate() - 1);
    expect(isWithinClaimWindow(boundaryDate.toISOString(), now)).toBe(false);
  });

  it('filters large lists without leaking ineligible items', () => {
    const journeys = [
      buildJourney({ journeyDate: '2025-02-12', delayMinutes: 20, ticketType: 'PAYG' }),
      buildJourney({ journeyDate: '2024-12-01', delayMinutes: 30, ticketType: 'PAYG' }),
      buildJourney({ journeyDate: '2025-02-12', delayMinutes: 10, ticketType: 'PAYG' }),
      buildJourney({ journeyDate: '2025-02-12', delayMinutes: 20, ticketType: 'Freedom pass' })
    ];

    const filtered = filterEligibleJourneys(journeys, now);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].ticketType).toBe('PAYG');
    expect(filtered[0].delayMinutes).toBe(20);
  });



  it('returns an empty list when filtering an empty journey set', () => {
    expect(filterEligibleJourneys([], now)).toEqual([]);
  });

  it('handles malformed delay values (NaN) as ineligible', () => {
    const malformed = buildJourney({ delayMinutes: Number.NaN as unknown as number, journeyDate: '2025-02-12' });
    const decision = evaluateEligibility(malformed, now);

    expect(decision.eligible).toBe(false);
    expect(decision.reasons).toContain('Delay under minimum threshold');
  });
});
