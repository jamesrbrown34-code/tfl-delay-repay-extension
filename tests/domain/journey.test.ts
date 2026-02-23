import { describe, expect, it } from 'vitest';
import { createJourney, parseStatementAction } from '../../src/domain/journey';

describe('journey domain', () => {
  it('computes delay from expected and actual minutes', () => {
    const journey = createJourney({
      journeyDate: '2025-01-10',
      from: 'A',
      to: 'B',
      expectedMinutes: 20,
      actualMinutes: 42
    });

    expect(journey.delayMinutes).toBe(22);
  });

  it('parses statement action station pair', () => {
    expect(parseStatementAction('Paddington to Baker Street')).toEqual({ from: 'Paddington', to: 'Baker Street' });
  });
});
