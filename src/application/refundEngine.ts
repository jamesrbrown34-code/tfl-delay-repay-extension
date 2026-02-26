// refundEngine.ts

import { estimateJourneyTime } from "./estimator";
import { Station } from "../domain/lines";

export interface RefundResult {
    expected: number;
    actual: number;
    delay: number;
    eligible: boolean;
}

export function evaluateRefund(
    from: Station,
    to: Station,
    tapIn: Date,
    tapOut: Date
): RefundResult | null {
    const expected = estimateJourneyTime(from, to);

    if (expected === null) {
        return null;
    }

    const actual =
        (tapOut.getTime() - tapIn.getTime()) / 60000;

    const delay = actual - expected;

    return {
        expected,
        actual: Math.round(actual),
        delay: Math.round(delay),
        eligible: delay >= 15
    };
}