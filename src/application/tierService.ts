import type { CapabilitySet, Settings, Tier } from '../shared/types';

export class TierService {
  constructor(private readonly tier: Tier) {}

  static fromSettings(settings: Settings): TierService {
    return new TierService(settings.tier);
  }

  capabilities(): CapabilitySet {
    return {
      canAutoSubmit: this.tier === 'paid',
      canAccess28Days: true
    };
  }

  canAutoSubmit(): boolean {
    return this.capabilities().canAutoSubmit;
  }

  canAccess28Days(): boolean {
    return this.capabilities().canAccess28Days;
  }
}
