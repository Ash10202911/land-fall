import { z } from "zod";
import { CURRENCIES, parseMoneyToMinor } from "@/lib/domain";
import { QUOTE_CATEGORIES } from "@/lib/compare";

export const quoteLineSchema = z.object({
  chargeName: z
    .string()
    .trim()
    .min(1, "Enter a charge name")
    .max(120, "Charge name must be 120 characters or fewer"),
  amount: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const minor = parseMoneyToMinor(v);
      if (minor === null) {
        ctx.addIssue({ code: "custom", message: "Enter an amount such as 1250.00" });
        return z.NEVER;
      }
      return minor;
    }),
  currency: z.enum(CURRENCIES, { error: "Choose a currency" }),
  gstIncluded: z.boolean().default(false),
  category: z.enum(QUOTE_CATEGORIES).default("other"),
});

export const quoteSchema = z.object({
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter how long the quote is valid until"),
  notes: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(2000, "Notes must be 2000 characters or fewer").optional(),
  ),
  lines: z
    .array(quoteLineSchema)
    .min(1, "Add at least one line item")
    .max(20, "A quote can have at most 20 line items"),
});

export type QuoteInput = z.infer<typeof quoteSchema>;

/** The validity date cannot be in the past. */
export function checkValidUntil(validUntil: string, now = new Date()): string | null {
  const d = new Date(`${validUntil}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "Enter a valid date";
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return d.getTime() < today.getTime() ? "The validity date cannot be in the past" : null;
}

/** Shapes the validated lines for the submit_quote and update_quote functions. */
export function linesToRpc(lines: QuoteInput["lines"]) {
  return lines.map((l) => ({
    charge_name: l.chargeName,
    amount_minor: l.amount,
    currency: l.currency,
    gst_included: l.gstIncluded,
    category: l.category,
  }));
}

/** Flattens issues like lines.0.amount to {"lines.0.amount": message}. */
export function quoteFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
