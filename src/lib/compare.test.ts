import { describe, expect, it } from "vitest";
import { analyseQuote, lowestCompleteIds, mixedCurrencies, parseCategory, requiredCategories } from "./compare";

const line = (category: string, amount: number, currency = "AUD") => ({ category, amount_minor: amount, currency });
const quote = (id: string, lines: ReturnType<typeof line>[], valid_until = "2027-01-31") => ({ id, valid_until, lines });
const required = requiredCategories(["destination_charges", "customs_clearance", "delivery"]);

describe("requiredCategories", () => {
  it("maps ticked services to legs, in a fixed order", () => {
    expect(requiredCategories(["delivery", "destination_charges"])).toEqual(["destination", "delivery"]);
    expect(requiredCategories([])).toEqual([]);
  });
});

describe("parseCategory", () => {
  it("falls back to other for anything unknown", () => {
    expect(parseCategory("customs")).toBe("customs");
    expect(parseCategory("bogus")).toBe("other");
    expect(parseCategory(null)).toBe("other");
  });
});

describe("analyseQuote", () => {
  it("is complete when every required leg is covered in one currency", () => {
    const a = analyseQuote(quote("a", [line("destination", 100), line("customs", 50), line("delivery", 70)]), required, "2027-01-10");
    expect(a.complete).toBe(true);
    expect(a.missing).toEqual([]);
    expect(a.totalMinor).toBe(220);
  });
  it("lists the legs a tagged quote leaves out", () => {
    const a = analyseQuote(quote("a", [line("destination", 100)]), required, "2027-01-10");
    expect(a.complete).toBe(false);
    expect(a.missing).toEqual(["customs", "delivery"]);
  });
  it("does not judge a quote with no tagged lines", () => {
    const a = analyseQuote(quote("old", [line("other", 100)]), required, "2027-01-10");
    expect(a.tagged).toBe(false);
    expect(a.missing).toEqual([]);
    expect(a.complete).toBe(false);
  });
  it("is not complete across two currencies", () => {
    const a = analyseQuote(quote("a", [line("destination", 100), line("customs", 50, "USD"), line("delivery", 70)]), required, "2027-01-10");
    expect(a.complete).toBe(false);
    expect(a.totalMinor).toBeNull();
    expect(a.currencies.sort()).toEqual(["AUD", "USD"]);
  });
  it("flags a quote that expires before the cargo is ready", () => {
    expect(analyseQuote(quote("a", [line("delivery", 1)], "2027-01-05"), ["delivery"], "2027-01-10").expiresBeforeReady).toBe(true);
    expect(analyseQuote(quote("a", [line("delivery", 1)], "2027-01-10"), ["delivery"], "2027-01-10").expiresBeforeReady).toBe(false);
  });
});

describe("lowestCompleteIds", () => {
  const full = (id: string, total: number, currency = "AUD") =>
    analyseQuote(quote(id, [line("destination", total - 20, currency), line("customs", 10, currency), line("delivery", 10, currency)]), required, "2027-01-10");

  it("badges the cheapest of two complete quotes in the same currency", () => {
    expect([...lowestCompleteIds([full("a", 500), full("b", 400)])]).toEqual(["b"]);
  });
  it("badges ties", () => {
    expect([...lowestCompleteIds([full("a", 400), full("b", 400)])].sort()).toEqual(["a", "b"]);
  });
  it("gives no badge to a single complete quote", () => {
    expect(lowestCompleteIds([full("a", 500)]).size).toBe(0);
  });
  it("ignores incomplete quotes, even if cheaper", () => {
    const cheap = analyseQuote(quote("c", [line("destination", 10)]), required, "2027-01-10");
    expect([...lowestCompleteIds([full("a", 500), full("b", 600), cheap])]).toEqual(["a"]);
  });
  it("never compares different currencies", () => {
    expect(lowestCompleteIds([full("a", 500, "AUD"), full("b", 400, "USD")]).size).toBe(0);
  });
});

describe("mixedCurrencies", () => {
  it("is true only when more than one currency appears", () => {
    const a = analyseQuote(quote("a", [line("delivery", 1)]), required, "x");
    const b = analyseQuote(quote("b", [line("delivery", 1, "USD")]), required, "x");
    expect(mixedCurrencies([a, b])).toBe(true);
    expect(mixedCurrencies([a])).toBe(false);
  });
});
