import { describe, expect, it } from 'vitest';
import { createJourney, parseStatementAction } from '../../src/domain/journey';

describe('journey domain', () => {
  it('normalizes negative delay values to zero', () => {
    const journey = createJourney({
      journeyDate: '2025-01-10',
      from: ' A ',
      to: ' B ',
      delayMinutes: -12
    });

    expect(journey.delayMinutes).toBe(0);
    expect(journey.from).toBe('A');
    expect(journey.to).toBe('B');
  });

  it('falls back to minimum delay when timing fields are missing', () => {
    const journey = createJourney({
      journeyDate: 'invalid date payload',
      from: 'X',
      to: 'Y'
    });

    expect(journey.delayMinutes).toBe(15);
    expect(journey.journeyDate).toBe('invalid date payload');
  });

  it('supports future dates and very large delays without overflow', () => {
    const journey = createJourney({
      journeyDate: '2099-12-31',
      from: 'A',
      to: 'B',
      delayMinutes: 60 * 24 * 30
    });

    expect(journey.journeyDate).toBe('2099-12-31');
    expect(journey.delayMinutes).toBe(43200);
  });

  it('preserves unusual values that upstream may provide (negative fares equivalent in zones)', () => {
    const journey = createJourney({
      journeyDate: '2025-01-10',
      from: 'A',
      to: 'B',
      zonesCrossed: -3,
      expectedMinutes: 10,
      actualMinutes: 12
    });

    expect(journey.zonesCrossed).toBe(-3);
    expect(journey.delayMinutes).toBe(2);
  });

  it('creates deterministic IDs; duplicates produce matching IDs for de-dup layers', () => {
    const first = createJourney({ journeyDate: '2025-01-10', from: 'A', to: 'B', delayMinutes: 20 });
    const duplicate = createJourney({ journeyDate: '2025-01-10', from: 'A', to: 'B', delayMinutes: 20 });

    expect(first.id).toBe(duplicate.id);
  });

  it('handles zero-delay edge case when expected equals actual', () => {
    const journey = createJourney({
      journeyDate: '2025-01-10',
      from: 'A',
      to: 'B',
      expectedMinutes: 42,
      actualMinutes: 42
    });

    expect(journey.delayMinutes).toBe(0);
  });

  it('parses statement action station pair robustly and rejects malformed text', () => {
    expect(parseStatementAction('Paddington to Baker Street')).toEqual({ from: 'Paddington', to: 'Baker Street' });
    expect(parseStatementAction('Paddington -> Baker Street')).toBeNull();
    expect(parseStatementAction('')).toBeNull();
  });
});
