import { SELECTORS } from './selectors.js';

export const PAGE_TYPES = {
  MY_CARDS: 'MY_CARDS',
  JOURNEY_HISTORY: 'JOURNEY_HISTORY',
  SERVICE_DELAY: 'SERVICE_DELAY',
  UNKNOWN: 'UNKNOWN'
};

export function detectPageType() {
  const url = window.location.href.toLowerCase();
  const host = window.location.hostname.toLowerCase();
  const path = window.location.pathname.toLowerCase();
  const heading = document.querySelector(SELECTORS.journeyHistory.pageHeading);
  const headingText = (heading?.textContent || '').trim().toLowerCase();

  const onTfLDomain = host === 'oyster.tfl.gov.uk' || host.endsWith('.tfl.gov.uk');
  const isJourneyHistory = onTfLDomain && /(journey-history|journeyhistory|journeys|history)/i.test(url);
  if (isJourneyHistory) return PAGE_TYPES.JOURNEY_HISTORY;

  if (headingText === 'my oyster cards' || path.includes('/myoystercards')) return PAGE_TYPES.MY_CARDS;
  if (path.includes('/oyster/sdr')) return PAGE_TYPES.SERVICE_DELAY;

  return PAGE_TYPES.UNKNOWN;
}
