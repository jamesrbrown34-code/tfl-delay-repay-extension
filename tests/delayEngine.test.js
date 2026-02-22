import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getEligibleJourneys,
  getEligibleJourneysIgnoringMinDelay,
  getEligibleJourneysByRule,
  isConcessionFare,
  isWithinClaimWindow,
  normalizeJourney
} from '../src/utils/delayEngine.js';

test('isConcessionFare detects concession tickets case-insensitively', () => {
  assert.equal(isConcessionFare('Freedom Pass Adult'), true);
  assert.equal(isConcessionFare('Standard Oyster'), false);
});

test('isWithinClaimWindow validates 28 day window', () => {
  const now = new Date('2026-02-20T12:00:00Z');
  assert.equal(isWithinClaimWindow('2026-02-01', now), true);
  assert.equal(isWithinClaimWindow('2025-12-31', now), false);
});

test('normalizeJourney derives delay flags and enforces non-negative values', () => {
  const journey = normalizeJourney({
    expectedMinutes: '-2',
    actualMinutes: '10',
    ticketType: 'Oyster',
    journeyDate: '2026-02-10'
  });

  assert.equal(journey.delayMinutes, 10);
  assert.equal(journey.delayEligible, false);
  assert.equal(journey.concessionExcluded, false);
  assert.equal(journey.withinClaimWindow, true);
});

test('getEligibleJourneys applies standard rule set', () => {
  const journeys = [
    { journeyDate: '2026-02-10', expectedMinutes: 20, actualMinutes: 40, ticketType: 'Oyster' },
    { journeyDate: '2026-02-10', expectedMinutes: 20, actualMinutes: 25, ticketType: 'Oyster' },
    { journeyDate: '2026-02-10', expectedMinutes: 20, actualMinutes: 50, ticketType: 'Freedom Pass' }
  ];

  const eligible = getEligibleJourneys(journeys);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].delayMinutes, 20);
});

test('getEligibleJourneysIgnoringMinDelay bypasses delay threshold but not concession filter', () => {
  const journeys = [
    { journeyDate: '2026-02-10', expectedMinutes: 20, actualMinutes: 25, ticketType: 'Oyster' },
    { journeyDate: '2026-02-10', expectedMinutes: 20, actualMinutes: 25, ticketType: 'Child Zip' }
  ];

  const eligible = getEligibleJourneysIgnoringMinDelay(journeys);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].ticketType, 'Oyster');
});

test('getEligibleJourneysByRule throws for unknown rule', () => {
  assert.throws(() => getEligibleJourneysByRule([], 'does-not-exist'), /Unknown eligibility rule/);
});
