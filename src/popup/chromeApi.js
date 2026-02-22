import {
  getEligibleJourneys,
  getEligibleJourneysIgnoringMinDelay
} from '../utils/delayEngine.js';

export const DEFAULT_SETTINGS = {
  isPaidTier: false,
  autoDetectOnLoad: false,
  showAds: true,
  testMode: false,
  testModeRealJourneys: false
};

export async function getActiveTfLTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

export async function loadMockJourneys() {
  const fallback = await fetch(chrome.runtime.getURL('data/mockJourneys.json')).then((response) => response.json());

  return {
    parsedJourneys: fallback,
    eligibleJourneys: getEligibleJourneys(fallback),
    usedMockData: true
  };
}

export async function getCompletedBatchData(ignoreMinDelay = false) {
  const { batchCollection } = await chrome.storage.local.get('batchCollection');
  if (batchCollection?.active || !batchCollection?.finishedAt) return null;

  const parsedJourneys = batchCollection.journeys || [];
  if (!parsedJourneys.length) return null;

  return {
    parsedJourneys,
    eligibleJourneys: ignoreMinDelay
      ? getEligibleJourneysIgnoringMinDelay(parsedJourneys)
      : getEligibleJourneys(parsedJourneys),
    usedBatchData: true
  };
}

export async function request28DaysCollection() {
  const tab = await getActiveTfLTab();
  if (!tab?.id) return { ok: false };

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'COLLECT_LAST_28_DAYS' });
    return response?.ok ? response : { ok: false };
  } catch (_error) {
    return { ok: false };
  }
}

export async function analyseFromPage({ testModeEnabled, testModeRealJourneysEnabled }) {
  if (testModeEnabled) return loadMockJourneys();

  const ignoreMinDelay = testModeRealJourneysEnabled;
  const batchData = await getCompletedBatchData(ignoreMinDelay);
  if (batchData) return batchData;

  const tab = await getActiveTfLTab();
  if (!tab?.id) {
    return ignoreMinDelay
      ? { parsedJourneys: [], eligibleJourneys: [], usedRealJourneyTestMode: true }
      : loadMockJourneys();
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'ANALYSE_JOURNEYS' });
    if (!response?.ok) {
      return ignoreMinDelay
        ? { parsedJourneys: [], eligibleJourneys: [], usedRealJourneyTestMode: true }
        : loadMockJourneys();
    }

    const eligibleJourneys = ignoreMinDelay
      ? getEligibleJourneysIgnoringMinDelay(response.parsedJourneys || [])
      : response.eligibleJourneys;

    return { ...response, eligibleJourneys, usedRealJourneyTestMode: ignoreMinDelay };
  } catch (_error) {
    return ignoreMinDelay
      ? { parsedJourneys: [], eligibleJourneys: [], usedRealJourneyTestMode: true }
      : loadMockJourneys();
  }
}

export async function startServiceDelayWorkflow(journeys) {
  const tab = await getActiveTfLTab();
  if (!tab?.id) return { ok: false, error: 'No active tab.' };

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'START_SERVICE_DELAY_WORKFLOW',
      journeys
    });

    return response?.ok
      ? response
      : { ok: false, error: response?.error || 'Could not start workflow.' };
  } catch (_error) {
    return { ok: false, error: 'Could not connect to TfL page content script.' };
  }
}

export async function waitForBatchCompletion(maxWaitMs = 70000) {
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

export async function getRuntimeSettings() {
  const settingsResponse = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  return settingsResponse?.settings || DEFAULT_SETTINGS;
}

export async function updateRuntimeSettings(payload) {
  return chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload });
}

export async function getWorkflowState() {
  const { sdrAutofillState } = await chrome.storage.local.get('sdrAutofillState');
  return sdrAutofillState;
}
