import { describe, expect, it } from "vitest";
import { checkValidUntil, linesToRpc, quoteFieldErrors, quoteSchema } from "./quote";

const line = { chargeName: "Destination charges", amount: "850.00", currency: "AUD", gstIncluded: true };

describe("quoteSchema", () => {
  it("accepts a quote with several lines and converts amounts to minor units", () => {
    const r = quoteSchema.parse({
      validUntil: "2026-07-01",
      lines: [line, { ...line, chargeName: "Delivery", amount: "1,200.50", currency: "USD", gstIncluded: false }],
    });
    expect(r.lines.map((l) => l.amount)).toEqual([85000, 120050]);
    expect(linesToRpc(r.lines)[1]).toEqual({
      charge_name: "Delivery",
      amount_minor: 120050,
      currency: "USD",
      gst_included: false,
    });
  });
  it("needs at least one line and rejects bad amounts and currencies", () => {
    expect(quoteSchema.safeParse({ validUntil: "2026-07-01", lines: [] }).success).toBe(false);
    const bad = quoteSchema.safeParse({ validUntil: "2026-07-01", lines: [{ ...line, amount: "abc" }] });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(quoteFieldErrors(bad.error)["lines.0.amount"]).toMatch(/amount/i);
    expect(quoteSchema.safeParse({ validUntil: "2026-07-01", lines: [{ ...line, currency: "XXX" }] }).success).toBe(false);
  });
});

describe("checkValidUntil", () => {
  const now = new Date("2026-06-10T12:00:00Z");
  it("rejects past dates and accepts today or later", () => {
    expect(checkValidUntil("2026-06-09", now)).toMatch(/past/);
    expect(checkValidUntil("2026-06-10", now)).toBeNull();
    expect(checkValidUntil("2026-06-30", now)).toBeNull();
  });
});
