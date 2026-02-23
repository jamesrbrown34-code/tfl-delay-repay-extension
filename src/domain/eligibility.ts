import { CLAIM_WINDOW_DAYS, CONCESSION_KEYWORDS, MIN_DELAY_MINUTES } from '../shared/constants';
import type { EligibilityDecision, Journey } from '../shared/types';

export function isConcessionFare(ticketType: string): boolean {
  return CONCESSION_KEYWORDS.some((keyword) => ticketType.toLowerCase().includes(keyword));
}

export function isWithinClaimWindow(journeyDate: string, now = new Date()): boolean {
  const parsedDate = new Date(journeyDate);
  if (Number.isNaN(parsedDate.getTime())) return false;

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - CLAIM_WINDOW_DAYS);

  parsedDate.setHours(0, 0, 0, 0);
  return parsedDate >= start;
}

export function evaluateEligibility(journey: Journey, now = new Date()): EligibilityDecision {
  const reasons: string[] = [];
  if (journey.delayMinutes < MIN_DELAY_MINUTES) reasons.push('Delay under minimum threshold');
  if (!isWithinClaimWindow(journey.journeyDate, now)) reasons.push('Outside claim window');
  if (isConcessionFare(journey.ticketType)) reasons.push('Concession fare is excluded');

  return {
    eligible: reasons.length === 0,
    reasons
  };
}

export function filterEligibleJourneys(journeys: Journey[], now = new Date()): Journey[] {
  return journeys.filter((journey) => evaluateEligibility(journey, now).eligible);
}
