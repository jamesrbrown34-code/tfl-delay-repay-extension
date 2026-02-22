import { getEligibleJourneys } from './utils/delayEngine.js';
import { estimateRefund, estimateTotalRefund } from './utils/fareEstimator.js';
import { buildBatchSnippet } from './utils/claimSnippet.js';

const analyseButton = document.getElementById('analyseButton');
const autoDetectToggle = document.getElementById('autoDetectToggle');
const summaryBox = document.getElementById('summaryBox');
const journeysList = document.getElementById('journeysList');
const claimSnippet = document.getElementById('claimSnippet');
const copyButton = document.getElementById('copyButton');
const adBanner = document.getElementById('adBanner');
const exportPdfButton = document.getElementById('exportPdfButton');

let currentEligible = [];

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

async function analyseFromPage() {
  const tab = await getActiveTfLTab();
  if (!tab?.id) throw new Error('No active tab found.');

  const response = await chrome.tabs.sendMessage(tab.id, { type: 'ANALYSE_JOURNEYS' });

  if (!response?.ok) {
    const fallback = await fetch(chrome.runtime.getURL('data/mockJourneys.json')).then((r) => r.json());
    return {
      parsedJourneys: fallback,
      eligibleJourneys: getEligibleJourneys(fallback)
    };
  }

  return response;
}

async function refreshSettings() {
  const settingsResponse = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  const settings = settingsResponse?.settings || { isPaidTier: false, autoDetectOnLoad: false, showAds: true };

  autoDetectToggle.checked = Boolean(settings.autoDetectOnLoad);
  autoDetectToggle.disabled = !settings.isPaidTier;

  adBanner.style.display = settings.isPaidTier ? 'none' : 'block';
  exportPdfButton.disabled = !settings.isPaidTier;
}

analyseButton.addEventListener('click', async () => {
  try {
    const { eligibleJourneys } = await analyseFromPage();
    currentEligible = eligibleJourneys;
    renderJourneys(currentEligible);
    renderSummary(currentEligible);
    claimSnippet.value = buildBatchSnippet(currentEligible);
  } catch (error) {
    summaryBox.innerHTML = `<p>Analysis failed: ${error.message}</p>`;
  }
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
