const BASE_PAYG_FARE = 2.8;
const EXTRA_ZONE_COST = 0.35;

const TICKET_MULTIPLIERS = {
  oyster: 1,
  contactless: 1,
  travelcard: 1,
  paper: 1.2
};

const TICKET_INFERENCE_RULES = [
  { key: 'contactless', includes: 'contactless' },
  { key: 'travelcard', includes: 'travelcard' },
  { key: 'paper', includes: 'paper' }
];

export function inferTicketKey(ticketType = '') {
  const normalized = ticketType.toLowerCase();
  const matchingRule = TICKET_INFERENCE_RULES.find((rule) => normalized.includes(rule.includes));
  return matchingRule?.key || 'oyster';
}

function getZoneAdjustment(zonesCrossed = 1) {
  const extraZones = Math.max(0, Number(zonesCrossed || 1) - 1);
  return extraZones * EXTRA_ZONE_COST;
}

export function estimateRefund(journey = {}) {
  const ticketKey = inferTicketKey(journey.ticketType);
  const multiplier = TICKET_MULTIPLIERS[ticketKey] || 1;
  const estimatedFare = BASE_PAYG_FARE * multiplier + getZoneAdjustment(journey.zonesCrossed);

  return Number(estimatedFare.toFixed(2));
}

export function estimateTotalRefund(journeys = []) {
  return Number(journeys.reduce((sum, journey) => sum + estimateRefund(journey), 0).toFixed(2));
}
