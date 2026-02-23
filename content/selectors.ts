export const SELECTORS = {
  journeyHistory: {
    tableRows: 'table tbody tr',
    tableCells: 'td',
    pageHeading: 'h1',
    dateRangeSelect: '#date-range',
    dateRangeSubmitButton: '#date-range-button',
    viewJourneyHistoryLink: 'a[href*="journeyHistoryThrottle.do"]'
  },
  serviceDelayForm: {
    oysterCardTypeRadio: '#oysterCardType',
    oysterCardTypeLabel: 'label[for="oysterCardType"]',
    oysterCardSelect: '#oysterCardId',
    networkLineSelect: '#tflNetworkLine',
    startStationSelect: '#startStationNlc',
    endStationSelect: '#endStationNlc',
    journeyStartDateInput: '#journeyStartDate',
    journeyStartHourSelect: '#journeyStartDate_hh',
    journeyStartMinuteSelect: '#journeyStartDate_mins',
    journeyEndDateInput: '#journeyEndDate',
    journeyEndHourSelect: '#journeyEndDate_hh',
    journeyEndMinuteSelect: '#journeyEndDate_mins',
    delayHourSelect: '#lengthOfDelay_hh',
    delayMinuteSelect: '#lengthOfDelay_mins',
    refundToCardRadio: '#ahlRefundType'
  },
  navigation: {
    serviceDelayLink: '#navSDR',
    helperPanel: '#tfl-delay-helper-panel',
    helperPanelStatus: '#tfl-delay-helper-panel-status',
    finalSubmitToast: '#sdr-final-submit-toast'
  },
  buttons: {
    submitButton: '#submitBtn',
    submitControls: 'button[type="submit"],input[type="submit"]',
    finalSubmitByValue: 'button[type="submit"][value="Submit"],input[type="submit"][value="Submit"]'
  }
};
