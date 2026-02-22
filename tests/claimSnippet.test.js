import test from 'node:test';
import assert from 'node:assert/strict';

import { buildClaimSnippet, buildBatchSnippet } from '../src/utils/claimSnippet.js';

test('buildClaimSnippet includes key journey details and confidence', () => {
  const snippet = buildClaimSnippet({
    journeyDate: '2026-02-10',
    from: 'Oxford Circus',
    to: 'Stratford',
    delayMinutes: 21,
    ticketType: 'Contactless',
    delaySource: 'inferred',
    zonesCrossed: 2
  });

  assert.match(snippet, /Journey Date: 2026-02-10/);
  assert.match(snippet, /Estimated Refund: £3.15/);
  assert.match(snippet, /Confidence: Medium/);
});

test('buildBatchSnippet enumerates multiple claims', () => {
  const batch = buildBatchSnippet([
    { journeyDate: '2026-02-10', from: 'A', to: 'B', delayMinutes: 10, ticketType: 'Oyster' },
    { journeyDate: '2026-02-11', from: 'C', to: 'D', delayMinutes: 20, ticketType: 'Oyster' }
  ]);

  assert.match(batch, /^Claim 1/m);
  assert.match(batch, /^Claim 2/m);
});
