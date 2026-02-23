import { describe, expect, it, vi } from 'vitest';
import { ClaimQueue } from '../../src/application/claimQueue';
import { createJourney } from '../../src/domain/journey';

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('ClaimQueue', () => {
  it('queues and processes claims', async () => {
    const backend = {
      enqueueClaim: vi.fn().mockResolvedValue(undefined),
      updateClaimStatus: vi.fn().mockResolvedValue(undefined)
    };

    const queue = new ClaimQueue(backend, logger);
    queue.enqueueJourneys([
      createJourney({ journeyDate: '2025-01-10', from: 'A', to: 'B', delayMinutes: 20 })
    ]);

    expect(queue.size()).toBe(1);
    const claim = await queue.processNext();
    expect(claim?.status).toBe('submitted');
    expect(backend.enqueueClaim).toHaveBeenCalledTimes(1);
  });
});
