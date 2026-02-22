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

function parseOptionRange(optionValue) {
  const [startRaw, endRaw] = String(optionValue || '').split('-');
  if (!startRaw || !endRaw) return null;

  const [day, month, year] = startRaw.trim().split(' ')[0].split('/').map(Number);
  const [endDay, endMonth, endYear] = endRaw.trim().split(' ')[0].split('/').map(Number);

  if (!day || !month || !year || !endDay || !endMonth || !endYear) return null;

  const start = new Date(year, month - 1, day);
  const end = new Date(endYear, endMonth - 1, endDay);

  return { start, end };
}

function getDateRangeOptionsForLast28Days() {
  const select = document.querySelector('#date-range');
  if (!select) return [];

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - CLAIM_WINDOW_DAYS);

  return Array.from(select.options)
    .map((option) => {
      const range = parseOptionRange(option.value);
      if (!range) return null;
      if (range.end < cutoff) return null;
      return option.value;
    })
    .filter(Boolean);
}

function getJourneyKey(journey) {
  return [journey.journeyDate, journey.from, journey.to, journey.expectedMinutes, journey.actualMinutes, journey.ticketType].join('|');
}

async function processBatchStateAfterLoad() {
  const { batchCollection } = await chrome.storage.local.get('batchCollection');
  if (!batchCollection?.active) return;

  const currentJourneys = parseJourneyRows();
  const knownKeys = new Set((batchCollection.journeys || []).map(getJourneyKey));
  const mergedJourneys = [...(batchCollection.journeys || [])];

  currentJourneys.forEach((journey) => {
    const key = getJourneyKey(journey);
    if (!knownKeys.has(key)) {
      knownKeys.add(key);
      mergedJourneys.push(journey);
    }
  });

  const remainingQueue = [...(batchCollection.queue || [])];
  if (!remainingQueue.length) {
    await chrome.storage.local.set({
      batchCollection: {
        ...batchCollection,
        active: false,
        journeys: mergedJourneys,
        finishedAt: new Date().toISOString(),
        queue: []
      },
      lastParsedJourneys: mergedJourneys,
      lastEligibleJourneys: getEligibleJourneys(mergedJourneys),
      lastAnalysedAt: new Date().toISOString()
    });
    return;
  }

  const nextValue = remainingQueue.shift();

  await chrome.storage.local.set({
    batchCollection: {
      ...batchCollection,
      journeys: mergedJourneys,
      processed: [...(batchCollection.processed || []), nextValue],
      queue: remainingQueue
    }
  });

  const select = document.querySelector('#date-range');
  const submitButton = document.querySelector('#date-range-button');

  if (!select || !submitButton) return;

  select.value = nextValue;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  setTimeout(() => submitButton.click(), 300);
}

async function startCollectLast28Days() {
  const select = document.querySelector('#date-range');
  const submitButton = document.querySelector('#date-range-button');

  if (!select || !submitButton) {
    return { ok: false, error: 'Date range controls not found on page.' };
  }

  const queue = getDateRangeOptionsForLast28Days();
  if (!queue.length) {
    return { ok: false, error: 'No date ranges found for the last 28 days.' };
  }

  const firstValue = queue.shift();

  await chrome.storage.local.set({
    batchCollection: {
      active: true,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      queue,
      processed: [firstValue],
      journeys: []
    }
  });

  select.value = firstValue;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  setTimeout(() => submitButton.click(), 300);

  return { ok: true, queuedRanges: queue.length + 1 };
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

  if (message?.type === 'COLLECT_LAST_28_DAYS') {
    startCollectLast28Days()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return undefined;
});

(async () => {
  const { settings } = await chrome.storage.local.get('settings');
  const autoDetect = settings?.isPaidTier && settings?.autoDetectOnLoad;

  if (isTfLJourneyHistoryPage()) {
    await processBatchStateAfterLoad();
  }

  if (autoDetect && isTfLJourneyHistoryPage()) {
    await analyseJourneyTable();
  }
})();
