import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatTotals,
  isJobClosed,
  parseMoneyToMinor,
  totalsByCurrency,
} from "./domain";

describe("dates", () => {
  it("formats DD/MM/YYYY in UTC", () => {
    expect(formatDate("2026-03-07")).toBe("07/03/2026");
    expect(formatDate("2026-12-31T23:30:00Z")).toBe("31/12/2026");
    expect(formatDateTime("2026-03-07T04:05:00Z")).toBe("07/03/2026 04:05 UTC");
  });
});

describe("money", () => {
  it("parses decimal input to minor units", () => {
    expect(parseMoneyToMinor("1,234.56")).toBe(123456);
    expect(parseMoneyToMinor("85")).toBe(8500);
    expect(parseMoneyToMinor("0")).toBeNull();
    expect(parseMoneyToMinor("-5")).toBeNull();
    expect(parseMoneyToMinor("12.345")).toBeNull();
    expect(parseMoneyToMinor("abc")).toBeNull();
  });
  it("formats minor units", () => {
    expect(formatMoney(123456, "AUD")).toContain("1,234.56");
  });
  it("totals per currency without conversion", () => {
    const lines = [
      { amount_minor: 10000, currency: "AUD" },
      { amount_minor: 2550, currency: "AUD" },
      { amount_minor: 5000, currency: "USD" },
    ];
    expect(totalsByCurrency(lines)).toEqual([
      { currency: "AUD", minor: 12550 },
      { currency: "USD", minor: 5000 },
    ]);
    expect(formatTotals(lines)).toContain("+");
  });
});

describe("isJobClosed", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  it("is closed once the deadline passes or the job is not open", () => {
    expect(isJobClosed({ status: "open", deadline_at: "2026-06-02T00:00:00Z" }, now)).toBe(false);
    expect(isJobClosed({ status: "open", deadline_at: "2026-05-31T00:00:00Z" }, now)).toBe(true);
    expect(isJobClosed({ status: "awarded", deadline_at: "2026-06-02T00:00:00Z" }, now)).toBe(true);
  });
});
