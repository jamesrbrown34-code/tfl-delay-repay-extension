import { estimateRefund } from './fareEstimator.js';

function determineConfidence(journey) {
  if (journey.delaySource === 'user') return 'High';
  if (journey.delaySource === 'inferred') return 'Medium';
  return 'Low';
}

export function buildClaimSnippet(journey) {
  return [
    `Journey Date: ${journey.journeyDate}`,
    `From: ${journey.from}`,
    `To: ${journey.to}`,
    `Delay: ${journey.delayMinutes} minutes`,
    `Ticket Type: ${journey.ticketType}`,
    `Estimated Refund: £${estimateRefund(journey).toFixed(2)}`,
    `Confidence: ${determineConfidence(journey)}`
  ].join('\n');
}

export function buildBatchSnippet(journeys) {
  return journeys
    .map((journey, index) => `Claim ${index + 1}\n${buildClaimSnippet(journey)}`)
    .join('\n\n');
}
