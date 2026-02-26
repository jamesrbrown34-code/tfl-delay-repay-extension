// estimator.ts

import { LINES, Station } from "../domain/lines";

const MINUTES_PER_STOP = 2.5;
const INTERCHANGE_PENALTY = 4;
const GLOBAL_BUFFER = 2;

function stopsBetween(
    lineStations: Station[],
    from: Station,
    to: Station
): number | null {
    const i1 = lineStations.indexOf(from);
    const i2 = lineStations.indexOf(to);

    if (i1 === -1 || i2 === -1) return null;

    return Math.abs(i1 - i2);
}

function sameLineTime(
    from: Station,
    to: Station
): number | null {
    for (const line of Object.values(LINES)) {
        const stops = stopsBetween(line, from, to);
        if (stops !== null) {
            return stops * MINUTES_PER_STOP;
        }
    }

    return null;
}

function oneChangeTime(
    from: Station,
    to: Station
): number | null {
    const lineEntries = Object.values(LINES);

    for (const lineA of lineEntries) {
        if (!lineA.includes(from)) continue;

        for (const lineB of lineEntries) {
            if (!lineB.includes(to)) continue;

            // Find interchange station
            for (const station of lineA) {
                if (lineB.includes(station)) {
                    const part1 = stopsBetween(lineA, from, station);
                    const part2 = stopsBetween(lineB, station, to);

                    if (part1 !== null && part2 !== null) {
                        return (
                            (part1 + part2) * MINUTES_PER_STOP +
                            INTERCHANGE_PENALTY
                        );
                    }
                }
            }
        }
    }

    return null;
}

export function estimateJourneyTime(
    from: Station,
    to: Station
): number | null {
    if (from === to) return 0;

    // Same line first (fast path)
    const direct = sameLineTime(from, to);
    if (direct !== null) {
        return Math.round(direct + GLOBAL_BUFFER);
    }

    // One change
    const withChange = oneChangeTime(from, to);
    if (withChange !== null) {
        return Math.round(withChange + GLOBAL_BUFFER);
    }

    return null; // unsupported route
}