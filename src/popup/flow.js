import {
  analyseFromPage,
  request28DaysCollection,
  startServiceDelayWorkflow,
  waitForBatchCompletion
} from './chromeApi.js';
import { appendInfo, renderJourneys, renderSummary, setSummary } from './render.js';

export async function runFullFlow(elements, state, refreshWorkflowTracker) {
  const { summaryBox, journeysList } = elements;

  setSummary(summaryBox, 'Step 1/3: Starting collection for last 28 days…');
  const collectResult = await request28DaysCollection();

  if (!collectResult.ok) {
    setSummary(summaryBox, 'Could not start full flow. Open My Oyster cards or Journey history and try again.');
    return;
  }

  setSummary(summaryBox, 'Step 1/3: Collecting journeys… leave the TfL tab open.');
  const collected = await waitForBatchCompletion();
  if (!collected.ok && !state.testModeEnabled) {
    setSummary(summaryBox, 'Collection is still running. Keep the TfL tab open, then click Run Full Flow again.');
    return;
  }

  setSummary(summaryBox, 'Step 2/3: Analysing eligible journeys…');
  const { eligibleJourneys, usedMockData, usedBatchData, usedRealJourneyTestMode } = await analyseFromPage(state);

  state.currentEligible = eligibleJourneys;
  renderJourneys(journeysList, state.currentEligible);
  renderSummary(summaryBox, state.currentEligible);

  if (usedBatchData) {
    appendInfo(summaryBox, 'Using aggregated journeys from auto-cycled 28-day collection.');
  }

  if (usedMockData) {
    appendInfo(summaryBox, 'Using local mock data (test mode or page analyser unavailable).');
  }

  if (usedRealJourneyTestMode) {
    appendInfo(summaryBox, 'Using real journeys in test mode (minimum delay filter bypassed; final submit remains blocked).');
  }

  if (!state.currentEligible.length) {
    appendInfo(summaryBox, 'No eligible journeys to submit.');
    return;
  }

  appendInfo(summaryBox, 'Step 3/3: Starting service delay auto-fill workflow…');
  const result = await startServiceDelayWorkflow(state.currentEligible);

  if (!result.ok) {
    appendInfo(summaryBox, `Could not start workflow: ${result.error}`);
    return;
  }

  appendInfo(
    summaryBox,
    result.requiresManualClick
      ? `Started for ${result.queued} journey(s) in test mode. Submit is skipped and loop continues via Service delay refunds.`
      : `Started for ${result.queued} journey(s). Keep the TfL tab open while pages auto-fill.`
  );

  await refreshWorkflowTracker();
}
