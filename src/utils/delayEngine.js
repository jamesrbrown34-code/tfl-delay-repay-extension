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

const ELIGIBILITY_RULES = {
  standard: (journey) => journey.delayEligible && journey.withinClaimWindow && !journey.concessionExcluded,
  ignoreMinDelay: (journey) => journey.withinClaimWindow && !journey.concessionExcluded
};

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

function toNonNegativeNumber(value) {
  return Math.max(0, Number(value || 0));
}

export function normalizeJourney(rawJourney = {}) {
  const expectedMinutes = toNonNegativeNumber(rawJourney.expectedMinutes);
  const actualMinutes = toNonNegativeNumber(rawJourney.actualMinutes);
  const delayMinutes = Math.max(0, actualMinutes - expectedMinutes);

  return {
    ...rawJourney,
    delayMinutes,
    delayEligible: delayMinutes >= MIN_DELAY_MINUTES,
    concessionExcluded: isConcessionFare(rawJourney.ticketType),
    withinClaimWindow: isWithinClaimWindow(rawJourney.journeyDate)
  };
}

export function getEligibleJourneysByRule(journeys = [], ruleName = 'standard') {
  const rule = ELIGIBILITY_RULES[ruleName];
  if (!rule) {
    throw new Error(`Unknown eligibility rule: ${ruleName}`);
  }

  return journeys
    .map(normalizeJourney)
    .filter(rule);
}

export function getEligibleJourneys(journeys) {
  return getEligibleJourneysByRule(journeys, 'standard');
}

export function getEligibleJourneysIgnoringMinDelay(journeys) {
  return getEligibleJourneysByRule(journeys, 'ignoreMinDelay');
}
