import test from 'node:test';
import assert from 'node:assert/strict';

import { estimateRefund, estimateTotalRefund, inferTicketKey } from '../src/utils/fareEstimator.js';

test('inferTicketKey returns expected ticket categories', () => {
  assert.equal(inferTicketKey('Contactless card'), 'contactless');
  assert.equal(inferTicketKey('Paper single ticket'), 'paper');
  assert.equal(inferTicketKey('Unknown ticket'), 'oyster');
});

test('estimateRefund applies ticket multiplier and zone adjustment', () => {
  const refund = estimateRefund({ ticketType: 'Paper ticket', zonesCrossed: 3 });
  assert.equal(refund, 4.06);
});

test('estimateTotalRefund sums and rounds to 2 decimals', () => {
  const total = estimateTotalRefund([
    { ticketType: 'Oyster', zonesCrossed: 1 },
    { ticketType: 'Paper', zonesCrossed: 2 }
  ]);

  assert.equal(total, 6.51);
});
