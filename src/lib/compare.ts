import { msg } from "@/lib/i18n";
import { totalsByCurrency } from "@/lib/domain";

/** What a quote line covers. "other" is anything that is not one of the three destination legs. */
export const QUOTE_CATEGORIES = ["destination", "customs", "delivery", "other"] as const;
export type QuoteCategory = (typeof QUOTE_CATEGORIES)[number];

export const QUOTE_CATEGORY_LABELS: Record<QuoteCategory, string> = {
  destination: msg("Destination port"),
  customs: msg("Customs"),
  delivery: msg("Delivery"),
  other: msg("Other"),
};

export function parseCategory(value: unknown): QuoteCategory {
  return (QUOTE_CATEGORIES as readonly string[]).includes(value as string) ? (value as QuoteCategory) : "other";
}

const SERVICE_CATEGORY: Record<string, QuoteCategory> = {
  destination_charges: "destination",
  customs_clearance: "customs",
  delivery: "delivery",
};

/** The destination legs the requester asked to have priced, from the services they ticked. */
export function requiredCategories(services: readonly string[]): QuoteCategory[] {
  return (["destination", "customs", "delivery"] as const).filter((c) =>
    services.some((s) => SERVICE_CATEGORY[s] === c),
  );
}

type Line = { category?: string | null; amount_minor: number | string | bigint; currency: string };

export type QuoteAnalysis = {
  id: string;
  /** False for older quotes where no line has been tagged, so coverage cannot be judged. */
  tagged: boolean;
  covered: QuoteCategory[];
  missing: QuoteCategory[];
  currencies: string[];
  /** Tagged, covers every required leg, and priced in a single currency. */
  complete: boolean;
  /** The quote stops being valid before the cargo is ready. */
  expiresBeforeReady: boolean;
  /** Total in minor units when the quote uses one currency, else null. */
  totalMinor: number | null;
};

export function analyseQuote(
  quote: { id: string; valid_until: string; lines: Line[] },
  required: readonly QuoteCategory[],
  readyDate: string,
): QuoteAnalysis {
  const covered = new Set(quote.lines.map((l) => parseCategory(l.category)));
  const tagged = quote.lines.some((l) => parseCategory(l.category) !== "other");
  const missing = tagged ? required.filter((c) => !covered.has(c)) : [];
  const totals = totalsByCurrency(quote.lines);
  const currencies = totals.map((t) => t.currency);
  return {
    id: quote.id,
    tagged,
    covered: QUOTE_CATEGORIES.filter((c) => covered.has(c)),
    missing,
    currencies,
    complete: tagged && required.length > 0 && missing.length === 0 && currencies.length === 1,
    expiresBeforeReady: quote.valid_until < readyDate,
    totalMinor: totals.length === 1 ? Number(totals[0].minor) : null,
  };
}

/**
 * The quote(s) with the lowest total among complete quotes in the same currency. A badge is only given
 * when at least two complete quotes share a currency: one quote has nothing to be lowest against, and
 * different currencies are never compared (no exchange rate is assumed).
 */
export function lowestCompleteIds(analyses: readonly QuoteAnalysis[]): Set<string> {
  const byCurrency = new Map<string, QuoteAnalysis[]>();
  for (const a of analyses) {
    if (!a.complete || a.totalMinor === null) continue;
    const list = byCurrency.get(a.currencies[0]) ?? [];
    list.push(a);
    byCurrency.set(a.currencies[0], list);
  }
  const out = new Set<string>();
  for (const list of byCurrency.values()) {
    if (list.length < 2) continue;
    const min = Math.min(...list.map((a) => a.totalMinor as number));
    for (const a of list) if (a.totalMinor === min) out.add(a.id);
  }
  return out;
}

/** True when the quotes are in more than one currency, so totals are not directly comparable. */
export function mixedCurrencies(analyses: readonly QuoteAnalysis[]): boolean {
  return new Set(analyses.flatMap((a) => a.currencies)).size > 1;
}
