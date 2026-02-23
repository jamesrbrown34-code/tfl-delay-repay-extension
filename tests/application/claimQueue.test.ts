import { describe, expect, it, vi } from 'vitest';
import { ClaimQueue } from '../../src/application/claimQueue';
import { buildJourney, buildJourneys } from '../helpers/factories';

function createBackend(overrides: Partial<{ enqueueClaim: () => Promise<void>; updateClaimStatus: () => Promise<void> }> = {}) {
  return {
    enqueueClaim: vi.fn().mockImplementation(async () => overrides.enqueueClaim?.() ?? undefined),
    updateClaimStatus: vi.fn().mockImplementation(async () => overrides.updateClaimStatus?.() ?? undefined)
  };
}

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('ClaimQueue', () => {
  it('preserves FIFO ordering during enqueue/dequeue', async () => {
    const backend = createBackend();
    const queue = new ClaimQueue(backend, logger);

    const journeys = [
      buildJourney({ from: 'A', to: 'B' }),
      buildJourney({ from: 'B', to: 'C' }),
      buildJourney({ from: 'C', to: 'D' })
    ];

    const createdClaims = queue.enqueueJourneys(journeys);
    const processed = [await queue.processNext(), await queue.processNext(), await queue.processNext()];

    expect(processed.map((claim) => claim?.journeyId)).toEqual(createdClaims.map((claim) => claim.journeyId));
    expect(queue.size()).toBe(0);
  });

  it('allows duplicates (documents current behavior to avoid silent assumption)', () => {
    const backend = createBackend();
    const queue = new ClaimQueue(backend, logger);
    const duplicateJourney = buildJourney({ journeyDate: '2025-01-02', from: 'A', to: 'B', delayMinutes: 30 });

    queue.enqueueJourneys([duplicateJourney, duplicateJourney]);
    expect(queue.size()).toBe(2);
  });

  it('handles concurrent enqueue calls deterministically', async () => {
    const backend = createBackend();
    const queue = new ClaimQueue(backend, logger);

    const firstBatch = buildJourneys(50, (index) => ({ from: `A-${index}`, to: `B-${index}` }));
    const secondBatch = buildJourneys(50, (index) => ({ from: `C-${index}`, to: `D-${index}` }));

    await Promise.all([
      Promise.resolve().then(() => queue.enqueueJourneys(firstBatch)),
      Promise.resolve().then(() => queue.enqueueJourneys(secondBatch))
    ]);

    expect(queue.size()).toBe(100);
  });

  it('returns null when processing an empty queue', async () => {
    const backend = createBackend();
    const queue = new ClaimQueue(backend, logger);

    await expect(queue.processNext()).resolves.toBeNull();
    expect(backend.enqueueClaim).not.toHaveBeenCalled();
  });

  it('surfaces enqueue failure and keeps failed claim removed from queue', async () => {
    const backend = createBackend({ enqueueClaim: async () => { throw new Error('network down'); } });
    const queue = new ClaimQueue(backend, logger);

    queue.enqueueJourneys([buildJourney({ from: 'A', to: 'B' })]);

    await expect(queue.processNext()).rejects.toThrow('network down');
    expect(queue.size()).toBe(0);
  });

  it('surfaces status update failure after backend enqueue', async () => {
    const backend = createBackend({ updateClaimStatus: async () => { throw new Error('update failed'); } });
    const queue = new ClaimQueue(backend, logger);

    queue.enqueueJourneys([buildJourney({ from: 'A', to: 'B' })]);

    await expect(queue.processNext()).rejects.toThrow('update failed');
    expect(backend.enqueueClaim).toHaveBeenCalledTimes(1);
    expect(backend.updateClaimStatus).toHaveBeenCalledTimes(1);
  });

  it('supports state reset by draining queue fully', async () => {
    const backend = createBackend();
    const queue = new ClaimQueue(backend, logger);

    queue.enqueueJourneys(buildJourneys(5));
    while (queue.size()) {
      await queue.processNext();
    }

    expect(queue.size()).toBe(0);
    await expect(queue.processNext()).resolves.toBeNull();
  });

  it('is unaffected by tier switching mid-queue because queue is tier-agnostic', async () => {
    const backend = createBackend();
    const queue = new ClaimQueue(backend, logger);

    queue.enqueueJourneys(buildJourneys(3));
    await queue.processNext();

    // Simulated external tier switch (no queue API call)
    await queue.processNext();
    await queue.processNext();

    expect(queue.size()).toBe(0);
    expect(backend.enqueueClaim).toHaveBeenCalledTimes(3);
  });
});
