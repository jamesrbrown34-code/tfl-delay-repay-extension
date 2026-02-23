import { isWithinClaimWindow } from './dateUtils.js';
import { SystemClock } from './clock.js';

export const CLAIM_AUTOFILL_BUFFER_MINUTES = 5;
export const CONCESSION_KEYWORDS = [
  'freedom pass',
  '60+ oyster',
  'veteran',
  'child',
  'zip',
  'concession',
  'free travel'
];

export function isConcessionFare(ticketType = '', concessionKeywords = CONCESSION_KEYWORDS) {
  const normalized = ticketType.toLowerCase();
  return concessionKeywords.some((keyword) => normalized.includes(keyword));
}

export function getEligibleJourneys(
  journeys,
  {
    isWithinClaimWindowFn = isWithinClaimWindow,
    isConcessionFareFn = isConcessionFare,
    clock = new SystemClock()
  } = {}
) {
  const now = clock.now();

  return journeys
    .filter((journey) => journey.delayEligible)
    .filter((journey) => isWithinClaimWindowFn(journey.journeyDate, now))
    .filter((journey) => !isConcessionFareFn(journey.ticketType));
}

export function calculateDelayWithBuffer(delayMinutes, claimAutofillBufferMinutes = CLAIM_AUTOFILL_BUFFER_MINUTES) {
  const totalMinutes = Math.max(0, Number(delayMinutes) || 0) + claimAutofillBufferMinutes;
  const hours = Math.min(3, Math.floor(totalMinutes / 60));
  const mins = totalMinutes % 60;
  return { hours, mins };
}
