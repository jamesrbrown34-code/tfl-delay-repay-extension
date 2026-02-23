# TfL Delay Repay Extension

Production-oriented refactor of the Chrome extension with layered architecture, explicit capability gating, and testable domain/application services.

## Architecture

```txt
src/
  domain/
    journey.ts
    eligibility.ts
    claim.ts
  application/
    claimQueue.ts
    sessionManager.ts
    tierService.ts
  infrastructure/
    tflScraper.ts
    tflAutomation.ts
    backendClient.ts
    logger.ts
  ui/
    popupController.ts
    statusPanel.ts
  background/
    serviceWorker.ts
  content/
    contentScript.ts
  shared/
    types.ts
    constants.ts
    errors.ts
```

### Layer responsibilities

- **Domain**: Pure logic for journey normalization, eligibility rules, and claim creation.
- **Application**: Claim queue orchestration, session/2FA state machine, and feature capability checks.
- **Infrastructure**: TfL DOM scraping/automation, backend HTTP client, and logging adapters.
- **UI**: Popup orchestration and status rendering.
- **Runtime entrypoints**: Background service worker and content script.

## Testing

Tests are organized to mirror runtime layers:

```txt
tests/
  domain/
  application/
  infrastructure/
```

Run:

```bash
npm install
npm test
```

Coverage targets are configured for domain + application code.

## Security and session handling

- 2FA challenge is encapsulated in `SessionManager`.
- No credentials or 2FA code persistence is implemented.
- Session state is represented explicitly (`authenticated`, `pending2FA`, expiry).

## Tier capability model

`TierService` centralizes feature gating:

- `canAutoSubmit()` — paid only
- `canAccess28Days()` — available to all users

This prevents scattered tier conditionals across UI/content/background logic.
