import { describe, expect, it } from 'vitest';
import { TierService } from '../../src/application/tierService';

describe('TierService', () => {
  it('enables paid capabilities only for paid users', () => {
    const free = new TierService('free');
    const paid = new TierService('paid');

    expect(free.canAutoSubmit()).toBe(false);
    expect(paid.canAutoSubmit()).toBe(true);
    expect(free.canAccess28Days()).toBe(true);
  });
});
