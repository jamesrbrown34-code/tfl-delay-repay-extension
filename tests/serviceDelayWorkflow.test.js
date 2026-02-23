import test from 'node:test';
import assert from 'node:assert/strict';

import { ServiceDelayWorkflow } from '../src/content/workflow/serviceDelayWorkflow.js';
import { SELECTORS } from '../src/content/selectors.js';

function createEventTarget(initial = {}) {
  return {
    value: initial.value ?? '',
    checked: initial.checked ?? false,
    textContent: initial.textContent ?? '',
    options: initial.options ?? [],
    clickCalled: false,
    events: [],
    click() {
      this.clickCalled = true;
    },
    dispatchEvent(event) {
      this.events.push(event.type || event);
    }
  };
}

function createWorkflowHarness({ state, settings = {}, domMap = {}, queryAllMap = {} }) {
  const setCalls = [];
  const removeCalls = [];
  const statusUpdates = [];

  const stateRepository = {
    async get(key) {
      if (key === 'settings') return { settings };
      if (Array.isArray(key) || typeof key === 'string') return { sdrAutofillState: state };
      return {};
    },
    async set(payload) {
      setCalls.push(payload);
    },
    async remove(key) {
      removeCalls.push(key);
    }
  };

  const domAdapter = {
    query: (selector) => domMap[selector] || null,
    queryAll: (selector) => queryAllMap[selector] || [],
    createEvent: (type) => ({ type }),
    setTimeout: (cb) => cb(),
    selectOptionByText: () => true,
    setSelectValue: () => true,
    formatJourneyDate: () => '23/02/2026',
    extractTimeFromJourneyDate: () => ({ hours: 8, mins: 30 }),
    extractEndTimeFromJourney: () => ({ hours: 9, mins: 0 }),
    calculateDelayWithBuffer: () => ({ hours: 0, mins: 20 }),
    getReadableWorkflowStage: (stage) => stage,
    claimAutofillStorageKey: 'sdrAutofillState'
  };

  const statusPanel = {
    update: (...args) => statusUpdates.push(args),
    showWorkflowProgress: (...args) => statusUpdates.push(['workflow', ...args]),
    showFinalSubmitManualNoticeCalled: false,
    showFinalSubmitManualNotice() {
      this.showFinalSubmitManualNoticeCalled = true;
    }
  };

  const clock = {
    now: () => new Date('2026-02-23T12:00:00.000Z')
  };

  const workflow = new ServiceDelayWorkflow(stateRepository, domAdapter, statusPanel, clock);

  return { workflow, setCalls, removeCalls, statusPanel };
}

test('handlePage delegates card-selection and transitions to journey-details', async () => {
  const oysterCardRadio = createEventTarget();
  const oysterCardLabel = createEventTarget();
  const cardSelect = createEventTarget({
    value: '',
    options: [{ value: 'CARD_1' }]
  });
  const submitButton = createEventTarget();

  const { workflow, setCalls } = createWorkflowHarness({
    state: { active: true, stage: 'card-selection', queue: [{ id: 1 }], completed: [] },
    domMap: {
      [SELECTORS.serviceDelayForm.oysterCardSelect]: cardSelect,
      [SELECTORS.serviceDelayForm.oysterCardTypeRadio]: oysterCardRadio,
      [SELECTORS.serviceDelayForm.oysterCardTypeLabel]: oysterCardLabel,
      [SELECTORS.buttons.submitButton]: submitButton
    }
  });

  await workflow.handlePage();

  assert.equal(oysterCardRadio.checked, true);
  assert.equal(submitButton.clickCalled, true);
  assert.equal(setCalls.length, 1);
  assert.equal(setCalls[0].sdrAutofillState.stage, 'journey-details');
});

test('handlePage delegates journey-details and persists completed stage when queue empties', async () => {
  const submitButton = createEventTarget();

  const { workflow, setCalls } = createWorkflowHarness({
    state: {
      active: true,
      stage: 'journey-details',
      queue: [{ from: 'A', to: 'B', journeyDate: '2026-02-20', delayMinutes: 15 }],
      completed: []
    },
    domMap: {
      [SELECTORS.serviceDelayForm.networkLineSelect]: createEventTarget(),
      [SELECTORS.serviceDelayForm.startStationSelect]: createEventTarget(),
      [SELECTORS.serviceDelayForm.endStationSelect]: createEventTarget(),
      [SELECTORS.serviceDelayForm.journeyStartDateInput]: createEventTarget(),
      [SELECTORS.serviceDelayForm.journeyStartHourSelect]: createEventTarget(),
      [SELECTORS.serviceDelayForm.journeyStartMinuteSelect]: createEventTarget(),
      [SELECTORS.serviceDelayForm.journeyEndDateInput]: createEventTarget(),
      [SELECTORS.serviceDelayForm.journeyEndHourSelect]: createEventTarget(),
      [SELECTORS.serviceDelayForm.journeyEndMinuteSelect]: createEventTarget(),
      [SELECTORS.serviceDelayForm.delayHourSelect]: createEventTarget(),
      [SELECTORS.serviceDelayForm.delayMinuteSelect]: createEventTarget(),
      [SELECTORS.buttons.submitButton]: submitButton
    }
  });

  await workflow.handlePage();

  assert.equal(submitButton.clickCalled, true);
  assert.equal(setCalls.length, 1);
  assert.equal(setCalls[0].sdrAutofillState.stage, 'completed');
  assert.equal(setCalls[0].sdrAutofillState.completed.length, 1);
  assert.equal(typeof setCalls[0].sdrAutofillState.lastSubmittedAt, 'string');
});

test('handlePage delegates refund-type and updates refund stage timestamp', async () => {
  const refundRadio = createEventTarget();

  const { workflow, setCalls } = createWorkflowHarness({
    state: { active: true, stage: 'refund-type', queue: [], completed: [] },
    domMap: {
      [SELECTORS.serviceDelayForm.refundToCardRadio]: refundRadio
    }
  });

  await workflow.handlePage();

  assert.equal(refundRadio.checked, true);
  assert.equal(setCalls.length, 1);
  assert.equal(setCalls[0].sdrAutofillState.stage, 'refund-type-selected');
  assert.equal(typeof setCalls[0].sdrAutofillState.refundTypeSelectedAt, 'string');
});

test('handlePage delegates final-submit and marks awaiting-final-submit', async () => {
  const finalSubmit = createEventTarget();

  const { workflow, setCalls, statusPanel } = createWorkflowHarness({
    state: { active: true, stage: 'refund-type-selected', queue: [], completed: [] },
    domMap: {
      [SELECTORS.buttons.finalSubmitByValue]: finalSubmit
    }
  });

  await workflow.handlePage();

  assert.equal(setCalls.length, 1);
  assert.equal(setCalls[0].sdrAutofillState.stage, 'awaiting-final-submit');
  assert.equal(statusPanel.showFinalSubmitManualNoticeCalled, true);
  assert.equal(typeof setCalls[0].sdrAutofillState.finalSubmitPromptedAt, 'string');
});
