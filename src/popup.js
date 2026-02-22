import { getEligibleJourneys } from './utils/delayEngine.js';
import { estimateRefund, estimateTotalRefund } from './utils/fareEstimator.js';
import { buildBatchSnippet } from './utils/claimSnippet.js';

const analyseButton = document.getElementById('analyseButton');
const last7DaysButton = document.getElementById('last7DaysButton');
const testModeToggle = document.getElementById('testModeToggle');
const autoDetectToggle = document.getElementById('autoDetectToggle');
const summaryBox = document.getElementById('summaryBox');
const journeysList = document.getElementById('journeysList');
const claimSnippet = document.getElementById('claimSnippet');
const copyButton = document.getElementById('copyButton');
const adBanner = document.getElementById('adBanner');
const exportPdfButton = document.getElementById('exportPdfButton');

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

async function requestLast7DaysRefresh() {
  const tab = await getActiveTfLTab();
  if (!tab?.id) return { ok: false };

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'LOAD_LAST_7_DAYS' });
    return response?.ok ? response : { ok: false };
  } catch (_error) {
    return { ok: false };
  }
}

async function analyseFromPage() {
  if (testModeEnabled) {
    return loadMockJourneys();
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

async function refreshSettings() {
  const settingsResponse = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  const settings = settingsResponse?.settings || { isPaidTier: false, autoDetectOnLoad: false, showAds: true, testMode: false };

  testModeEnabled = Boolean(settings.testMode);
  testModeToggle.checked = testModeEnabled;

  autoDetectToggle.checked = Boolean(settings.autoDetectOnLoad);
  autoDetectToggle.disabled = !settings.isPaidTier;

  adBanner.style.display = settings.isPaidTier ? 'none' : 'block';
  exportPdfButton.disabled = !settings.isPaidTier;
}

last7DaysButton.addEventListener('click', async () => {
  const result = await requestLast7DaysRefresh();
  if (result.ok) {
    summaryBox.innerHTML = '<p>Submitted date range on Oyster page. Now click Analyse Delays.</p>';
  } else {
    summaryBox.innerHTML = '<p>Could not click Submit on this tab. Open Oyster journey history page and try again.</p>';
  }
});

analyseButton.addEventListener('click', async () => {
  try {
    const { eligibleJourneys, usedMockData } = await analyseFromPage();
    currentEligible = eligibleJourneys;
    renderJourneys(currentEligible);
    renderSummary(currentEligible);
    claimSnippet.value = buildBatchSnippet(currentEligible);

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

copyButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText(claimSnippet.value || '');
  copyButton.textContent = 'Copied!';
  setTimeout(() => {
    copyButton.textContent = 'Copy Snippet';
  }, 1200);
});

exportPdfButton.addEventListener('click', () => {
  const data = {
    generatedAt: new Date().toISOString(),
    journeys: currentEligible,
    totalRefundEstimate: estimateTotalRefund(currentEligible)
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  chrome.downloads.download({
    url,
    filename: 'tfl-delay-claim-summary.json',
    saveAs: true
  });
});

refreshSettings();
