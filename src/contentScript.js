import {
  CLAIM_WINDOW_DAYS,
  formatJourneyDate,
  parseDateLabelToDdMmYyyy
} from './core/dateUtils.js';
import {
  calculateDelayWithBuffer,
  getEligibleJourneys
} from './core/eligibility.js';
import {
  normalizeStationName,
  parseStationPairFromAction
} from './core/stationUtils.js';
import {
  extractEndTimeFromJourney,
  extractTimeFromJourneyDate,
  parseTimeRangeEnd,
  parseTimeRangeStart
} from './core/timeUtils.js';
import { SELECTORS } from './content/selectors.js';
import { ServiceDelayWorkflow } from './content/workflow/serviceDelayWorkflow.js';
import { StatusPanel } from './content/ui/statusPanel.js';

const MIN_DELAY_MINUTES = 15;
const CLAIM_AUTOFILL_STORAGE_KEY = 'sdrAutofillState';
const PENDING_COLLECT_STORAGE_KEY = 'pendingCollectFromMyCards';

const statusPanel = new StatusPanel({
  isExpectedTfLPage,
  isMyOysterCardsPage,
  isTfLJourneyHistoryPage
});

function extractText(node, fallback = '') {
  return (node?.textContent || fallback).trim();
}

function parseJourneyRows() {
  const rows = Array.from(document.querySelectorAll(SELECTORS.journeyHistory.tableRows));
  let currentDateLabel = null;

  return rows
    .map((row) => {
      const cells = row.querySelectorAll(SELECTORS.journeyHistory.tableCells);
      if (!cells.length) return null;

      if (cells.length >= 6) {
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
      }

      if (cells.length >= 4) {
        const firstCell = extractText(cells[0]);
        const actionText = extractText(cells[1]);

        const maybeDate = parseDateLabelToDdMmYyyy(firstCell);
        if (maybeDate && !actionText.toLowerCase().includes(' to ')) {
          currentDateLabel = maybeDate;
          return null;
        }

        const stationPair = parseStationPairFromAction(actionText);
        if (!stationPair) return null;

        if (/touch\s+(in|out)|bus journey/i.test(actionText)) return null;

        const startTime = parseTimeRangeStart(firstCell);
        const endTime = parseTimeRangeEnd(firstCell);

        return {
          journeyDate: currentDateLabel || firstCell,
          from: stationPair.from,
          to: stationPair.to,
          expectedMinutes: null,
          actualMinutes: null,
          delayMinutes: MIN_DELAY_MINUTES,
          delayEligible: true,
          ticketType: 'PAYG',
          delaySource: 'statement-journey-action',
          zonesCrossed: 1,
          startTime,
          endTime
        };
      }

      return null;
    })
    .filter(Boolean);
}

function isTfLJourneyHistoryPage() {
  const url = window.location.href.toLowerCase();
  const host = window.location.hostname.toLowerCase();
  const onTfLDomain = host === 'oyster.tfl.gov.uk' || host.endsWith('.tfl.gov.uk');

  return onTfLDomain && /(journey-history|journeyhistory|journeys|history)/i.test(url);
}

function isMyOysterCardsPage() {
  const heading = document.querySelector(SELECTORS.journeyHistory.pageHeading);
  const headingText = (heading?.textContent || '').trim().toLowerCase();
  const path = window.location.pathname.toLowerCase();
  return headingText === 'my oyster cards' || path.includes('/myoystercards');
}

function isExpectedTfLPage() {
  const path = window.location.pathname.toLowerCase();
  return isTfLJourneyHistoryPage() || isMyOysterCardsPage() || path.includes('/oyster/sdr');
}

function getReadableWorkflowStage(stage = '') {
  const mapping = {
    'card-selection': 'Selecting Oyster card',
    'journey-details': 'Filling journey details',
    'refund-type-selected': 'Final step: click Submit for a valid claim',
    submitted: 'Submitting request',
    completed: 'Completed'
  };

  return mapping[stage] || 'Preparing';
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
  const select = document.querySelector(SELECTORS.journeyHistory.dateRangeSelect);
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

function showFinalSubmitManualNotice() {
  const existing = document.querySelector(SELECTORS.navigation.finalSubmitToast);
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'sdr-final-submit-toast';
  toast.textContent = 'Final step: click Submit on this page for a valid claim.';
  toast.style.position = 'fixed';
  toast.style.right = '16px';
  toast.style.bottom = '16px';
  toast.style.padding = '8px 12px';
  toast.style.background = '#7c2d12';
  toast.style.color = '#fff';
  toast.style.borderRadius = '6px';
  toast.style.fontSize = '12px';
  toast.style.zIndex = '2147483647';
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 5000);
}

