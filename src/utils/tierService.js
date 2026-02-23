export const FREE_TIER = 'free';
export const PAID_TIER = 'paid';

export function normalizeTier(rawTier) {
  return rawTier === PAID_TIER ? PAID_TIER : FREE_TIER;
}

export class TierService {
  constructor(tier) {
    this.tier = normalizeTier(tier);
  }

  static fromSettings(settings = {}) {
    return new TierService(settings.tier);
  }

  getCurrentTier() {
    return this.tier;
  }

  isFree() {
    return this.tier === FREE_TIER;
  }

  isPaid() {
    return this.tier === PAID_TIER;
  }

  canAutoFill() {
    return this.isPaid();
  }

  canAccessFullHistory() {
    return this.isPaid();
  }

  capabilities() {
    return {
      tier: this.getCurrentTier(),
      canAutoFill: this.canAutoFill(),
      canAccessFullHistory: this.canAccessFullHistory(),
      historyDays: this.canAccessFullHistory() ? 28 : 7
    };
  }
}
