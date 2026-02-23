import type { Journey } from '../shared/types';
import { TierService } from './tierService';

export interface ClaimSummary {
  eligibleClaims: number;
  estimatedTotalRefund: number;
  submissionProgressState: string;
}

export function filterJourneysByTier(journeys: Journey[], tierService: TierService, now = new Date()): Journey[] {
  if (tierService.canAccessFullHistory()) return journeys;

  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 7);

  return journeys.filter((journey) => {
    const parsed = new Date(journey.journeyDate);
    if (Number.isNaN(parsed.getTime())) return false;
    parsed.setHours(0, 0, 0, 0);
    return parsed >= cutoff;
  });
}

export function shouldAutoFill(tierService: TierService): boolean {
  return tierService.canAutoFill();
}

export function buildClaimSummary(journeys: Journey[], estimatedTotalRefund: number, submissionProgressState: string): ClaimSummary {
  return {
    eligibleClaims: journeys.length,
    estimatedTotalRefund,
    submissionProgressState
  };
}
