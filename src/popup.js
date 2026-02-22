import { getEligibleJourneys } from './utils/delayEngine.js';
import { estimateRefund, estimateTotalRefund } from './utils/fareEstimator.js';

const analyseButton = document.getElementById('analyseButton');
const submitRefundsButton = document.getElementById('submitRefundsButton');
const collect28DaysButton = document.getElementById('collect28DaysButton');
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
  if (testModeEnabled) {
    return loadMockJourneys();
  }

  const batchData = await getCompletedBatchData();
  if (batchData) {
    return batchData;
  }

  const tab = await getActiveTfLTab();
  if (!tab?.id) {
    return loadMockJourneys();
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'ANALYSE_JOURNEYS' });

    if (!response?.ok) {
      return loadMockJourneys();
    }

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


submitRefundsButton.addEventListener('click', async () => {
  if (!currentEligible.length) {
    summaryBox.innerHTML = '<p>No eligible journeys available yet. Click Analyse Delays first.</p>';
    return;
  }

  const result = await startServiceDelayWorkflow(currentEligible);
  if (result.ok) {
    summaryBox.innerHTML = result.requiresManualClick
      ? `<p>Started service delay workflow for ${result.queued} journey(s) in test mode. Test mode active: final Submit is not clicked. A popup + console log ("refund submitted") will be shown and automation continues to the next journey.</p>`
      : `<p>Started service delay workflow for ${result.queued} journey(s). Keep the TfL tab open while pages auto-fill.</p>`;
  } else {
    summaryBox.innerHTML = `<p>Could not start service delay workflow: ${result.error}</p>`;
  }
});

collect28DaysButton.addEventListener('click', async () => {
  const result = await request28DaysCollection();
  if (result.ok) {
    summaryBox.innerHTML = '<p>Started 28-day collection. Keep the Oyster tab open while date ranges auto-submit. When done, click Analyse Delays.</p>';
  } else {
    summaryBox.innerHTML = '<p>Could not start 28-day collection on this tab. Open Oyster journey history and try again.</p>';
  }
});

analyseButton.addEventListener('click', async () => {
  try {
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
  } catch (error) {
    summaryBox.innerHTML = `<p>Analysis failed: ${error.message}</p>`;
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
