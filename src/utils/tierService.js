export const FREE_TIER = 'free';
export const PAID_TIER = 'paid';
export const STORAGE_KEY = 'manualAccessToken';

// MVP-only embedded secret. In production, move verification off-device.
const TOKEN_SECRET = 'tube-refund-extension-mvp-secret-v1';

export function normalizeTier(rawTier) {
  return rawTier === PAID_TIER ? PAID_TIER : FREE_TIER;
}

function normalizeBase64(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const padLength = (4 - (normalized.length % 4)) % 4;
  return normalized + '='.repeat(padLength);
}

function decodeBase64Utf8(value) {
  return decodeURIComponent(escape(atob(value)));
}

function encodeBase64Utf8(value) {
  return btoa(unescape(encodeURIComponent(value)));
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function hmacSha256Hex(message, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export class TierService {
  constructor(tier = FREE_TIER) {
    this.tier = normalizeTier(tier);
    this.token = null;
  }

  static fromSettings(settings = {}) {
    return new TierService(settings.tier);
  }

  async initialize() {
    const { [STORAGE_KEY]: storedToken } = await chrome.storage.local.get(STORAGE_KEY);
    if (!storedToken) {
      this.tier = FREE_TIER;
      this.token = null;
      return { valid: false };
    }

    const validation = await this.validateToken(storedToken);
    if (!validation.valid) {
      await chrome.storage.local.remove(STORAGE_KEY);
      this.tier = FREE_TIER;
      this.token = null;
      return validation;
    }

    this.token = storedToken;
    this.tier = PAID_TIER;
    return validation;
  }

  async validateToken(token) {
    if (!token || typeof token !== 'string') {
      return { valid: false, reason: 'Token is required.' };
    }

    let payload;
    try {
      const decoded = decodeBase64Utf8(normalizeBase64(token));
      payload = JSON.parse(decoded);
    } catch (_error) {
      return { valid: false, reason: 'Invalid token encoding or JSON payload.' };
    }

    const { tier, exp, sig } = payload || {};
    if (tier !== PAID_TIER || !isIsoDate(exp) || typeof sig !== 'string' || !sig) {
      return { valid: false, reason: 'Token payload is missing required fields.' };
    }

    const expectedSig = await hmacSha256Hex(`${tier}${exp}`, TOKEN_SECRET);
    if (expectedSig.toLowerCase() !== sig.toLowerCase()) {
      return { valid: false, reason: 'Invalid token signature.' };
    }

    const expiryDate = new Date(`${exp}T23:59:59.999Z`);
    if (Number.isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
      return { valid: false, reason: 'Token is expired.' };
    }

    return { valid: true, tier: PAID_TIER, exp };
  }

  async saveToken(token) {
    const validation = await this.validateToken(token);
    if (!validation.valid) return validation;

    await chrome.storage.local.set({ [STORAGE_KEY]: token });
    this.token = token;
    this.tier = PAID_TIER;
    return validation;
  }

  getCurrentTier() {
    return normalizeTier(this.tier);
  }

  getTier() {
    return this.getCurrentTier();
  }

  isFree() {
    return this.getCurrentTier() === FREE_TIER;
  }

  isPaid() {
    return this.getCurrentTier() === PAID_TIER;
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

  static async createToken(exp) {
    const tier = PAID_TIER;
    const sig = await hmacSha256Hex(`${tier}${exp}`, TOKEN_SECRET);
    return encodeBase64Utf8(JSON.stringify({ tier, exp, sig }));
  }
}
