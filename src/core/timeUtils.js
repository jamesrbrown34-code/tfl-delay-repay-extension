export const DEFAULT_JOURNEY_TIME = { hours: 12, mins: 0 };
export const MINUTES_IN_DAY = 24 * 60;

export function parseTimeRangeStart(timeCell = '') {
  const match = String(timeCell).match(/(\d{1,2})[:.](\d{2})\s*[-–]/);
  if (!match) return null;
  return {
    hours: Number(match[1]),
    mins: Number(match[2])
  };
}

export function parseTimeRangeEnd(timeCell = '') {
  const match = String(timeCell).match(/[-–]\s*(\d{1,2})[:.](\d{2})/);
  if (!match) return null;
  return {
    hours: Number(match[1]),
    mins: Number(match[2])
  };
}

export function extractTimeFromJourneyDate(journey = {}, defaultTime = DEFAULT_JOURNEY_TIME) {
  if (journey?.startTime && Number.isFinite(journey.startTime.hours) && Number.isFinite(journey.startTime.mins)) {
    return {
      hours: journey.startTime.hours,
      mins: journey.startTime.mins
    };
  }

  const match = String(journey?.journeyDate || '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return { ...defaultTime };
  return {
    hours: Number(match[1]),
    mins: Number(match[2])
  };
}

export function extractEndTimeFromJourney(journey = {}, {
  extractStartTime = extractTimeFromJourneyDate,
  minutesInDay = MINUTES_IN_DAY
} = {}) {
  if (journey?.endTime && Number.isFinite(journey.endTime.hours) && Number.isFinite(journey.endTime.mins)) {
    return {
      hours: journey.endTime.hours,
      mins: journey.endTime.mins
    };
  }

  const start = extractStartTime(journey);
  const expected = Number(journey?.actualMinutes || journey?.expectedMinutes || 0);
  const startTotal = start.hours * 60 + start.mins;
  const endTotal = Math.max(startTotal, startTotal + expected);

  return {
    hours: Math.floor((endTotal % minutesInDay) / 60),
    mins: endTotal % 60
  };
}
