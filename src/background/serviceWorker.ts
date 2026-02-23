import { TierService } from '../application/tierService';
import type { Settings } from '../shared/types';

const defaultSettings: Settings = {
  tier: 'free',
  autoDetectOnLoad: false,
  testMode: false,
  testModeRealJourneys: false
};

async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get('settings');
  return { ...defaultSettings, ...(stored.settings ?? {}) };
}

chrome.runtime.onInstalled.addListener(async () => {
  await getSettings();
  chrome.alarms.create('expiry-reminder', { periodInMinutes: 60 * 24 });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_SETTINGS') {
    getSettings().then((settings) => {
      const tierService = TierService.fromSettings(settings);
      sendResponse({ ok: true, settings, capabilities: tierService.capabilities() });
    });
    return true;
  }

  return undefined;
});
