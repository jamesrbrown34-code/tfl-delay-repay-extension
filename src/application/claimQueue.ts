import { createClaim } from '../domain/claim';
import type { BackendClient, Claim, Journey, Logger } from '../shared/types';

export class ClaimQueue {
  private queue: Claim[] = [];

  constructor(
    private readonly backendClient: BackendClient,
    private readonly logger: Logger
  ) {}

  enqueueJourneys(journeys: Journey[]): Claim[] {
    const claims = journeys.map((journey) => createClaim(journey));
    this.queue.push(...claims);
    this.logger.info('Queued claims', { count: claims.length });
    return claims;
  }

  size(): number {
    return this.queue.length;
  }

  async processNext(): Promise<Claim | null> {
    const next = this.queue.shift();
    if (!next) return null;

    next.status = 'in_progress';
    await this.backendClient.enqueueClaim(next);
    next.status = 'submitted';
    await this.backendClient.updateClaimStatus(next.claimId, next.status);

    return next;
  }
}
