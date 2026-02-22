const BASE_PAYG_FARE = 2.8;

const TICKET_MULTIPLIERS = {
  oyster: 1,
  contactless: 1,
  travelcard: 1,
  paper: 1.2
};

function inferTicketKey(ticketType = '') {
  const normalized = ticketType.toLowerCase();

  if (normalized.includes('contactless')) return 'contactless';
  if (normalized.includes('travelcard')) return 'travelcard';
  if (normalized.includes('paper')) return 'paper';
  return 'oyster';
}

export function estimateRefund(journey) {
  const ticketKey = inferTicketKey(journey.ticketType);
  const multiplier = TICKET_MULTIPLIERS[ticketKey] || 1;

  const zoneAdjustment = Math.max(0, Number(journey.zonesCrossed || 1) - 1) * 0.35;
  const estimatedFare = BASE_PAYG_FARE * multiplier + zoneAdjustment;

  return Number(estimatedFare.toFixed(2));
}

export function estimateTotalRefund(journeys) {
  return Number(
    journeys
      .reduce((sum, journey) => sum + estimateRefund(journey), 0)
      .toFixed(2)
  );
}
