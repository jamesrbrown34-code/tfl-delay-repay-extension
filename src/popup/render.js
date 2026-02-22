import { estimateRefund, estimateTotalRefund } from '../utils/fareEstimator.js';

export function renderJourneys(journeysList, journeys) {
  journeysList.innerHTML = '';

  if (!journeys.length) {
    journeysList.innerHTML = '<p>No eligible journeys found.</p>';
    return;
  }

  const cards = journeys.map((journey) => {
    const card = document.createElement('article');
    card.className = 'journey-card';
    card.innerHTML = [
      `<strong>${journey.journeyDate}: ${journey.from} → ${journey.to}</strong><br>`,
      `Delay: ${journey.delayMinutes} min · Ticket: ${journey.ticketType}<br>`,
      `Estimated refund: £${estimateRefund(journey).toFixed(2)}`
    ].join('');

    return card;
  });

  journeysList.append(...cards);
}

export function renderSummary(summaryBox, journeys) {
  const total = estimateTotalRefund(journeys).toFixed(2);
  summaryBox.innerHTML = `<p><strong>${journeys.length}</strong> eligible journeys · Estimated total refund: <strong>£${total}</strong></p>`;
}

export function appendInfo(summaryBox, message) {
  summaryBox.innerHTML += `<p>${message}</p>`;
}

export function setSummary(summaryBox, message) {
  summaryBox.innerHTML = `<p>${message}</p>`;
}

export function renderWorkflowTracker(summaryBox, state) {
  if (!state) return;

  const completed = state.completed || [];
  const queue = state.queue || [];
  const expectedValue = estimateTotalRefund(completed).toFixed(2);

  const tracker = document.createElement('div');
  tracker.innerHTML = `
    <p><strong>Refund tracker</strong>: ${completed.length} requested, ${queue.length} remaining.</p>
    <p>Expected value requested so far: <strong>£${expectedValue}</strong></p>
  `;

  if (state.stage === 'completed' || (!state.active && completed.length)) {
    tracker.innerHTML += `<p><strong>Finished:</strong> ${completed.length} journeys requested, expected value is £${expectedValue}.</p>`;
  }

  summaryBox.appendChild(tracker);
}
