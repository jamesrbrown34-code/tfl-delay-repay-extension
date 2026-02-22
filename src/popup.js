import { getEligibleJourneys } from './utils/delayEngine.js';
import { estimateRefund, estimateTotalRefund } from './utils/fareEstimator.js';

const runFullFlowButton = document.getElementById('runFullFlowButton');
const testModeToggle = document.getElementById('testModeToggle');
const autoDetectToggle = document.getElementById('autoDetectToggle');
const summaryBox = document.getElementById('summaryBox');
const journeysList = document.getElementById('journeysList');
const adBanner = document.getElementById('adBanner');

let currentEligible = [];
let testModeEnabled = false;

function renderJourneys(journeys) {
  journeysList.innerHTML = '';
  if (!journeys.length) {
    journeysList.innerHTML = '<p>No eligible journeys found.</p>';
    return;
  }

  const cards = journeys.map((journey) => {
    const card = document.createElement('article');
    card.className = 'journey-card';
    card.innerHTML = `
      <strong>${journey.journeyDate}: ${journey.from} → ${journey.to}</strong><br>
      Delay: ${journey.delayMinutes} min · Ticket: ${journey.ticketType}<br>
      Estimated refund: £${estimateRefund(journey).toFixed(2)}
    `;
    return card;
  });

  journeysList.append(...cards);
}

function renderSummary(journeys) {
  const total = estimateTotalRefund(journeys).toFixed(2);
  summaryBox.innerHTML = `<p><strong>${journeys.length}</strong> eligible journeys · Estimated total refund: <strong>£${total}</strong></p>`;
}

function renderWorkflowTracker(state) {
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

async function getActiveTfLTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function loadMockJourneys() {
  const fallback = await fetch(chrome.runtime.getURL('data/mockJourneys.json')).then((response) => response.json());
  return {
    parsedJourneys: fallback,
    eligibleJourneys: getEligibleJourneys(fallback),
    usedMockData: true
  };
}

async function getCompletedBatchData() {
  const { batchCollection } = await chrome.storage.local.get('batchCollection');
  if (batchCollection?.active) return null;
  if (!batchCollection?.finishedAt) return null;
  const parsedJourneys = batchCollection.journeys || [];
  if (!parsedJourneys.length) return null;

  return {
    parsedJourneys,
    eligibleJourneys: getEligibleJourneys(parsedJourneys),
    usedBatchData: true
  };
}

async function request28DaysCollection() {
  const tab = await getActiveTfLTab();
  if (!tab?.id) return { ok: false };

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'COLLECT_LAST_28_DAYS' });
    return response?.ok ? response : { ok: false };
  } catch (_error) {
    return { ok: false };
  }
}

async function analyseFromPage() {
  if (testModeEnabled) return loadMockJourneys();

  const batchData = await getCompletedBatchData();
  if (batchData) return batchData;

  const tab = await getActiveTfLTab();
  if (!tab?.id) return loadMockJourneys();

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'ANALYSE_JOURNEYS' });
    if (!response?.ok) return loadMockJourneys();
    return response;
  } catch (_error) {
    return loadMockJourneys();
  }
}

async function startServiceDelayWorkflow(journeys) {
  const tab = await getActiveTfLTab();
  if (!tab?.id) return { ok: false, error: 'No active tab.' };

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'START_SERVICE_DELAY_WORKFLOW',
      journeys
    });

    return response?.ok ? response : { ok: false, error: response?.error || 'Could not start workflow.' };
  } catch (_error) {
    return { ok: false, error: 'Could not connect to TfL page content script.' };
  }
}

async function refreshSettings() {
  const settingsResponse = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  const settings = settingsResponse?.settings || { isPaidTier: false, autoDetectOnLoad: false, showAds: true, testMode: false };

  testModeEnabled = Boolean(settings.testMode);
  testModeToggle.checked = testModeEnabled;

  autoDetectToggle.checked = Boolean(settings.autoDetectOnLoad);
  autoDetectToggle.disabled = !settings.isPaidTier;

  adBanner.style.display = settings.isPaidTier ? 'none' : 'block';
}

async function refreshWorkflowTracker() {
  const { sdrAutofillState } = await chrome.storage.local.get('sdrAutofillState');
  if (!sdrAutofillState) return;
  renderWorkflowTracker(sdrAutofillState);
}

async function waitForBatchCompletion(maxWaitMs = 70000) {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const { batchCollection } = await chrome.storage.local.get('batchCollection');
    if (batchCollection?.finishedAt && !batchCollection?.active) {
      return { ok: true };
    }

    await new Promise((resolve) => setTimeout(resolve, 1250));
  }

  return { ok: false };
}

runFullFlowButton.addEventListener('click', async () => {
  runFullFlowButton.disabled = true;

  try {
    summaryBox.innerHTML = '<p>Step 1/3: Starting collection for last 28 days…</p>';
    const collectResult = await request28DaysCollection();
    if (!collectResult.ok) {
      summaryBox.innerHTML = '<p>Could not start full flow. Open My Oyster cards or Journey history and try again.</p>';
      return;
    }

    summaryBox.innerHTML = '<p>Step 1/3: Collecting journeys… leave the TfL tab open.</p>';
    const collected = await waitForBatchCompletion();
    if (!collected.ok && !testModeEnabled) {
      summaryBox.innerHTML = '<p>Collection is still running. Keep the TfL tab open, then click Run Full Flow again.</p>';
      return;
    }

    summaryBox.innerHTML = '<p>Step 2/3: Analysing eligible journeys…</p>';
    const { eligibleJourneys, usedMockData, usedBatchData } = await analyseFromPage();
    currentEligible = eligibleJourneys;
    renderJourneys(currentEligible);
    renderSummary(currentEligible);

    if (usedBatchData) {
      summaryBox.innerHTML += '<p>Using aggregated journeys from auto-cycled 28-day collection.</p>';
    }

    if (usedMockData) {
      summaryBox.innerHTML += '<p>Using local mock data (test mode or page analyser unavailable).</p>';
    }

    if (!currentEligible.length) {
      summaryBox.innerHTML += '<p>No eligible journeys to submit.</p>';
      return;
    }

    summaryBox.innerHTML += '<p>Step 3/3: Starting service delay auto-fill workflow…</p>';
    const result = await startServiceDelayWorkflow(currentEligible);
    if (!result.ok) {
      summaryBox.innerHTML += `<p>Could not start workflow: ${result.error}</p>`;
      return;
    }

    summaryBox.innerHTML += result.requiresManualClick
      ? `<p>Started for ${result.queued} journey(s) in test mode. Submit is skipped and loop continues via Service delay refunds.</p>`
      : `<p>Started for ${result.queued} journey(s). Keep the TfL tab open while pages auto-fill.</p>`;

    await refreshWorkflowTracker();
  } finally {
    runFullFlowButton.disabled = false;
  }
});

testModeToggle.addEventListener('change', async () => {
  testModeEnabled = testModeToggle.checked;
  await chrome.runtime.sendMessage({
    type: 'UPDATE_SETTINGS',
    payload: { testMode: testModeEnabled }
  });
});

autoDetectToggle.addEventListener('change', async () => {
  await chrome.runtime.sendMessage({
    type: 'UPDATE_SETTINGS',
    payload: { autoDetectOnLoad: autoDetectToggle.checked }
  });
});

refreshSettings();
refreshWorkflowTracker();
