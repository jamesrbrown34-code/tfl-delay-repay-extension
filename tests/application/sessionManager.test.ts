import { describe, expect, it } from 'vitest';
import { SessionManager } from '../../src/application/sessionManager';

describe('SessionManager', () => {
  it('handles login + 2FA challenge', async () => {
    const gateway = {
      beginLogin: async () => ({ requires2FA: true }),
      submit2FA: async () => ({ success: true, ttlSeconds: 60 }),
      logout: async () => {}
    };

    const manager = new SessionManager(gateway);
    const started = await manager.startLogin({ username: 'x', password: 'y' });
    expect(started.pending2FA).toBe(true);

    const verified = await manager.verify2FA('123456');
    expect(verified.authenticated).toBe(true);
  });
});