async function startServiceDelayWorkflow(journeys) {
  if (!Array.isArray(journeys) || !journeys.length) {
    return { ok: false, error: 'No journeys supplied for service delay workflow.' };
  }

  const serviceDelayLink = document.querySelector(SELECTORS.navigation.serviceDelayLink);
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

  statusPanel.update('Starting service delay workflow', `Queued ${journeys.length} journey(s) for auto-fill.`);
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
    statusPanel.update('Collection complete', `Collected ${mergedJourneys.length} journeys across the last 28 days.`);
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

  const select = document.querySelector(SELECTORS.journeyHistory.dateRangeSelect);
  const submitButton = document.querySelector(SELECTORS.journeyHistory.dateRangeSubmitButton);

  if (!select || !submitButton) return;

  select.value = nextValue;
  select.dispatchEvent(new Event('change', { bubbles: true }));

  setTimeout(() => submitButton.click(), 300);

  statusPanel.update('Collecting last 28 days', `Processed ${batchCollection.processed?.length || 0} range(s), ${remainingQueue.length} remaining.`);
}

async function startCollectLast28Days() {
  if (isMyOysterCardsPage()) {
    const journeyHistoryLink = document.querySelector(SELECTORS.journeyHistory.viewJourneyHistoryLink);
    if (!journeyHistoryLink) {
      return { ok: false, error: 'View journey history link not found on My Oyster cards page.' };
    }

    await chrome.storage.local.set({
      [PENDING_COLLECT_STORAGE_KEY]: {
        active: true,
        startedAt: new Date().toISOString()
      }
    });

    statusPanel.update('Opening journey history', 'Started from My Oyster cards. Navigating to View journey history now.');
    setTimeout(() => journeyHistoryLink.click(), 200);
    return { ok: true, redirected: true, requiresManualClick: false };
  }

  const select = document.querySelector(SELECTORS.journeyHistory.dateRangeSelect);
  const submitButton = document.querySelector(SELECTORS.journeyHistory.dateRangeSubmitButton);

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

  statusPanel.update('Collecting last 28 days', `Queued ${queue.length + 1} date range(s). Auto-submitting now.`);
  setTimeout(() => submitButton.click(), 300);

  return { ok: true, queuedRanges: queue.length + 1, requiresManualClick: false };
}

async function startCollectFromPendingNavigation() {
  const { pendingCollectFromMyCards } = await chrome.storage.local.get(PENDING_COLLECT_STORAGE_KEY);
  if (!pendingCollectFromMyCards?.active) return;
  if (!isTfLJourneyHistoryPage()) return;

  const select = document.querySelector(SELECTORS.journeyHistory.dateRangeSelect);
  const submitButton = document.querySelector(SELECTORS.journeyHistory.dateRangeSubmitButton);
  if (!select || !submitButton) return;

  await chrome.storage.local.remove(PENDING_COLLECT_STORAGE_KEY);
  statusPanel.update('Journey history opened', 'Resuming automatic 28-day collection.');
  await startCollectLast28Days();
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

  if (message?.type === 'KILL_AUTOFILL') {
    chrome.storage.local
      .remove([CLAIM_AUTOFILL_STORAGE_KEY, 'batchCollection', PENDING_COLLECT_STORAGE_KEY])
      .then(() => {
        statusPanel.update('Kill mode activated', 'All automation queues were cleared for this tab.');
        sendResponse({ ok: true });
      })
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

  await startCollectFromPendingNavigation();

  if (isExpectedTfLPage()) {
    if (isMyOysterCardsPage()) {
      statusPanel.showReadyState('my-oyster-cards');
    } else if (isTfLJourneyHistoryPage()) {
      statusPanel.showReadyState('journey-history');
    } else if (window.location.pathname.toLowerCase().includes('/oyster/sdr')) {
      statusPanel.showReadyState('service-delay-refunds');
    } else {
      statusPanel.showReadyState('default');
    }
  }

  if (autoDetect && isTfLJourneyHistoryPage()) {
    await analyseJourneyTable();
  }

  const serviceDelayWorkflow = new ServiceDelayWorkflow(
    {
      get: (keys) => chrome.storage.local.get(keys),
      set: (items) => chrome.storage.local.set(items),
      remove: (keys) => chrome.storage.local.remove(keys)
    },
    {
      query: (selector) => document.querySelector(selector),
      queryAll: (selector) => document.querySelectorAll(selector),
      createEvent: (type) => new Event(type, { bubbles: true }),
      setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
      selectOptionByText,
      setSelectValue,
      formatJourneyDate,
      extractTimeFromJourneyDate,
      extractEndTimeFromJourney,
      calculateDelayWithBuffer,
      getReadableWorkflowStage,
      claimAutofillStorageKey: CLAIM_AUTOFILL_STORAGE_KEY
    },
    {
      update: (status, detail) => statusPanel.update(status, detail),
      showWorkflowProgress: (completed, remaining) => statusPanel.showWorkflowProgress(completed, remaining),
      showFinalSubmitManualNotice
    }
  );

  await serviceDelayWorkflow.handlePage();
})();
