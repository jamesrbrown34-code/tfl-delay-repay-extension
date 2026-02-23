import { SELECTORS } from '../selectors.js';

export class ServiceDelayWorkflow {
  constructor(stateRepository, domAdapter, statusPanel) {
    this.stateRepository = stateRepository;
    this.domAdapter = domAdapter;
    this.statusPanel = statusPanel;
  }

  findNextButtonByText(labelText) {
    return Array.from(this.domAdapter.queryAll(SELECTORS.buttons.submitControls)).find((element) => {
      const text = (element.textContent || element.value || '').toLowerCase().trim();
      return text === labelText.toLowerCase();
    });
  }

  findFinalSubmitButton() {
    const byValue = this.domAdapter.query(SELECTORS.buttons.finalSubmitByValue);
    if (byValue) return byValue;

    return Array.from(this.domAdapter.queryAll(SELECTORS.buttons.submitControls)).find((element) => {
      const text = (element.textContent || element.value || '').toLowerCase().trim();
      return text === 'submit';
    }) || null;
  }

  ensureOysterCardTypeSelected() {
    const oysterCardRadio = this.domAdapter.query(SELECTORS.serviceDelayForm.oysterCardTypeRadio);
    if (!oysterCardRadio) return false;

    const oysterCardLabel = this.domAdapter.query(SELECTORS.serviceDelayForm.oysterCardTypeLabel);
    if (oysterCardLabel) oysterCardLabel.click();
    oysterCardRadio.click();
    oysterCardRadio.checked = true;
    oysterCardRadio.dispatchEvent(this.domAdapter.createEvent('input'));
    oysterCardRadio.dispatchEvent(this.domAdapter.createEvent('change'));
    return true;
  }

  getFirstOysterCardOption(select) {
    return Array.from(select.options || []).find((option) => option.value && option.value !== 'UNATTACHED_CARD') || null;
  }

  fillJourneyDetailsForm(journey, settings) {
    const lineSelect = this.domAdapter.query(SELECTORS.serviceDelayForm.networkLineSelect);
    const startSelect = this.domAdapter.query(SELECTORS.serviceDelayForm.startStationSelect);
    const endSelect = this.domAdapter.query(SELECTORS.serviceDelayForm.endStationSelect);
    const dateInput = this.domAdapter.query(SELECTORS.serviceDelayForm.journeyStartDateInput);
    const hourSelect = this.domAdapter.query(SELECTORS.serviceDelayForm.journeyStartHourSelect);
    const minuteSelect = this.domAdapter.query(SELECTORS.serviceDelayForm.journeyStartMinuteSelect);
    const endDateInput = this.domAdapter.query(SELECTORS.serviceDelayForm.journeyEndDateInput);
    const endHourSelect = this.domAdapter.query(SELECTORS.serviceDelayForm.journeyEndHourSelect);
    const endMinuteSelect = this.domAdapter.query(SELECTORS.serviceDelayForm.journeyEndMinuteSelect);
    const delayHourSelect = this.domAdapter.query(SELECTORS.serviceDelayForm.delayHourSelect);
    const delayMinuteSelect = this.domAdapter.query(SELECTORS.serviceDelayForm.delayMinuteSelect);

    if (!lineSelect || !startSelect || !endSelect || !dateInput || !hourSelect || !minuteSelect || !endDateInput || !endHourSelect || !endMinuteSelect || !delayHourSelect || !delayMinuteSelect) {
      return { ok: false, error: 'Service delay form fields were not found.' };
    }

    const selectedLine = settings?.serviceDelayNetworkLine || 'UNDERGROUND';
    this.domAdapter.setSelectValue(lineSelect, selectedLine);

    const startMatched = this.domAdapter.selectOptionByText(startSelect, journey.from);
    const endMatched = this.domAdapter.selectOptionByText(endSelect, journey.to);

    if (!startMatched || !endMatched) {
      return { ok: false, error: `Could not map station(s) for journey ${journey.from} → ${journey.to}.` };
    }

    dateInput.value = this.domAdapter.formatJourneyDate(journey.journeyDate);
    dateInput.dispatchEvent(this.domAdapter.createEvent('input'));
    dateInput.dispatchEvent(this.domAdapter.createEvent('change'));

    const startTime = this.domAdapter.extractTimeFromJourneyDate(journey);
    this.domAdapter.setSelectValue(hourSelect, startTime.hours);
    this.domAdapter.setSelectValue(minuteSelect, startTime.mins);

    endDateInput.value = this.domAdapter.formatJourneyDate(journey.journeyDate);
    endDateInput.dispatchEvent(this.domAdapter.createEvent('input'));
    endDateInput.dispatchEvent(this.domAdapter.createEvent('change'));

    const endTime = this.domAdapter.extractEndTimeFromJourney(journey);
    this.domAdapter.setSelectValue(endHourSelect, endTime.hours);
    this.domAdapter.setSelectValue(endMinuteSelect, endTime.mins);

    const bufferedDelay = this.domAdapter.calculateDelayWithBuffer(journey.delayMinutes);
    this.domAdapter.setSelectValue(delayHourSelect, String(bufferedDelay.hours).padStart(2, '0'));
    this.domAdapter.setSelectValue(delayMinuteSelect, bufferedDelay.mins);

    return { ok: true };
  }


