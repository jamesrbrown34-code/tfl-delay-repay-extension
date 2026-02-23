import { MIN_DELAY_MINUTES } from '../shared/constants';
import type { Journey } from '../shared/types';

export interface RawJourneyInput {
  journeyDate: string;
  from: string;
  to: string;
  expectedMinutes?: number | null;
  actualMinutes?: number | null;
  delayMinutes?: number;
  ticketType?: string;
  zonesCrossed?: number;
  source?: Journey['source'];
}

export function createJourney(raw: RawJourneyInput): Journey {
  const expectedMinutes = raw.expectedMinutes ?? null;
  const actualMinutes = raw.actualMinutes ?? null;
  const computedDelay =
    typeof raw.delayMinutes === 'number'
      ? Math.max(raw.delayMinutes, 0)
      : expectedMinutes !== null && actualMinutes !== null
        ? Math.max(actualMinutes - expectedMinutes, 0)
        : MIN_DELAY_MINUTES;

  return {
    id: `${raw.journeyDate}-${raw.from}-${raw.to}-${computedDelay}`,
    journeyDate: raw.journeyDate,
    from: raw.from.trim(),
    to: raw.to.trim(),
    expectedMinutes,
    actualMinutes,
    delayMinutes: computedDelay,
    ticketType: raw.ticketType ?? 'PAYG',
    zonesCrossed: raw.zonesCrossed ?? 1,
    source: raw.source ?? 'history-table'
  };
}

export function parseStatementAction(actionText: string): Pick<Journey, 'from' | 'to'> | null {
  const match = actionText.match(/(.+?)\s+to\s+(.+)/i);
  if (!match) return null;
  return { from: match[1].trim(), to: match[2].trim() };
}
