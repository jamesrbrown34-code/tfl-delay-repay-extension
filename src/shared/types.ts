export type Tier = 'free' | 'paid';

export interface Journey {
  id: string;
  journeyDate: string;
  from: string;
  to: string;
  expectedMinutes: number | null;
  actualMinutes: number | null;
  delayMinutes: number;
  ticketType: string;
  zonesCrossed: number;
  source: 'history-table' | 'statement-action';
}

export interface EligibilityDecision {
  eligible: boolean;
  reasons: string[];
}

export interface Claim {
  claimId: string;
  journeyId: string;
  createdAt: string;
  status: 'queued' | 'in_progress' | 'submitted' | 'failed';
}

export interface Credentials {
  username: string;
  password: string;
}

export interface SessionState {
  authenticated: boolean;
  pending2FA: boolean;
  expiresAt: number | null;
}

export interface Settings {
  tier: Tier;
  autoDetectOnLoad: boolean;
  testMode: boolean;
  testModeRealJourneys: boolean;
}

export interface CapabilitySet {
  canAutoSubmit: boolean;
  canAutoFill: boolean;
  canAccess28Days: boolean;
  canAccessFullHistory: boolean;
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface BackendClient {
  enqueueClaim(claim: Claim): Promise<void>;
  updateClaimStatus(claimId: string, status: Claim['status']): Promise<void>;
}

export interface SessionGateway {
  beginLogin(credentials: Credentials): Promise<{ requires2FA: boolean }>;
  submit2FA(code: string): Promise<{ success: boolean; ttlSeconds: number }>;
  logout(): Promise<void>;
}