  async handleCardSelection(state) {
    this.ensureOysterCardTypeSelected();

    const cardSelect = this.domAdapter.query(SELECTORS.serviceDelayForm.oysterCardSelect);
    if (!cardSelect) return false;

    const { settings } = await this.stateRepository.get('settings');
    const preferredCardId = settings?.serviceDelayCardId;

    if (preferredCardId) {
      this.domAdapter.setSelectValue(cardSelect, preferredCardId);
    } else if (!cardSelect.value) {
      const firstCard = this.getFirstOysterCardOption(cardSelect);
      if (firstCard) {
        cardSelect.value = firstCard.value;
        cardSelect.dispatchEvent(this.domAdapter.createEvent('change'));
      }
    }

    const nextPageButton = this.domAdapter.query(SELECTORS.buttons.submitButton) || this.findNextButtonByText('next page');
    if (!nextPageButton) return false;

    await this.stateRepository.set({
      [this.domAdapter.claimAutofillStorageKey]: {
        ...state,
        stage: 'journey-details'
      }
    });

    this.domAdapter.setTimeout(() => nextPageButton.click(), 250);
    return true;
  }

  async handleJourneyDetails(state) {
    const journey = state?.queue?.[0];
    if (!journey) {
      await this.stateRepository.remove(this.domAdapter.claimAutofillStorageKey);
      return { ok: false, error: 'No journeys left to submit.' };
    }

    const { settings } = await this.stateRepository.get('settings');
    const fillResult = this.fillJourneyDetailsForm(journey, settings);
    if (!fillResult.ok) return fillResult;

    const nextPageButton = this.domAdapter.query(SELECTORS.buttons.submitButton) || this.findNextButtonByText('next page');
    if (!nextPageButton) return { ok: false, error: 'Next Page button was not found on journey details form.' };

    const remaining = state.queue.slice(1);
    await this.stateRepository.set({
      [this.domAdapter.claimAutofillStorageKey]: {
        ...state,
        queue: remaining,
        completed: [...(state.completed || []), journey],
        stage: remaining.length ? 'card-selection' : 'completed',
        lastSubmittedAt: new Date().toISOString()
      }
    });

    this.domAdapter.setTimeout(() => nextPageButton.click(), 250);
    return {
      ok: true,
      submitted: journey,
      remaining: remaining.length,
      requiresManualClick: false
    };
  }

  async handleRefundType(state) {
    const refundToCardRadio = this.domAdapter.query(SELECTORS.serviceDelayForm.refundToCardRadio);
    if (!refundToCardRadio) {
      return { ok: false, error: 'Refund-to-card option was not found on page.' };
    }

    refundToCardRadio.checked = true;
    refundToCardRadio.dispatchEvent(this.domAdapter.createEvent('input'));
    refundToCardRadio.dispatchEvent(this.domAdapter.createEvent('change'));

    await this.stateRepository.set({
      [this.domAdapter.claimAutofillStorageKey]: {
        ...state,
        stage: 'refund-type-selected',
        refundTypeSelectedAt: new Date().toISOString()
      }
    });

    return { ok: true, selected: 'FUL' };
  }

  async handleFinalSubmit(state) {
    const finalSubmitButton = this.findFinalSubmitButton();
    if (!finalSubmitButton) return { ok: false, error: 'Final Submit button was not found.' };

    this.statusPanel.update('Final step: manual submit required', 'Please click Submit on this page for a valid claim.');
    this.statusPanel.showFinalSubmitManualNotice();

    await this.stateRepository.set({
      [this.domAdapter.claimAutofillStorageKey]: {
        ...state,
        stage: 'awaiting-final-submit',
        finalSubmitPromptedAt: new Date().toISOString()
      }
    });

    return { ok: true, requiresManualClick: true, prompted: true };
  }

  async handlePage() {
    const { sdrAutofillState } = await this.stateRepository.get(this.domAdapter.claimAutofillStorageKey);
    if (!sdrAutofillState?.active) return;

    const inCardSelection = Boolean(this.domAdapter.query(SELECTORS.serviceDelayForm.oysterCardSelect));
    const inJourneyDetails = Boolean(this.domAdapter.query(SELECTORS.serviceDelayForm.networkLineSelect));
    const inRefundTypeStep = Boolean(this.domAdapter.query(SELECTORS.serviceDelayForm.refundToCardRadio));
    const inFinalSubmitStep = Boolean(this.findFinalSubmitButton());

    let detectedStage = null;
    if (inCardSelection) detectedStage = 'card-selection';
    else if (inJourneyDetails) detectedStage = 'journey-details';
    else if (inRefundTypeStep) detectedStage = 'refund-type';
    else if (inFinalSubmitStep) detectedStage = 'final-submit';

    switch (detectedStage) {
      case 'card-selection':
        this.statusPanel.showWorkflowProgress(sdrAutofillState.completed?.length || 0, sdrAutofillState.queue?.length || 0);
        await this.handleCardSelection(sdrAutofillState);
        return;
      case 'journey-details':
        this.statusPanel.update(this.domAdapter.getReadableWorkflowStage('journey-details'), `Submitted ${sdrAutofillState.completed?.length || 0}, remaining ${sdrAutofillState.queue?.length || 0}.`);
        await this.handleJourneyDetails(sdrAutofillState);
        return;
      case 'refund-type':
        this.statusPanel.update('Final step: manual submit required', 'Please click Submit on this page for a valid claim.');
        await this.handleRefundType(sdrAutofillState);
        return;
      case 'final-submit':
        this.statusPanel.update('Final step: manual submit required', 'Please click Submit on this page for a valid claim.');
        await this.handleFinalSubmit(sdrAutofillState);
        return;
      default:
        return;
    }
  }
}