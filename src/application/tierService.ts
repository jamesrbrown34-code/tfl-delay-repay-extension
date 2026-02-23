import type { CapabilitySet, Settings, Tier } from '../shared/types';

export class TierService {
  private readonly tier: Tier;

  constructor(tier: Tier) {
    this.tier = tier === 'paid' ? 'paid' : 'free';
  }

  static fromSettings(settings: Settings): TierService {
    return new TierService(settings.tier);
  }

  getCurrentTier(): Tier {
    return this.tier;
  }

  isFree(): boolean {
    return this.tier === 'free';
  }

  isPaid(): boolean {
    return this.tier === 'paid';
  }

  capabilities(): CapabilitySet {
    return {
      canAutoSubmit: false,
      canAutoFill: this.isPaid(),
      canAccess28Days: this.isPaid(),
      canAccessFullHistory: this.isPaid()
    };
  }

  canAutoSubmit(): boolean {
    return false;
  }

  canAutoFill(): boolean {
    return this.capabilities().canAutoFill;
  }

  canAccess28Days(): boolean {
    return this.canAccessFullHistory();
  }

  canAccessFullHistory(): boolean {
    return this.capabilities().canAccessFullHistory;
  }
}
