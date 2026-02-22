import { getPopupElements } from './popup/elements.js';
import { createPopupState } from './popup/state.js';
import {
  getRuntimeSettings,
  getWorkflowState,
  updateRuntimeSettings
} from './popup/chromeApi.js';
import { runFullFlow } from './popup/flow.js';
import { renderWorkflowTracker } from './popup/render.js';

const elements = getPopupElements();
const state = createPopupState();

async function refreshSettings() {
  const settings = await getRuntimeSettings();
  const {
    testModeToggle,
    testModeRealJourneysToggle,
    autoDetectToggle,
    adBanner
  } = elements;

  state.testModeEnabled = Boolean(settings.testMode);
  testModeToggle.checked = state.testModeEnabled;

  state.testModeRealJourneysEnabled = Boolean(settings.testModeRealJourneys);
  testModeRealJourneysToggle.checked = state.testModeRealJourneysEnabled;

  autoDetectToggle.checked = Boolean(settings.autoDetectOnLoad);
  autoDetectToggle.disabled = !settings.isPaidTier;

  adBanner.style.display = settings.isPaidTier ? 'none' : 'block';
}

async function refreshWorkflowTracker() {
  const workflowState = await getWorkflowState();
  if (!workflowState) return;
  renderWorkflowTracker(elements.summaryBox, workflowState);
}

function attachEventHandlers() {
  const {
    runFullFlowButton,
    testModeToggle,
    testModeRealJourneysToggle,
    autoDetectToggle
  } = elements;

  runFullFlowButton.addEventListener('click', async () => {
    runFullFlowButton.disabled = true;
    try {
      await runFullFlow(elements, state, refreshWorkflowTracker);
    } finally {
      runFullFlowButton.disabled = false;
    }
  });

  testModeToggle.addEventListener('change', async () => {
    state.testModeEnabled = testModeToggle.checked;
    if (state.testModeEnabled) {
      state.testModeRealJourneysEnabled = false;
      testModeRealJourneysToggle.checked = false;
    }

    await updateRuntimeSettings({
      testMode: state.testModeEnabled,
      testModeRealJourneys: state.testModeRealJourneysEnabled
    });
  });

  testModeRealJourneysToggle.addEventListener('change', async () => {
    state.testModeRealJourneysEnabled = testModeRealJourneysToggle.checked;
    if (state.testModeRealJourneysEnabled) {
      state.testModeEnabled = false;
      testModeToggle.checked = false;
    }

    await updateRuntimeSettings({
      testMode: state.testModeEnabled,
      testModeRealJourneys: state.testModeRealJourneysEnabled
    });
  });

  autoDetectToggle.addEventListener('change', async () => {
    await updateRuntimeSettings({ autoDetectOnLoad: autoDetectToggle.checked });
  });
}

attachEventHandlers();
refreshSettings();
refreshWorkflowTracker();
