export const CLAIM_WINDOW_DAYS = 28;

export function parseDdMmYyyyToDate(rawDate) {
  const normalized = String(rawDate || '').trim();
  const ddMmYyyyMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!ddMmYyyyMatch) return null;

  const day = Number(ddMmYyyyMatch[1]);
  const month = Number(ddMmYyyyMatch[2]);
  const year = Number(ddMmYyyyMatch[3]);

  if (!day || !month || !year) return null;

  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getDate() !== day || parsed.getMonth() !== month - 1 || parsed.getFullYear() !== year) return null;

  return parsed;
}

export function formatDateAsDdMmYyyy(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

export function parseDateLabelToDdMmYyyy(text = '') {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  const match = normalized.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!match) return null;

  const monthMap = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12
  };

  const day = Number(match[1]);
  const month = monthMap[match[2].toLowerCase()];
  const year = Number(match[3]);
  if (!day || !month || !year) return null;

  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

export function formatJourneyDate(rawDate, {
  parseDateToDdMmYyyy = parseDdMmYyyyToDate,
  parseDateLabel = parseDateLabelToDdMmYyyy,
  formatDate = formatDateAsDdMmYyyy,
  fallbackDate = new Date()
} = {}) {
  const parsedDdMmYyyy = parseDateToDdMmYyyy(rawDate);
  if (parsedDdMmYyyy) return formatDate(parsedDdMmYyyy);

  const parsedLabel = parseDateLabel(rawDate);
  if (parsedLabel) return parsedLabel;

  const parsedGeneric = new Date(String(rawDate || '').replace(/(\d{1,2}:\d{2}).*$/, '').trim());
  if (!Number.isNaN(parsedGeneric.getTime())) {
    return formatDate(parsedGeneric);
  }

  return formatDate(fallbackDate);
}

export function isWithinClaimWindow(journeyDate, now = new Date(), claimWindowDays = CLAIM_WINDOW_DAYS) {
  const parsedDate = new Date(journeyDate);
  if (Number.isNaN(parsedDate.getTime())) return false;

  const windowStart = new Date(now);
  windowStart.setHours(0, 0, 0, 0);
  windowStart.setDate(windowStart.getDate() - claimWindowDays);

  parsedDate.setHours(0, 0, 0, 0);
  return parsedDate >= windowStart;
}
