export const CLAIM_WINDOW_DAYS = 28;
export const MIN_DELAY_MINUTES = 15;
export const CONCESSION_KEYWORDS = [
  'freedom pass',
  '60+ oyster',
  'veteran',
  'child',
  'zip',
  'concession',
  'free travel'
] as const;

export const STORAGE_KEYS = {
  settings: 'settings',
  workflowState: 'sdrAutofillState',
  claimQueue: 'claimQueue'
} as const;
