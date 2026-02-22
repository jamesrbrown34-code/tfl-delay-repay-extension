const CLAIM_WINDOW_DAYS = 28;
const MIN_DELAY_MINUTES = 15;
const CLAIM_AUTOFILL_BUFFER_MINUTES = 5;
const CLAIM_AUTOFILL_STORAGE_KEY = 'sdrAutofillState';
const PENDING_COLLECT_STORAGE_KEY = 'pendingCollectFromMyCards';
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

function parseStationPairFromAction(actionText = '') {
  const match = actionText.match(/(.+?)\s+to\s+(.+)/i);
  if (!match) return null;

  const from = match[1].trim();
  const to = match[2].trim();
  if (!from || !to) return null;

  return { from, to };
}

function parseDateLabelToDdMmYyyy(text = '') {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  const match = normalized.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!match) return null;

  const monthMap = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12
  };

  const day = Number(match[1]);
  const month = monthMap[match[2].toLowerCase()];
  const year = Number(match[3]);
  if (!day || !month || !year) return null;

  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

function parseTimeRangeStart(timeCell = '') {
  const match = String(timeCell).match(/(\d{1,2})[:.](\d{2})\s*[-–]/);
  if (!match) return null;
  return {
    hours: Number(match[1]),
    mins: Number(match[2])
  };
}

function parseTimeRangeEnd(timeCell = '') {
  const match = String(timeCell).match(/[-–]\s*(\d{1,2})[:.](\d{2})/);
  if (!match) return null;
  return {
    hours: Number(match[1]),
    mins: Number(match[2])
  };
}

function parseJourneyRows() {
  const rows = Array.from(document.querySelectorAll('table tbody tr'));
  let currentDateLabel = null;

  return rows
    .map((row) => {
      const cells = row.querySelectorAll('td');
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

function isMyOysterCardsPage() {
  const heading = document.querySelector('h1');
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
    'refund-type-selected': 'Selecting refund type',
    submitted: 'Submitting request',
    completed: 'Completed'
  };

  return mapping[stage] || 'Preparing';
}

function ensureStatusPanel() {
  if (!isExpectedTfLPage()) return null;

  let panel = document.querySelector('#tfl-delay-helper-panel');
  if (panel) return panel;

  panel = document.createElement('div');
  panel.id = 'tfl-delay-helper-panel';
  panel.style.position = 'fixed';
  panel.style.top = '16px';
  panel.style.right = '16px';
  panel.style.zIndex = '2147483647';
  panel.style.background = '#0f766e';
  panel.style.color = '#fff';
  panel.style.borderRadius = '10px';
  panel.style.padding = '10px 12px';
  panel.style.fontSize = '12px';
  panel.style.width = '280px';
  panel.style.boxShadow = '0 4px 14px rgba(0,0,0,0.15)';
  panel.innerHTML = '<strong>TubeRefund</strong><div id="tfl-delay-helper-panel-status" style="margin-top:4px;line-height:1.4"></div>';
  document.body.appendChild(panel);
  return panel;
}

function updateStatusPanel(status, detail = '') {
  const panel = ensureStatusPanel();
  if (!panel) return;

  const statusNode = panel.querySelector('#tfl-delay-helper-panel-status');
  if (!statusNode) return;

  statusNode.innerHTML = detail ? `${status}<br><span style="opacity:0.9">${detail}</span>` : status;
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
  const normalized = String(rawDate || '').trim();
  const ddMmYyyyMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!ddMmYyyyMatch) return null;

  const day = Number(ddMmYyyyMatch[1]);
  const month = Number(ddMmYyyyMatch[2]);
  const year = Number(ddMmYyyyMatch[3]);

  if (!day || !month || !year) return null;

  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getDate() !== day || parsed.getMonth() !== month - 1 || parsed.getFullYear() !== year) return null;

  return parsed;
}

