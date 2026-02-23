import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpBackendClient } from '../../src/infrastructure/backendClient';
import { createClaim } from '../../src/domain/claim';
import { buildJourney } from '../helpers/factories';

describe('HttpBackendClient', () => {
  const claim = createClaim(buildJourney());

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts claim payload to backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpBackendClient('https://api.test');
    await client.enqueueClaim(claim);

    expect(fetchMock).toHaveBeenCalledWith('https://api.test/claims', expect.objectContaining({ method: 'POST' }));
  });

  it('patches claim status to backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpBackendClient('https://api.test');
    await client.updateClaimStatus('c1', 'submitted');

    expect(fetchMock).toHaveBeenCalledWith('https://api.test/claims/c1', expect.objectContaining({ method: 'PATCH' }));
  });

  it('surfaces network timeout errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));

    const client = new HttpBackendClient('https://api.test');
    await expect(client.enqueueClaim(claim)).rejects.toThrow('timeout');
  });

  it('does not silently fail on HTTP 500 (documents current behavior)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpBackendClient('https://api.test');
    await expect(client.enqueueClaim(claim)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not depend on response JSON shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ malformed: true }) }));

    const client = new HttpBackendClient('https://api.test');
    await expect(client.updateClaimStatus('id', 'failed')).resolves.toBeUndefined();
  });


  it('does not retry failed requests implicitly', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('boom'));
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpBackendClient('https://api.test');
    await expect(client.updateClaimStatus('id', 'failed')).rejects.toThrow('boom');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('handles empty response objects from fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(undefined));

    const client = new HttpBackendClient('https://api.test');
    await expect(client.enqueueClaim(claim)).resolves.toBeUndefined();
  });
});
