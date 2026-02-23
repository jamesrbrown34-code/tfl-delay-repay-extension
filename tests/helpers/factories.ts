import { createJourney, type RawJourneyInput } from '../../src/domain/journey';
import type { Journey } from '../../src/shared/types';

export function buildJourney(overrides: Partial<RawJourneyInput> = {}): Journey {
  return createJourney({
    journeyDate: '2025-02-01',
    from: 'Paddington',
    to: 'Baker Street',
    expectedMinutes: 15,
    actualMinutes: 35,
    ticketType: 'PAYG',
    zonesCrossed: 1,
    ...overrides
  });
}

export function buildJourneys(count: number, factory?: (index: number) => Partial<RawJourneyInput>): Journey[] {
  return Array.from({ length: count }, (_, index) =>
    buildJourney({
      journeyDate: `2025-02-${String((index % 27) + 1).padStart(2, '0')}`,
      from: `Station-${index}`,
      to: `Station-${index + 1}`,
      ...(factory ? factory(index) : {})
    })
  );
}
