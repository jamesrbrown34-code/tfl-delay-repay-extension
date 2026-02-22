export function normalizeStationName(name = '') {
  return name.toLowerCase().replace(/\[[^\]]+\]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseStationPairFromAction(actionText = '') {
  const match = actionText.match(/(.+?)\s+to\s+(.+)/i);
  if (!match) return null;

  const from = match[1].trim();
  const to = match[2].trim();
  if (!from || !to) return null;

  return { from, to };
}
