import { describe, expect, it } from 'vitest';
import { evaluateEligibility } from '../../src/domain/eligibility';
import { createJourney } from '../../src/domain/journey';

describe('eligibility', () => {
  it('marks eligible when all checks pass', () => {
    const journey = createJourney({
      journeyDate: new Date().toISOString(),
      from: 'A',
      to: 'B',
      delayMinutes: 20,
      ticketType: 'PAYG'
    });

    expect(evaluateEligibility(journey).eligible).toBe(true);
  });

  it('rejects concession fares', () => {
    const journey = createJourney({
      journeyDate: new Date().toISOString(),
      from: 'A',
      to: 'B',
      delayMinutes: 20,
      ticketType: 'Freedom Pass'
    });

    const decision = evaluateEligibility(journey);
    expect(decision.eligible).toBe(false);
    expect(decision.reasons).toContain('Concession fare is excluded');
  });
});
