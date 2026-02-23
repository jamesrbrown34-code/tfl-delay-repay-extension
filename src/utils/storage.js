import { TierService } from './tierService.js';

const DEFAULT_SETTINGS = {
  tier: 'free',
  autoDetectOnLoad: false,
  showAds: true,
  testMode: false,
  testModeRealJourneys: false,
  monthlyTracking: {}
};

export async function getSettings() {
  const stored = await chrome.storage.local.get('settings');
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(stored.settings || {})
  };

  const tierService = TierService.fromSettings(merged);
  return {
    ...merged,
    tier: tierService.getCurrentTier(),
    isPaidTier: tierService.isPaid()
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
