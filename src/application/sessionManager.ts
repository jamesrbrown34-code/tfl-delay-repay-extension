import { SessionError } from '../shared/errors';
import type { Credentials, SessionGateway, SessionState } from '../shared/types';

export class SessionManager {
  private state: SessionState = {
    authenticated: false,
    pending2FA: false,
    expiresAt: null
  };

  constructor(private readonly sessionGateway: SessionGateway) {}

  getState(): SessionState {
    return { ...this.state };
  }

  async startLogin(credentials: Credentials): Promise<SessionState> {
    const result = await this.sessionGateway.beginLogin(credentials);

    this.state = {
      authenticated: false,
      pending2FA: result.requires2FA,
      expiresAt: null
    };

    if (!result.requires2FA) {
      this.state.authenticated = true;
      this.state.expiresAt = Date.now() + 30 * 60 * 1000;
    }

    return this.getState();
  }

  async verify2FA(code: string): Promise<SessionState> {
    if (!this.state.pending2FA) throw new SessionError('2FA challenge not pending');

    const result = await this.sessionGateway.submit2FA(code);
    if (!result.success) throw new SessionError('Invalid 2FA code');

    this.state = {
      authenticated: true,
      pending2FA: false,
      expiresAt: Date.now() + result.ttlSeconds * 1000
    };

    return this.getState();
  }

  async logout(): Promise<void> {
    await this.sessionGateway.logout();
    this.state = { authenticated: false, pending2FA: false, expiresAt: null };
  }
}
