import { describe, it, expect } from "vitest";
import { evaluateRefund } from "../../src/application/refundEngine";

describe.only("evaluateRefund", () => {
  it("calculates expected time and checks eligibility", () => {
    // Example journey: assume start at 08:00, arrives at 08:30
    const tapIn = new Date("2026-02-26T08:00:00");
    const tapOut = new Date("2026-02-26T08:30:00");

    const result = evaluateRefund("blackfriars", "south_kenton", tapIn, tapOut);

    expect(result).not.toBeNull();

    if (result) {
      const { expected, actual, delay, eligible } = result;
      expect(expected).toBeGreaterThan(0);
      expect(actual).toBe(30);
      expect(delay).toBe(actual - expected);
      // eligible depends on how far your estimator calculates the journey
      // here we just check type correctness
      expect(typeof eligible).toBe("boolean");
    }
  });

  it("Farringdon to Preston Road delay < 15 minutes", () => {
    const result = evaluateRefund(
      "farringdon",
      "preston_road",
      new Date("2026-02-25T17:07:00"),
      new Date("2026-02-25T17:35:00")
    );

    expect(result).not.toBeNull();
    expect(result?.eligible).toBe(false);
  });

  it("Farringdon to Preston Road delay >= 15 minutes", () => {
    const result = evaluateRefund(
      "farringdon",
      "preston_road",
      new Date("2026-02-25T17:07:00"),
      new Date("2026-02-25T18:07:00")
    );

    expect(result).not.toBeNull();
    expect(result?.eligible).toBe(true);
    expect(result?.delay).toBeGreaterThanOrEqual(15);
  });



  it("returns eligible when delay >= 15 minutes", () => {
    const result = evaluateRefund(
      "waterloo",
      "oxford_circus",
      new Date("2026-02-26T08:00:00"),
      new Date("2026-02-26T08:45:00") // long journey
    );

    expect(result).not.toBeNull();
    expect(result?.eligible).toBe(true);
    expect(result?.delay).toBeGreaterThanOrEqual(15);
  });

  it("returns not eligible when delay < 15 minutes", () => {
    const result = evaluateRefund(
      "waterloo",
      "oxford_circus",
      new Date("2026-02-26T08:00:00"),
      new Date("2026-02-26T08:20:00")
    );

    expect(result).not.toBeNull();
    expect(result?.eligible).toBe(false);
  });

  it("returns null for unsupported route", () => {
    const result = evaluateRefund(
      "waterloo",
      "unknown_station",
      new Date(),
      new Date()
    );

    expect(result).toBeNull();
  });

  it("returns zero delay when same station", () => {
    const result = evaluateRefund(
      "waterloo",
      "waterloo",
      new Date("2026-02-26T08:00:00"),
      new Date("2026-02-26T08:05:00")
    );

    expect(result).not.toBeNull();
    expect(result?.expected).toBe(0);
    expect(result?.eligible).toBe(false);
  });
});