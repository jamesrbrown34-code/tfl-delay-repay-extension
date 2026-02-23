import type { Claim, Journey } from '../shared/types';

export function createClaim(journey: Journey): Claim {
  return {
    claimId: `claim-${journey.id}`,
    journeyId: journey.id,
    createdAt: new Date().toISOString(),
    status: 'queued'
  };
}
