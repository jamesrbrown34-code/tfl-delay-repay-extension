import { getEligibleJourneys, getEligibleJourneysIgnoringMinDelay } from './utils/delayEngine.js';
import { estimateRefund, estimateTotalRefund } from './utils/fareEstimator.js';
import { TierService } from './utils/tierService.js';

const runFullFlowButton = document.getElementById('runFullFlowButton');
const testModeToggle = document.getElementById('testModeToggle');
const killModeButton = document.getElementById('killModeButton');
const autoDetectToggle = document.getElementById('autoDetectToggle');
const testModeRealJourneysToggle = document.getElementById('testModeRealJourneysToggle');
const summaryBox = document.getElementById('summaryBox');
const journeysList = document.getElementById('journeysList');
const eligibleJourneysForManualUploadList = document.getElementById('eligibleJourneysForManualUploadList');
const eligibleJourneysForManualUploadMeta = document.getElementById('eligibleJourneysForManualUploadMeta');
const adBanner = document.getElementById('adBanner');
const currentTierLabel = document.getElementById('currentTierLabel');
const actualTierLabel = document.getElementById('actualTierLabel');
const tierModeInputs = Array.from(document.querySelectorAll('input[name="tierMode"]'));
const tokenInput = document.getElementById('tokenInput');
const tokenSubmitButton = document.getElementById('tokenSubmitButton');
const tokenMessage = document.getElementById('tokenMessage');
const ELIGIBLE_JOURNEYS_STORAGE_KEY = 'eligibleJourneysForManualUpload';

let currentEligible = [];
let testModeEnabled = false;
let testModeRealJourneysEnabled = false;
let currentTierService = new TierService('free');
let currentManualUploadPayload = null;
const manualTokenTierService = new TierService('free');

function setTokenMessage(text, isError = false) {
  if (!tokenMessage) return;
  tokenMessage.textContent = text;
  tokenMessage.style.color = isError ? '#b00020' : '#0b6e2e';
}

function isWithinDays(journeyDate, historyDays, now = new Date()) {
  const parsed = new Date(journeyDate);
  if (Number.isNaN(parsed.getTime())) return false;

  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - historyDays);

  parsed.setHours(0, 0, 0, 0);
  return parsed >= cutoff;
}

function applyTierFilter(journeys, tierService) {
  if (tierService.canAccessFullHistory()) return journeys;
  return journeys.filter((journey) => isWithinDays(journey.journeyDate, 7));
}


async function persistEligibleJourneysForManualUpload(journeys) {
  if (!Array.isArray(journeys)) return;

  await chrome.storage.local.set({
    [ELIGIBLE_JOURNEYS_STORAGE_KEY]: {
      savedAt: new Date().toISOString(),
      journeys
    }
  });

  await refreshEligibleJourneysForManualUpload();
}


async function clearEligibleJourneysForManualUpload() {
  await chrome.storage.local.remove(ELIGIBLE_JOURNEYS_STORAGE_KEY);
}

function renderStoredEligibleJourneys(payload) {
  if (!eligibleJourneysForManualUploadList || !eligibleJourneysForManualUploadMeta) return;

  const journeys = Array.isArray(payload?.journeys) ? payload.journeys : [];
  eligibleJourneysForManualUploadList.innerHTML = '';

  if (!journeys.length) {
    eligibleJourneysForManualUploadMeta.textContent = 'No locally stored journeys.';
    eligibleJourneysForManualUploadList.innerHTML = '<p>No saved manual-upload journeys.</p>';
    return;
  }

  eligibleJourneysForManualUploadMeta.textContent = payload.savedAt
    ? `Saved at: ${new Date(payload.savedAt).toLocaleString()}`
    : 'Saved journeys (timestamp unavailable).';

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

  eligibleJourneysForManualUploadList.append(...cards);
}

async function refreshEligibleJourneysForManualUpload() {
  const stored = await chrome.storage.local.get(ELIGIBLE_JOURNEYS_STORAGE_KEY);
  currentManualUploadPayload = stored[ELIGIBLE_JOURNEYS_STORAGE_KEY] || null;
  renderStoredEligibleJourneys(currentManualUploadPayload);
}

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

function renderSummary(journeys, tierService, manualUploadPayload = null) {
  const total = estimateTotalRefund(journeys).toFixed(2);
  if (tierService.isPaid()) {
    summaryBox.innerHTML = `<p><strong>${journeys.length}</strong> eligible claims · Estimated total refund: <strong>£${total}</strong> · Submission progress state: <strong>Ready</strong></p>`;
    return;
  }

  const storedCount = Array.isArray(manualUploadPayload?.journeys) ? manualUploadPayload.journeys.length : 0;
  const savedAtText = manualUploadPayload?.savedAt
    ? new Date(manualUploadPayload.savedAt).toLocaleString()
    : 'Not saved yet';

  summaryBox.innerHTML = `
    <p><strong>${journeys.length}</strong> eligible journeys in the last 7 days · Estimated total refund: <strong>£${total}</strong></p>
    <p>Upgrade to enable automatic form filling.</p>
    <p><strong>eligibleJourneysForManualUpload:</strong> ${storedCount} stored · Last saved: <strong>${savedAtText}</strong></p>
  `;
}

