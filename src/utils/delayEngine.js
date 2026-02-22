export const CLAIM_WINDOW_DAYS = 28;
export const MIN_DELAY_MINUTES = 15;

export const CONCESSION_KEYWORDS = [
  'freedom pass',
  '60+ oyster',
  'veteran',
  'child',
  'zip',
  'concession',
  'free travel'
];

export function isConcessionFare(ticketType = '') {
  const normalized = ticketType.toLowerCase();
  return CONCESSION_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function parseDate(dateStr) {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isWithinClaimWindow(journeyDate, now = new Date()) {
  const parsedDate = typeof journeyDate === 'string' ? parseDate(journeyDate) : journeyDate;
  if (!parsedDate) return false;

  const windowStart = new Date(now);
  windowStart.setHours(0, 0, 0, 0);
  windowStart.setDate(windowStart.getDate() - CLAIM_WINDOW_DAYS);

  const normalizedJourney = new Date(parsedDate);
  normalizedJourney.setHours(0, 0, 0, 0);

  return normalizedJourney >= windowStart;
}

export function normalizeJourney(rawJourney) {
  const expectedMinutes = Number(rawJourney.expectedMinutes || 0);
  const actualMinutes = Number(rawJourney.actualMinutes || 0);
  const delayMinutes = Math.max(0, actualMinutes - expectedMinutes);

  return {
    ...rawJourney,
    delayMinutes,
    delayEligible: delayMinutes >= MIN_DELAY_MINUTES,
    concessionExcluded: isConcessionFare(rawJourney.ticketType),
    withinClaimWindow: isWithinClaimWindow(rawJourney.journeyDate)
  };
}

export function getEligibleJourneys(journeys) {
  return journeys
    .map(normalizeJourney)
    .filter((journey) => journey.delayEligible)
    .filter((journey) => journey.withinClaimWindow)
    .filter((journey) => !journey.concessionExcluded);
}
