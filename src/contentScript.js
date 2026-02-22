const CLAIM_WINDOW_DAYS = 28;
const MIN_DELAY_MINUTES = 15;
const CLAIM_AUTOFILL_BUFFER_MINUTES = 5;
const CLAIM_AUTOFILL_STORAGE_KEY = 'sdrAutofillState';
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

function parseDdMmYyyyToDate(rawDate) {
  const [day, month, year] = String(rawDate || '')
    .split('/')
    .map((part) => Number(part));
  if (!day || !month || !year) return null;

  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}


function extractTimeFromJourneyDate(journeyDate = '') {
  const match = String(journeyDate).match(/(\d{1,2}):(\d{2})/);
  if (!match) return { hours: 12, mins: 0 };
  return {
    hours: Number(match[1]),
    mins: Number(match[2])
  };
}

function formatJourneyDate(rawDate) {
  const parsed = parseDdMmYyyyToDate(rawDate);
  if (!parsed) return rawDate;

  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = String(parsed.getFullYear());
  return `${day}/${month}/${year}`;
}

function normalizeStationName(name = '') {
  return name.toLowerCase().replace(/\[[^\]]+\]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function selectOptionByText(select, label) {
  if (!select || !label) return false;

  const target = normalizeStationName(label);
  const options = Array.from(select.options || []);
  const directMatch = options.find((option) => normalizeStationName(option.textContent) === target);
  const partialMatch =
    directMatch ||
    options.find((option) => {
      const optionLabel = normalizeStationName(option.textContent);
      return optionLabel.includes(target) || target.includes(optionLabel);
    });

  const selected = partialMatch;
  if (!selected) return false;

  select.value = selected.value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function setSelectValue(select, value) {
  if (!select || value == null) return false;
  const asString = String(value);
  const match = Array.from(select.options || []).find((option) => option.value === asString);
  if (!match) return false;
  select.value = match.value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function getFirstOysterCardOption(select) {
  return Array.from(select.options || []).find((option) => option.value && option.value !== 'UNATTACHED_CARD') || null;
}

function calculateDelayWithBuffer(delayMinutes) {
  const totalMinutes = Math.max(0, Number(delayMinutes) || 0) + CLAIM_AUTOFILL_BUFFER_MINUTES;
  const hours = Math.min(3, Math.floor(totalMinutes / 60));
  const mins = totalMinutes % 60;
  return { hours, mins };
}

function findNextButtonByText(labelText) {
  return Array.from(document.querySelectorAll('button[type="submit"],input[type="submit"]')).find((element) => {
    const text = (element.textContent || element.value || '').toLowerCase().trim();
    return text === labelText.toLowerCase();
  });
}

function clickButtonWithTestModeGuard(button, settings, fallbackMessage) {
  if (!button) return { ok: false, error: fallbackMessage };

  if (settings?.testMode) {
    return { ok: true, requiresManualClick: true };
  }

  setTimeout(() => button.click(), 250);
  return { ok: true, requiresManualClick: false };
}

async function fillCardSelectionStep(state, settings) {
  const cardSelect = document.querySelector('#oysterCardId');
  if (!cardSelect) return false;

  const preferredCardId = settings?.serviceDelayCardId;
  if (preferredCardId) {
    setSelectValue(cardSelect, preferredCardId);
  } else if (!cardSelect.value) {
    const firstCard = getFirstOysterCardOption(cardSelect);
    if (firstCard) {
      cardSelect.value = firstCard.value;
      cardSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  const nextPageButton = document.querySelector('#submitBtn') || findNextButtonByText('next page');
  if (!nextPageButton) return false;

  await chrome.storage.local.set({
    [CLAIM_AUTOFILL_STORAGE_KEY]: {
      ...state,
      stage: 'journey-details'
    }
  });

  const clickResult = clickButtonWithTestModeGuard(nextPageButton, settings, 'Next page button not available.');
  return clickResult.ok;
}

function fillJourneyDetailsForm(journey, settings) {
  const lineSelect = document.querySelector('#tflNetworkLine');
  const startSelect = document.querySelector('#startStationNlc');
  const endSelect = document.querySelector('#endStationNlc');
  const dateInput = document.querySelector('#journeyStartDate');
  const hourSelect = document.querySelector('#journeyStartDate_hh');
  const minuteSelect = document.querySelector('#journeyStartDate_mins');
  const delayHourSelect = document.querySelector('#lengthOfDelay_hh');
  const delayMinuteSelect = document.querySelector('#lengthOfDelay_mins');

  if (!lineSelect || !startSelect || !endSelect || !dateInput || !hourSelect || !minuteSelect || !delayHourSelect || !delayMinuteSelect) {
    return { ok: false, error: 'Service delay form fields were not found.' };
  }

  const selectedLine = settings?.serviceDelayNetworkLine || 'UNDERGROUND';
  setSelectValue(lineSelect, selectedLine);

  const startMatched = selectOptionByText(startSelect, journey.from);
  const endMatched = selectOptionByText(endSelect, journey.to);

  if (!startMatched || !endMatched) {
    return { ok: false, error: `Could not map station(s) for journey ${journey.from} → ${journey.to}.` };
  }

  dateInput.value = formatJourneyDate(journey.journeyDate);
  dateInput.dispatchEvent(new Event('input', { bubbles: true }));
  dateInput.dispatchEvent(new Event('change', { bubbles: true }));

  const startTime = extractTimeFromJourneyDate(journey.journeyDate);
  const startHour = startTime.hours;
  const startMinute = startTime.mins;
  setSelectValue(hourSelect, startHour);
  setSelectValue(minuteSelect, startMinute);

  const bufferedDelay = calculateDelayWithBuffer(journey.delayMinutes);
  setSelectValue(delayHourSelect, String(bufferedDelay.hours).padStart(2, '0'));
  setSelectValue(delayMinuteSelect, bufferedDelay.mins);

  return { ok: true };
}

async function fillJourneyDetailsStep(state) {
  const journey = state?.queue?.[0];
  if (!journey) {
    await chrome.storage.local.remove(CLAIM_AUTOFILL_STORAGE_KEY);
    return { ok: false, error: 'No journeys left to submit.' };
  }

  const { settings } = await chrome.storage.local.get('settings');
  const fillResult = fillJourneyDetailsForm(journey, settings);
  if (!fillResult.ok) return fillResult;

  const nextPageButton = document.querySelector('#submitBtn') || findNextButtonByText('next page');
  if (!nextPageButton) return { ok: false, error: 'Next Page button was not found on journey details form.' };

  const remaining = state.queue.slice(1);
  await chrome.storage.local.set({
    [CLAIM_AUTOFILL_STORAGE_KEY]: {
      ...state,
      queue: remaining,
      completed: [...(state.completed || []), journey],
      stage: remaining.length ? 'card-selection' : 'completed',
      lastSubmittedAt: new Date().toISOString()
    }
  });

  const clickResult = clickButtonWithTestModeGuard(nextPageButton, settings, 'Next Page button was not found on journey details form.');
  return {
    ok: clickResult.ok,
    submitted: journey,
    remaining: remaining.length,
    requiresManualClick: clickResult.requiresManualClick
  };
}

async function runServiceDelayAutofill() {
  const { sdrAutofillState, settings } = await chrome.storage.local.get([CLAIM_AUTOFILL_STORAGE_KEY, 'settings']);
  if (!sdrAutofillState?.active) return;

  const inCardSelection = Boolean(document.querySelector('#oysterCardId'));
  const inJourneyDetails = Boolean(document.querySelector('#tflNetworkLine'));

  if (inCardSelection) {
    await fillCardSelectionStep(sdrAutofillState, settings);
    return;
  }

  if (inJourneyDetails) {
    await fillJourneyDetailsStep(sdrAutofillState);
  }
}

async function startServiceDelayWorkflow(journeys) {
  if (!Array.isArray(journeys) || !journeys.length) {
    return { ok: false, error: 'No journeys supplied for service delay workflow.' };
  }

  const serviceDelayLink = document.querySelector('#navSDR');
  if (!serviceDelayLink) {
    return { ok: false, error: 'Service delay refunds navigation link not found.' };
  }

  const { settings } = await chrome.storage.local.get('settings');

  await chrome.storage.local.set({
    [CLAIM_AUTOFILL_STORAGE_KEY]: {
      active: true,
      startedAt: new Date().toISOString(),
      stage: 'card-selection',
      queue: journeys,
      completed: []
    }
  });

  serviceDelayLink.click();
  return { ok: true, queued: journeys.length, requiresManualClick: Boolean(settings?.testMode) };
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

  const { settings } = await chrome.storage.local.get('settings');
  if (!settings?.testMode) {
    setTimeout(() => submitButton.click(), 300);
  }
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

  const { settings } = await chrome.storage.local.get('settings');
  if (!settings?.testMode) {
    setTimeout(() => submitButton.click(), 300);
  }

  return { ok: true, queuedRanges: queue.length + 1, requiresManualClick: Boolean(settings?.testMode) };
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

  if (message?.type === 'START_SERVICE_DELAY_WORKFLOW') {
    startServiceDelayWorkflow(message.journeys)
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

  await runServiceDelayAutofill();
})();