function renderWorkflowTracker(state, tierService) {
  if (!state || !tierService.isPaid()) return;

  const completed = state.completed || [];
  const queue = state.queue || [];
  const expectedValue = estimateTotalRefund(completed).toFixed(2);

  const tracker = document.createElement('div');
  tracker.innerHTML = `
    <p><strong>Refund tracker</strong>: ${completed.length} requested, ${queue.length} remaining.</p>
    <p>Expected value requested so far: <strong>£${expectedValue}</strong></p>
    <p>Submission progress state: <strong>${state.stage || 'unknown'}</strong></p>
  `;

  if (state.stage === 'awaiting-final-submit') {
    tracker.innerHTML += '<p><strong>Action required:</strong> On the TfL page, click <strong>Submit</strong> to create a valid claim.</p>';
  }

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

async function getCompletedBatchData(ignoreMinDelay = false) {
  const { batchCollection } = await chrome.storage.local.get('batchCollection');
  if (batchCollection?.active) return null;
  if (!batchCollection?.finishedAt) return null;
  const parsedJourneys = batchCollection.journeys || [];
  if (!parsedJourneys.length) return null;

  return {
    parsedJourneys,
    eligibleJourneys: ignoreMinDelay ? getEligibleJourneysIgnoringMinDelay(parsedJourneys) : getEligibleJourneys(parsedJourneys),
    usedBatchData: true
  };
}

async function requestCollection(historyDays) {
  const tab = await getActiveTfLTab();
  if (!tab?.id) return { ok: false };

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'COLLECT_JOURNEYS', historyDays });
    return response?.ok ? response : { ok: false };
  } catch (_error) {
    return { ok: false };
  }
}

async function analyseFromPage(tierService) {
  if (testModeEnabled) return loadMockJourneys();

  const ignoreMinDelay = testModeRealJourneysEnabled;

  const batchData = await getCompletedBatchData(ignoreMinDelay);
  if (batchData) {
    return { ...batchData, eligibleJourneys: applyTierFilter(batchData.eligibleJourneys, tierService) };
  }

  const tab = await getActiveTfLTab();
  if (!tab?.id) return ignoreMinDelay ? { parsedJourneys: [], eligibleJourneys: [], usedRealJourneyTestMode: true } : loadMockJourneys();

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'ANALYSE_JOURNEYS' });
    if (!response?.ok) return ignoreMinDelay ? { parsedJourneys: [], eligibleJourneys: [], usedRealJourneyTestMode: true } : loadMockJourneys();
    const eligibleJourneys = ignoreMinDelay
      ? getEligibleJourneysIgnoringMinDelay(response.parsedJourneys || [])
      : response.eligibleJourneys;
    return {
      ...response,
      eligibleJourneys: applyTierFilter(eligibleJourneys, tierService),
      usedRealJourneyTestMode: ignoreMinDelay
    };
  } catch (_error) {
    return ignoreMinDelay ? { parsedJourneys: [], eligibleJourneys: [], usedRealJourneyTestMode: true } : loadMockJourneys();
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
  const settings = settingsResponse?.settings || { tier: 'free', autoDetectOnLoad: false, showAds: true, testMode: false, testModeRealJourneys: false };

  await manualTokenTierService.initialize();
  const hasPaidToken = manualTokenTierService.isPaid();
  const effectiveTier = hasPaidToken ? 'paid' : settings.tier;

  currentTierService = new TierService(effectiveTier);
  currentTierLabel.textContent = `Testing Tier Mode: ${settings.tier === 'paid' ? 'Paid' : 'Free'}${hasPaidToken ? ' (overridden by manual token)' : ''}`;
  if (actualTierLabel) {
    actualTierLabel.textContent = `Actual Tier: ${currentTierService.isPaid() ? 'Paid' : 'Free'}${hasPaidToken ? ' (valid token)' : ''}`;
  }

  tierModeInputs.forEach((input) => {
    input.checked = input.value === settings.tier;
    input.disabled = hasPaidToken;
  });

  testModeEnabled = Boolean(settings.testMode);
  testModeToggle.checked = testModeEnabled;

  testModeRealJourneysEnabled = Boolean(settings.testModeRealJourneys);
  testModeRealJourneysToggle.checked = testModeRealJourneysEnabled;

  autoDetectToggle.checked = Boolean(settings.autoDetectOnLoad);
  autoDetectToggle.disabled = !currentTierService.isPaid();

  adBanner.style.display = currentTierService.isPaid() ? 'none' : 'block';
}

async function refreshWorkflowTracker() {
  const { sdrAutofillState } = await chrome.storage.local.get('sdrAutofillState');
  if (!sdrAutofillState) return;
  renderWorkflowTracker(sdrAutofillState, currentTierService);
}

