import { getSettings, saveSettings } from './utils/storage.js';
import { TierService } from './utils/tierService.js';

chrome.runtime.onInstalled.addListener(async () => {
  await getSettings();
  chrome.alarms.create('expiry-reminder', { periodInMinutes: 60 * 24 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'expiry-reminder') return;

  const settings = await getSettings();
  const tierService = TierService.fromSettings(settings);
  if (!tierService.isPaid()) return;

  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('assets/icon.svg'),
    title: 'TubeRefund',
    message: 'Check journeys nearing the 28-day claim deadline.'
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_SETTINGS') {
    getSettings().then((settings) => {
      const tierService = TierService.fromSettings(settings);
      sendResponse({ ok: true, settings, capabilities: tierService.capabilities() });
    });
    return true;
  }

  if (message?.type === 'UPDATE_SETTINGS') {
    saveSettings(message.payload || {})
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return undefined;
});
