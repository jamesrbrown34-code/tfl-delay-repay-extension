import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isConcessionFare,
  getEligibleJourneys,
  calculateDelayWithBuffer
} from '../src/core/eligibility.js';
import { isWithinClaimWindow } from '../src/core/dateUtils.js';

test('isConcessionFare detects concession keywords', () => {
  assert.equal(isConcessionFare('Freedom Pass'), true);
  assert.equal(isConcessionFare('Adult PAYG'), false);
});

test('isWithinClaimWindow accepts dates inside 28-day window and rejects older dates', () => {
  const now = new Date('2026-02-23T10:00:00.000Z');

  assert.equal(isWithinClaimWindow('2026-02-23', now), true);
  assert.equal(isWithinClaimWindow('2026-01-26', now), true); // boundary (28 days)
  assert.equal(isWithinClaimWindow('2026-01-25', now), false);
  assert.equal(isWithinClaimWindow('not-a-date', now), false);
});

test('calculateDelayWithBuffer adds 5-minute buffer and caps hours at 3', () => {
  assert.deepEqual(calculateDelayWithBuffer(0), { hours: 0, mins: 5 });
  assert.deepEqual(calculateDelayWithBuffer(20), { hours: 0, mins: 25 });
  assert.deepEqual(calculateDelayWithBuffer(180), { hours: 3, mins: 5 });
  assert.deepEqual(calculateDelayWithBuffer(300), { hours: 3, mins: 5 });
});

test('getEligibleJourneys filters by delay eligibility, claim window and concession fares', () => {
  const fixedClock = {
    now: () => new Date('2026-02-23T00:00:00.000Z')
  };

  const journeys = [
    { journeyDate: '2026-02-20', delayEligible: true, ticketType: 'Adult PAYG' },
    { journeyDate: '2026-01-20', delayEligible: true, ticketType: 'Adult PAYG' },
    { journeyDate: '2026-02-20', delayEligible: true, ticketType: 'Freedom Pass' },
    { journeyDate: '2026-02-20', delayEligible: false, ticketType: 'Adult PAYG' }
  ];

  const eligible = getEligibleJourneys(journeys, { clock: fixedClock });

  assert.equal(eligible.length, 1);
  assert.deepEqual(eligible[0], journeys[0]);
});
