import { describe, expect, it } from 'vitest';
import { TierService } from '../../src/application/tierService';

describe('TierService', () => {
  it('defaults capabilities to free-friendly values', () => {
    const free = new TierService('free');

    expect(free.getCurrentTier()).toBe('free');
    expect(free.isFree()).toBe(true);
    expect(free.isPaid()).toBe(false);
    expect(free.canAutoSubmit()).toBe(false);
    expect(free.canAutoFill()).toBe(false);
    expect(free.canAccessFullHistory()).toBe(false);
  });

  it('enables paid capabilities only for paid users', () => {
    const paid = new TierService('paid');

    expect(paid.getCurrentTier()).toBe('paid');
    expect(paid.isPaid()).toBe(true);
    expect(paid.canAutoFill()).toBe(true);
    expect(paid.canAccessFullHistory()).toBe(true);
  });
});