function formatDateAsDdMmYyyy(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

function extractTimeFromJourneyDate(journey = {}) {
  if (journey?.startTime && Number.isFinite(journey.startTime.hours) && Number.isFinite(journey.startTime.mins)) {
    return {
      hours: journey.startTime.hours,
      mins: journey.startTime.mins
    };
  }

  const match = String(journey?.journeyDate || '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return { hours: 12, mins: 0 };
  return {
    hours: Number(match[1]),
    mins: Number(match[2])
  };
}

function extractEndTimeFromJourney(journey = {}) {
  if (journey?.endTime && Number.isFinite(journey.endTime.hours) && Number.isFinite(journey.endTime.mins)) {
    return {
      hours: journey.endTime.hours,
      mins: journey.endTime.mins
    };
  }

  const start = extractTimeFromJourneyDate(journey);
  const expected = Number(journey?.actualMinutes || journey?.expectedMinutes || 0);
  const startTotal = start.hours * 60 + start.mins;
  const endTotal = Math.max(startTotal, startTotal + expected);

  return {
    hours: Math.floor((endTotal % (24 * 60)) / 60),
    mins: endTotal % 60
  };
}

function formatJourneyDate(rawDate) {
  const parsedDdMmYyyy = parseDdMmYyyyToDate(rawDate);
  if (parsedDdMmYyyy) return formatDateAsDdMmYyyy(parsedDdMmYyyy);

  const parsedLabel = parseDateLabelToDdMmYyyy(rawDate);
  if (parsedLabel) return parsedLabel;

  const parsedGeneric = new Date(String(rawDate || '').replace(/(\d{1,2}:\d{2}).*$/, '').trim());
  if (!Number.isNaN(parsedGeneric.getTime())) {
    return formatDateAsDdMmYyyy(parsedGeneric);
  }

  return formatDateAsDdMmYyyy(new Date());
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

function clickFinalSubmitWithTestModeGuard(button, settings, fallbackMessage) {
  if (!button) return { ok: false, error: fallbackMessage };

  if (settings?.testMode) {
    return { ok: true, requiresManualClick: true };
  }

  setTimeout(() => button.click(), 250);
  return { ok: true, requiresManualClick: false };
}

function findFinalSubmitButton() {
  const byValue = document.querySelector('button[type="submit"][value="Submit"],input[type="submit"][value="Submit"]');
  if (byValue) return byValue;

  return Array.from(document.querySelectorAll('button[type="submit"],input[type="submit"]')).find((element) => {
    const text = (element.textContent || element.value || '').toLowerCase().trim();
    return text === 'submit';
  }) || null;
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

  setTimeout(() => nextPageButton.click(), 250);
  return true;
}

function fillJourneyDetailsForm(journey, settings) {
  const lineSelect = document.querySelector('#tflNetworkLine');
  const startSelect = document.querySelector('#startStationNlc');
  const endSelect = document.querySelector('#endStationNlc');
  const dateInput = document.querySelector('#journeyStartDate');
  const hourSelect = document.querySelector('#journeyStartDate_hh');
  const minuteSelect = document.querySelector('#journeyStartDate_mins');
  const endDateInput = document.querySelector('#journeyEndDate');
  const endHourSelect = document.querySelector('#journeyEndDate_hh');
  const endMinuteSelect = document.querySelector('#journeyEndDate_mins');
  const delayHourSelect = document.querySelector('#lengthOfDelay_hh');
  const delayMinuteSelect = document.querySelector('#lengthOfDelay_mins');

  if (!lineSelect || !startSelect || !endSelect || !dateInput || !hourSelect || !minuteSelect || !endDateInput || !endHourSelect || !endMinuteSelect || !delayHourSelect || !delayMinuteSelect) {
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

  const startTime = extractTimeFromJourneyDate(journey);
  const startHour = startTime.hours;
  const startMinute = startTime.mins;
  setSelectValue(hourSelect, startHour);
  setSelectValue(minuteSelect, startMinute);

  endDateInput.value = formatJourneyDate(journey.journeyDate);
  endDateInput.dispatchEvent(new Event('input', { bubbles: true }));
  endDateInput.dispatchEvent(new Event('change', { bubbles: true }));

  const endTime = extractEndTimeFromJourney(journey);
  setSelectValue(endHourSelect, endTime.hours);
  setSelectValue(endMinuteSelect, endTime.mins);

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

  setTimeout(() => nextPageButton.click(), 250);
  return {
    ok: true,
    submitted: journey,
    remaining: remaining.length,
    requiresManualClick: false
  };
}

async function fillRefundTypeStep(state) {
  const refundToCardRadio = document.querySelector('#ahlRefundType');
  if (!refundToCardRadio) {
    return { ok: false, error: 'Refund-to-card option was not found on page.' };
  }

  refundToCardRadio.checked = true;
  refundToCardRadio.dispatchEvent(new Event('input', { bubbles: true }));
  refundToCardRadio.dispatchEvent(new Event('change', { bubbles: true }));

  await chrome.storage.local.set({
    [CLAIM_AUTOFILL_STORAGE_KEY]: {
      ...state,
      stage: 'refund-type-selected',
      refundTypeSelectedAt: new Date().toISOString()
    }
  });

  return { ok: true, selected: 'FUL' };
}

function showTestModeRefundSubmittedNotice() {
  console.log('refund submitted');

  const existing = document.querySelector('#sdr-testmode-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'sdr-testmode-toast';
  toast.textContent = 'refund submitted';
  toast.style.position = 'fixed';
  toast.style.right = '16px';
  toast.style.bottom = '16px';
  toast.style.padding = '8px 12px';
  toast.style.background = '#0f766e';
  toast.style.color = '#fff';
  toast.style.borderRadius = '6px';
  toast.style.fontSize = '12px';
  toast.style.zIndex = '2147483647';
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2000);
}

async function fillFinalSubmitStep(state, settings) {
  const finalSubmitButton = findFinalSubmitButton();
  if (!finalSubmitButton) return { ok: false, error: 'Final Submit button was not found.' };

  const clickResult = clickFinalSubmitWithTestModeGuard(finalSubmitButton, settings, 'Final Submit button was not found.');

  if (clickResult.requiresManualClick) {
    showTestModeRefundSubmittedNotice();

    const hasRemainingJourneys = Boolean(state?.queue?.length);
    const nextStage = hasRemainingJourneys ? 'card-selection' : 'completed';

    await chrome.storage.local.set({
      [CLAIM_AUTOFILL_STORAGE_KEY]: {
        ...state,
        active: hasRemainingJourneys,
        stage: nextStage,
        finalSubmitAttemptedAt: new Date().toISOString(),
        simulatedSubmitAt: new Date().toISOString()
      }
    });

    if (hasRemainingJourneys) {
      const backButton =
        Array.from(document.querySelectorAll('a.btn.btn-default')).find((link) => (link.textContent || '').trim().toLowerCase() === 'back') ||
        document.querySelector('a[href*="/oyster/sdr.do"].btn.btn-default');
      const serviceDelayLink = backButton || document.querySelector('a[href*="/oyster/sdr.do"]') || document.querySelector('#navSDR');
      if (serviceDelayLink) {
        setTimeout(() => serviceDelayLink.click(), 250);
      }
    }

    updateStatusPanel(
      hasRemainingJourneys ? 'Test mode: loop continues' : 'Test mode complete',
      hasRemainingJourneys ? `Completed ${state.completed?.length || 0}. Clicking Back to return to Service delay refunds for next journey.` : 'No journeys remaining.'
    );

    return { ok: true, requiresManualClick: true, continued: hasRemainingJourneys };
  }

  await chrome.storage.local.set({
    [CLAIM_AUTOFILL_STORAGE_KEY]: {
      ...state,
      stage: 'submitted',
      finalSubmitAttemptedAt: new Date().toISOString()
    }
  });

  updateStatusPanel('Refund submitted', `Completed ${state.completed?.length || 0} journey(s) so far.`);
  return { ok: clickResult.ok, requiresManualClick: false };
}

async function runServiceDelayAutofill() {
  const { sdrAutofillState, settings } = await chrome.storage.local.get([CLAIM_AUTOFILL_STORAGE_KEY, 'settings']);
  if (!sdrAutofillState?.active) return;

  const inCardSelection = Boolean(document.querySelector('#oysterCardId'));
  const inJourneyDetails = Boolean(document.querySelector('#tflNetworkLine'));
  const inRefundTypeStep = Boolean(document.querySelector('#ahlRefundType'));
  const inFinalSubmitStep = Boolean(findFinalSubmitButton());

  if (inCardSelection) {
    updateStatusPanel(getReadableWorkflowStage('card-selection'), `Submitted ${sdrAutofillState.completed?.length || 0}, remaining ${sdrAutofillState.queue?.length || 0}.`);
    await fillCardSelectionStep(sdrAutofillState, settings);
    return;
  }

  if (inJourneyDetails) {
    updateStatusPanel(getReadableWorkflowStage('journey-details'), `Submitted ${sdrAutofillState.completed?.length || 0}, remaining ${sdrAutofillState.queue?.length || 0}.`);
    await fillJourneyDetailsStep(sdrAutofillState);
    return;
  }

  if (inRefundTypeStep) {
    updateStatusPanel(getReadableWorkflowStage('refund-type-selected'), 'Selecting refund to card option.');
    await fillRefundTypeStep(sdrAutofillState);
    return;
  }

  if (inFinalSubmitStep) {
    updateStatusPanel('Ready to submit refund request', settings?.testMode ? 'Test mode: Submit will be skipped and loop continues.' : 'Submitting this request now.');
    await fillFinalSubmitStep(sdrAutofillState, settings);
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

  updateStatusPanel('Starting service delay workflow', `Queued ${journeys.length} journey(s) for auto-fill.`);
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
    updateStatusPanel('Collection complete', `Collected ${mergedJourneys.length} journeys across the last 28 days.`);
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

  updateStatusPanel('Collecting last 28 days', `Processed ${batchCollection.processed?.length || 0} range(s), ${remainingQueue.length} remaining.`);
}

async function startCollectLast28Days() {
  if (isMyOysterCardsPage()) {
    const journeyHistoryLink = document.querySelector('a[href*="journeyHistoryThrottle.do"]');
    if (!journeyHistoryLink) {
      return { ok: false, error: 'View journey history link not found on My Oyster cards page.' };
    }

    await chrome.storage.local.set({
      [PENDING_COLLECT_STORAGE_KEY]: {
        active: true,
        startedAt: new Date().toISOString()
      }
    });

    updateStatusPanel('Opening journey history', 'Started from My Oyster cards. Navigating to View journey history now.');
    setTimeout(() => journeyHistoryLink.click(), 200);
    return { ok: true, redirected: true, requiresManualClick: false };
  }

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

  updateStatusPanel('Collecting last 28 days', `Queued ${queue.length + 1} date range(s). Auto-submitting now.`);
  setTimeout(() => submitButton.click(), 300);

  return { ok: true, queuedRanges: queue.length + 1, requiresManualClick: false };
}

async function startCollectFromPendingNavigation() {
  const { pendingCollectFromMyCards } = await chrome.storage.local.get(PENDING_COLLECT_STORAGE_KEY);
  if (!pendingCollectFromMyCards?.active) return;
  if (!isTfLJourneyHistoryPage()) return;

  const select = document.querySelector('#date-range');
  const submitButton = document.querySelector('#date-range-button');
  if (!select || !submitButton) return;

  await chrome.storage.local.remove(PENDING_COLLECT_STORAGE_KEY);
  updateStatusPanel('Journey history opened', 'Resuming automatic 28-day collection.');
  await startCollectLast28Days();
}

function injectTfLHelperPanel() {
  if (!isExpectedTfLPage()) return;

  if (isMyOysterCardsPage()) {
    updateStatusPanel('Ready on My Oyster cards', 'Use Run full flow in the extension popup to open journey history and begin collection.');
    return;
  }

  if (isTfLJourneyHistoryPage()) {
    updateStatusPanel('Ready on Journey history', 'Waiting for collection/analyse command from the extension popup.');
    return;
  }

  if (window.location.pathname.toLowerCase().includes('/oyster/sdr')) {
    updateStatusPanel('Service delay refunds page detected', 'Auto-fill will continue while this tab remains open.');
    return;
  }

  updateStatusPanel('TubeRefund active');
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

  await startCollectFromPendingNavigation();

  injectTfLHelperPanel();

  if (autoDetect && isTfLJourneyHistoryPage()) {
    await analyseJourneyTable();
  }

  await runServiceDelayAutofill();
})();
