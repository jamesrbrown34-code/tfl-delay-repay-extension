# TfL Delay Claim Assistant (MVP Boilerplate)

Chrome extension scaffold for analysing TfL journey history pages and generating delay claim text.

## Features in this scaffold

- MV3 extension structure with popup, content script, and service worker background script.
- Manual journey analysis trigger (`Analyse Delays`).
- Eligibility filtering for:
  - Delays **>= 15 minutes**
  - Journeys in the last **28 days**
  - Excluding concession/free travel ticket types
- Estimated refund per journey using PAYG-equivalent logic.
- Copyable claim snippet generation.
- Paid-tier scaffolding:
  - Auto-detect toggle
  - Monthly storage primitives
  - Export button scaffold (currently JSON download placeholder)
  - Ad suppression for paid users

## Folder structure

```txt
.
├── manifest.json
├── README.md
├── assets/
│   └── icon.svg
├── data/
│   └── mockJourneys.json
└── src/
    ├── background.js
    ├── contentScript.js
    ├── popup.css
    ├── popup.html
    ├── popup.js
    └── utils/
        ├── claimSnippet.js
        ├── delayEngine.js
        ├── fareEstimator.js
        └── storage.js
```

## Install and run locally

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this project folder.
4. Navigate to TfL Oyster journey history (`https://oyster.tfl.gov.uk/`) when logged in.
5. Open the extension popup and click **Analyse Delays**.

If no eligible data is found on the active page, the popup falls back to mock data from `data/mockJourneys.json` for development.

## Permissions rationale

- `storage`: Save settings and analysed journey summaries locally.
- `tabs`: Identify/send message to active TfL tab from popup.
- `downloads`: Export monthly summary scaffold file.
- `notifications`: Paid-tier reminder notifications.
- `alarms`: Schedule reminder checks.
- `host_permissions` (`https://oyster.tfl.gov.uk/*`, `https://tfl.gov.uk/*`): Run content script on Oyster journey pages and compatible TfL pages.

## Notes / next steps

- Replace JSON export scaffold with real PDF generation (`jsPDF`).
- Improve fare estimation with precise TfL fare tables per mode/time/zone.
- Harden DOM parser selectors once exact TfL markup is confirmed.
- Add tests for delay engine and claim snippet formatting.
