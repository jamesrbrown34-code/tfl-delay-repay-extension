const DEFAULT_SETTINGS = {
  isPaidTier: false,
  autoDetectOnLoad: false,
  showAds: true,
  testMode: false,
  testModeRealJourneys: false,
  monthlyTracking: {}
};

export async function getSettings() {
  const stored = await chrome.storage.local.get('settings');
  return {
    ...DEFAULT_SETTINGS,
    ...(stored.settings || {})
  };
}

export async function saveSettings(settingsPatch) {
  const current = await getSettings();
  const next = {
    ...current,
    ...settingsPatch
  };
  await chrome.storage.local.set({ settings: next });
  return next;
}

export async function appendMonthlyJourney(journey) {
  const settings = await getSettings();
  const monthKey = journey.journeyDate.slice(0, 7);
  const currentMonth = settings.monthlyTracking[monthKey] || [];

  const monthlyTracking = {
    ...settings.monthlyTracking,
    [monthKey]: [...currentMonth, journey]
  };

  return saveSettings({ monthlyTracking });
}
