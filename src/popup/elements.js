export function getPopupElements(doc = document) {
  return {
    runFullFlowButton: doc.getElementById('runFullFlowButton'),
    testModeToggle: doc.getElementById('testModeToggle'),
    autoDetectToggle: doc.getElementById('autoDetectToggle'),
    testModeRealJourneysToggle: doc.getElementById('testModeRealJourneysToggle'),
    summaryBox: doc.getElementById('summaryBox'),
    journeysList: doc.getElementById('journeysList'),
    adBanner: doc.getElementById('adBanner')
  };
}
