import { describe, expect, it } from 'vitest';
import { TierService } from '../../src/application/tierService';

describe('TierService capability gating', () => {
  it('defaults unknown persisted tier values to free-safe mode', () => {
    const recovered = new TierService('enterprise' as never);

    expect(recovered.isFree()).toBe(true);
    expect(recovered.canAutoFill()).toBe(false);
    expect(recovered.canAccessFullHistory()).toBe(false);
  });

  it('recovers persisted paid state via fromSettings', () => {
    const paid = TierService.fromSettings({
      tier: 'paid',
      autoDetectOnLoad: true,
      testMode: false,
      testModeRealJourneys: false
    });

    expect(paid.isPaid()).toBe(true);
    expect(paid.capabilities()).toEqual({
      canAutoSubmit: false,
      canAutoFill: true,
      canAccess28Days: true,
      canAccessFullHistory: true
    });
  });

  it('maintains free restrictions after repeated tier switches', () => {
    const sequence = ['free', 'paid', 'free', 'paid', 'free'] as const;
    const snapshots = sequence.map((tier) => new TierService(tier).capabilities());

    expect(snapshots[0].canAutoFill).toBe(false);
    expect(snapshots[1].canAutoFill).toBe(true);
    expect(snapshots[2].canAccessFullHistory).toBe(false);
    expect(snapshots[3].canAccessFullHistory).toBe(true);
    expect(snapshots[4].canAutoSubmit).toBe(false);
  });



  it('exercises explicit accessor methods for capability wrappers', () => {
    const free = new TierService('free');
    const paid = new TierService('paid');

    expect(free.getCurrentTier()).toBe('free');
    expect(paid.getCurrentTier()).toBe('paid');
    expect(free.canAutoSubmit()).toBe(false);
    expect(paid.canAutoSubmit()).toBe(false);
    expect(free.canAccess28Days()).toBe(false);
    expect(paid.canAccess28Days()).toBe(true);
  });

  it('is mutation-resistant for inverted capability logic', () => {
    const free = new TierService('free');
    const paid = new TierService('paid');

    expect(free.canAutoFill()).toBe(false);
    expect(paid.canAutoFill()).toBe(true);
    expect(free.canAccessFullHistory()).toBe(false);
    expect(paid.canAccessFullHistory()).toBe(true);
  });

  it('returns a fresh capability snapshot each call to avoid accidental external mutation bleed', () => {
    const paid = new TierService('paid');

    const first = paid.capabilities();
    first.canAutoFill = false;

    const second = paid.capabilities();
    expect(second.canAutoFill).toBe(true);
  });

  it('keeps wrapper methods consistent with the capability object across tiers', () => {
    for (const tier of ['free', 'paid'] as const) {
      const service = new TierService(tier);
      const caps = service.capabilities();

      expect(service.canAutoFill()).toBe(caps.canAutoFill);
      expect(service.canAccessFullHistory()).toBe(caps.canAccessFullHistory);
      expect(service.canAccess28Days()).toBe(caps.canAccess28Days);
      expect(service.canAutoSubmit()).toBe(caps.canAutoSubmit);
    }
  });

});
