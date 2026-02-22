const CLAIM_WINDOW_DAYS = 28;
const MIN_DELAY_MINUTES = 15;
const CONCESSION_KEYWORDS = [
  'freedom pass',
  '60+ oyster',
  'veteran',
  'child',
  'zip',
  'concession',
  'free travel'
];

function extractText(node, fallback = '') {
  return (node?.textContent || fallback).trim();
}

function isConcessionFare(ticketType = '') {
  const normalized = ticketType.toLowerCase();
  return CONCESSION_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function isWithinClaimWindow(journeyDate, now = new Date()) {
  const parsedDate = new Date(journeyDate);
  if (Number.isNaN(parsedDate.getTime())) return false;

  const windowStart = new Date(now);
  windowStart.setHours(0, 0, 0, 0);
  windowStart.setDate(windowStart.getDate() - CLAIM_WINDOW_DAYS);

  parsedDate.setHours(0, 0, 0, 0);
  return parsedDate >= windowStart;
}

function parseJourneyRows() {
  const rows = Array.from(document.querySelectorAll('table tbody tr'));

  return rows
    .map((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 6) return null;

      const expectedMinutes = Number(extractText(cells[3]));
      const actualMinutes = Number(extractText(cells[4]));
      const delayMinutes = Math.max(0, actualMinutes - expectedMinutes);

      return {
        journeyDate: extractText(cells[0]),
        from: extractText(cells[1]),
        to: extractText(cells[2]),
        expectedMinutes,
        actualMinutes,
        delayMinutes,
        delayEligible: delayMinutes >= MIN_DELAY_MINUTES,
        ticketType: extractText(cells[5]),
        delaySource: 'inferred',
        zonesCrossed: Number(extractText(cells[6], '1')) || 1
      };
    })
    .filter(Boolean);
}

function getEligibleJourneys(journeys) {
  return journeys
    .filter((journey) => journey.delayEligible)
    .filter((journey) => isWithinClaimWindow(journey.journeyDate))
    .filter((journey) => !isConcessionFare(journey.ticketType));
}

function isTfLJourneyHistoryPage() {
  const url = window.location.href.toLowerCase();
  const host = window.location.hostname.toLowerCase();
  const onTfLDomain = host === 'oyster.tfl.gov.uk' || host.endsWith('.tfl.gov.uk');

  return onTfLDomain && /(journey-history|journeyhistory|journeys|history)/i.test(url);
}

async function analyseJourneyTable() {
  const parsedJourneys = parseJourneyRows();
  const eligibleJourneys = getEligibleJourneys(parsedJourneys);

  await chrome.storage.local.set({
    lastAnalysedAt: new Date().toISOString(),
    lastParsedJourneys: parsedJourneys,
    lastEligibleJourneys: eligibleJourneys
  });

  return { parsedJourneys, eligibleJourneys };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'ANALYSE_JOURNEYS') {
    analyseJourneyTable()
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'PING_PAGE_STATUS') {
    sendResponse({ ok: true, isJourneyHistory: isTfLJourneyHistoryPage() });
  }

  return undefined;
});

(async () => {
  const { settings } = await chrome.storage.local.get('settings');
  const autoDetect = settings?.isPaidTier && settings?.autoDetectOnLoad;
  if (autoDetect && isTfLJourneyHistoryPage()) {
    await analyseJourneyTable();
  }
})();