async function triggerKillMode() {
  await chrome.storage.local.remove(['sdrAutofillState', 'batchCollection', 'pendingCollectFromMyCards']);

  const tab = await getActiveTfLTab();
  if (tab?.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'KILL_AUTOFILL' });
    } catch (_error) {
      // The active tab may not be a TfL page/content-script target.
    }
  }

  summaryBox.innerHTML = '<p><strong>Kill mode activated.</strong> Cleared all queued automation state. If a TfL page is open, automation has been stopped there too.</p>';
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

killModeButton.addEventListener('click', async () => {
  killModeButton.disabled = true;
  try {
    await triggerKillMode();
    await refreshWorkflowTracker();
  } finally {
    killModeButton.disabled = false;
  }
});

runFullFlowButton.addEventListener('click', async () => {
  runFullFlowButton.disabled = true;

  try {
    await clearEligibleJourneysForManualUpload();
    await refreshEligibleJourneysForManualUpload();

    const historyDays = currentTierService.canAccessFullHistory() ? 28 : 7;
    summaryBox.innerHTML = `<p>Step 1/3: Starting collection for last ${historyDays} days…</p>`;
    const collectResult = await requestCollection(historyDays);
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
    const { eligibleJourneys, usedMockData, usedBatchData, usedRealJourneyTestMode } = await analyseFromPage(currentTierService);
    currentEligible = eligibleJourneys;
    if (!currentTierService.isPaid()) {
      await persistEligibleJourneysForManualUpload(currentEligible);
    }
    renderJourneys(currentEligible);
    renderSummary(currentEligible, currentTierService, currentManualUploadPayload);

    if (usedBatchData) {
      summaryBox.innerHTML += '<p>Using aggregated journeys from auto-cycled collection.</p>';
    }

    if (usedMockData) {
      summaryBox.innerHTML += '<p>Using local mock data (test mode or page analyser unavailable).</p>';
    }

    if (usedRealJourneyTestMode) {
      summaryBox.innerHTML += '<p>Using real journeys in test mode (minimum delay filter bypassed; final submit remains blocked).</p>';
    }

    if (!currentEligible.length) {
      summaryBox.innerHTML += '<p>No eligible journeys to submit.</p>';
      return;
    }

    if (!currentTierService.isPaid()) {
      summaryBox.innerHTML += '<p>Eligible journeys were saved locally so you can manually upload them later.</p>';
    }

    summaryBox.innerHTML += '<p>Step 3/3: Opening service delay refund workflow…</p>';
    const result = await startServiceDelayWorkflow(currentEligible);
    if (!result.ok) {
      summaryBox.innerHTML += `<p>Could not start workflow: ${result.error}</p>`;
      return;
    }

    summaryBox.innerHTML += currentTierService.canAutoFill()
      ? `<p>Started for ${result.queued} journey(s). Keep the TfL tab open while pages auto-fill.</p>`
      : `<p>Opened service delay refunds for ${result.queued} journey(s). Complete the form manually.</p>`;
    summaryBox.innerHTML += '<p><strong>Final step:</strong> click Submit yourself on the TfL page for a valid claim.</p>';

    await refreshWorkflowTracker();
  } finally {
    runFullFlowButton.disabled = false;
  }
});

testModeToggle.addEventListener('change', async () => {
  testModeEnabled = testModeToggle.checked;
  if (testModeEnabled) {
    testModeRealJourneysEnabled = false;
    testModeRealJourneysToggle.checked = false;
  }
  await chrome.runtime.sendMessage({
    type: 'UPDATE_SETTINGS',
    payload: { testMode: testModeEnabled, testModeRealJourneys: testModeRealJourneysEnabled }
  });
});

testModeRealJourneysToggle.addEventListener('change', async () => {
  testModeRealJourneysEnabled = testModeRealJourneysToggle.checked;
  if (testModeRealJourneysEnabled) {
    testModeEnabled = false;
    testModeToggle.checked = false;
  }
  await chrome.runtime.sendMessage({
    type: 'UPDATE_SETTINGS',
    payload: { testMode: testModeEnabled, testModeRealJourneys: testModeRealJourneysEnabled }
  });
});

autoDetectToggle.addEventListener('change', async () => {
  await chrome.runtime.sendMessage({
    type: 'UPDATE_SETTINGS',
    payload: { autoDetectOnLoad: autoDetectToggle.checked }
  });
});

tierModeInputs.forEach((input) => {
  input.addEventListener('change', async () => {
    if (!input.checked) return;
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      payload: { tier: input.value }
    });
    await refreshSettings();
  });
});

if (tokenSubmitButton) {
  tokenSubmitButton.addEventListener('click', async () => {
    const token = tokenInput?.value?.trim() || '';
    const result = await manualTokenTierService.saveToken(token);

    if (!result.valid) {
      setTokenMessage(`Invalid token: ${result.reason}`, true);
      return;
    }

    setTokenMessage(`Token accepted. Paid access active until ${result.exp}.`);
    if (tokenInput) tokenInput.value = '';
    await refreshSettings();
  });
}

refreshSettings();
refreshWorkflowTracker();
refreshEligibleJourneysForManualUpload();
