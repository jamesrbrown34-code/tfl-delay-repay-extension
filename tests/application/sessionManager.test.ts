import { describe, expect, it, vi } from 'vitest';
import { SessionManager } from '../../src/application/sessionManager';
import { SessionError } from '../../src/shared/errors';

function gatewayFactory(overrides: Partial<{
  beginLogin: (username: string, password: string) => Promise<{ requires2FA: boolean }>;
  submit2FA: (code: string) => Promise<{ success: boolean; ttlSeconds: number }>;
  logout: () => Promise<void>;
}> = {}) {
  return {
    beginLogin: vi.fn(async ({ username, password }: { username: string; password: string }) => {
      if (overrides.beginLogin) return overrides.beginLogin(username, password);
      return { requires2FA: true };
    }),
    submit2FA: vi.fn(async (code: string) => {
      if (overrides.submit2FA) return overrides.submit2FA(code);
      return { success: true, ttlSeconds: 60 };
    }),
    logout: vi.fn(async () => {
      if (overrides.logout) return overrides.logout();
    })
  };
}

describe('SessionManager', () => {

  it('returns a defensive copy from getState', () => {
    const manager = new SessionManager(gatewayFactory());
    const snapshot = manager.getState();

    snapshot.authenticated = true;
    expect(manager.getState().authenticated).toBe(false);
  });

  it('sets authenticated state immediately when 2FA is not required', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-04-10T10:00:00.000Z'));

    const gateway = gatewayFactory({
      beginLogin: async () => ({ requires2FA: false })
    });

    const manager = new SessionManager(gateway);
    const state = await manager.startLogin({ username: 'x', password: 'y' });

    expect(state).toEqual({
      authenticated: true,
      pending2FA: false,
      expiresAt: Date.now() + 30 * 60 * 1000
    });

    vi.useRealTimers();
  });

  it('throws if verify2FA is called without pending challenge', async () => {
    const manager = new SessionManager(gatewayFactory());
    await expect(manager.verify2FA('123456')).rejects.toBeInstanceOf(SessionError);
  });

  it('throws on invalid 2FA response', async () => {
    const gateway = gatewayFactory({ submit2FA: async () => ({ success: false, ttlSeconds: 0 }) });
    const manager = new SessionManager(gateway);

    await manager.startLogin({ username: 'x', password: 'y' });
    await expect(manager.verify2FA('bad')).rejects.toThrow('Invalid 2FA code');
  });

  it('sets custom expiry from 2FA ttl on success', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-04-10T10:00:00.000Z'));

    const gateway = gatewayFactory({ submit2FA: async () => ({ success: true, ttlSeconds: 5 }) });
    const manager = new SessionManager(gateway);

    await manager.startLogin({ username: 'x', password: 'y' });
    const state = await manager.verify2FA('123456');

    expect(state.authenticated).toBe(true);
    expect(state.expiresAt).toBe(Date.now() + 5000);

    vi.useRealTimers();
  });

  it('resets state on logout even after authenticated flow', async () => {
    const gateway = gatewayFactory({ beginLogin: async () => ({ requires2FA: false }) });
    const manager = new SessionManager(gateway);

    await manager.startLogin({ username: 'x', password: 'y' });
    await manager.logout();

    expect(manager.getState()).toEqual({ authenticated: false, pending2FA: false, expiresAt: null });
  });

  it('surfaces gateway errors for corrupted/invalid state transitions', async () => {
    const manager = new SessionManager(
      gatewayFactory({
        beginLogin: async () => {
          throw new Error('storage corruption');
        }
      })
    );

    await expect(manager.startLogin({ username: 'x', password: 'y' })).rejects.toThrow('storage corruption');
  });

  it('handles rapid login attempts by using latest response', async () => {
    const gateway = gatewayFactory();
    const manager = new SessionManager(gateway);

    const first = manager.startLogin({ username: 'u1', password: 'p1' });
    const second = manager.startLogin({ username: 'u2', password: 'p2' });

    const [, secondState] = await Promise.all([first, second]);
    expect(secondState.pending2FA).toBe(true);
    expect(gateway.beginLogin).toHaveBeenCalledTimes(2);
  });

  it('propagates logout failure and preserves state visibility', async () => {
    const manager = new SessionManager(
      gatewayFactory({
        beginLogin: async () => ({ requires2FA: false }),
        logout: async () => {
          throw new Error('logout failed');
        }
      })
    );

    await manager.startLogin({ username: 'x', password: 'y' });
    await expect(manager.logout()).rejects.toThrow('logout failed');
    expect(manager.getState().authenticated).toBe(true);
  });

  it('does not call submit2FA gateway if no challenge is pending', async () => {
    const gateway = gatewayFactory();
    const manager = new SessionManager(gateway);

    await expect(manager.verify2FA('123456')).rejects.toThrow('2FA challenge not pending');
    expect(gateway.submit2FA).not.toHaveBeenCalled();
  });

  it('keeps pending 2FA state after an invalid verification attempt', async () => {
    const gateway = gatewayFactory({ submit2FA: async () => ({ success: false, ttlSeconds: 999 }) });
    const manager = new SessionManager(gateway);

    await manager.startLogin({ username: 'x', password: 'y' });
    await expect(manager.verify2FA('bad')).rejects.toThrow('Invalid 2FA code');

    expect(manager.getState()).toEqual({ authenticated: false, pending2FA: true, expiresAt: null });
  });

  it('does not mutate authenticated state when startLogin throws', async () => {
    const manager = new SessionManager(
      gatewayFactory({
        beginLogin: async (username) => {
          if (username === 'good') return { requires2FA: false };
          throw new Error('gateway exploded');
        }
      })
    );

    await manager.startLogin({ username: 'good', password: 'pw' });
    await expect(manager.startLogin({ username: 'bad', password: 'pw' })).rejects.toThrow('gateway exploded');
    expect(manager.getState().authenticated).toBe(true);
  });

});
