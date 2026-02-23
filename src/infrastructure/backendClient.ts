import type { BackendClient, Claim } from '../shared/types';

export class HttpBackendClient implements BackendClient {
  constructor(private readonly baseUrl: string) {}

  async enqueueClaim(claim: Claim): Promise<void> {
    await fetch(`${this.baseUrl}/claims`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(claim)
    });
  }

  async updateClaimStatus(claimId: string, status: Claim['status']): Promise<void> {
    await fetch(`${this.baseUrl}/claims/${claimId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status })
    });
  }
}
