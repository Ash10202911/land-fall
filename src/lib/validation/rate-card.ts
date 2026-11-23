import { z } from "zod";
import { CURRENCIES, parseMoneyToMinor } from "@/lib/domain";
import { UNLOAD_TYPES } from "@/lib/scope";
import { msg } from "@/lib/i18n";

export const CHARGE_KINDS = ["charge", "zone"] as const;
export const CHARGE_CATEGORIES = ["destination", "customs", "delivery"] as const;
export const RATE_BASES = ["per_job", "per_container", "per_20ft", "per_40ft", "per_cbm", "per_kg"] as const;

export const CATEGORY_LABELS: Record<(typeof CHARGE_CATEGORIES)[number], string> = {
  destination: msg("Destination port"),
  customs: msg("Customs"),
  delivery: msg("Delivery"),
};
export const BASIS_LABELS: Record<(typeof RATE_BASES)[number], string> = {
  per_job: msg("per job"),
  per_container: msg("per container"),
  per_20ft: msg("per 20ft container"),
  per_40ft: msg("per 40ft container"),
  per_cbm: msg("per cbm"),
  per_kg: msg("per kg"),
};

/** The job services each charge category answers to. */
export const CATEGORY_SERVICE = {
  destination: "destination_charges",
  customs: "customs_clearance",
  delivery: "delivery",
} as const;

export const MAX_RATE_ROWS = 40;

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const postcode = (label: string) =>
  z.preprocess(blankToUndefined, z.string().trim().regex(/^\d{1,4}$/, `${label} must be 1 to 4 digits`).optional());

/** One line of a rate card as typed in the editor (or read from a spreadsheet row). */
export const rateRowSchema = z
  .object({
    kind: z.enum(CHARGE_KINDS, { error: "Choose charge or zone" }),
    name: z.string().trim().min(1, "Enter a name").max(120, "Name must be 120 characters or fewer"),
    category: z.enum(CHARGE_CATEGORIES, { error: "Choose destination, customs or delivery" }),
    basis: z.enum(RATE_BASES, { error: "Choose what the price is per" }),
    amount: z
      .string()
      .trim()
      .transform((v, ctx) => {
        // Rate card prices feed straight into quotes, so commas must be real thousands separators.
        const wellFormed = !v.includes(",") || /^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(v);
        const minor = wellFormed ? parseMoneyToMinor(v) : null;
        if (minor === null) {
          ctx.addIssue({ code: "custom", message: "Enter an amount such as 165.00" });
          return z.NEVER;
        }
        return minor;
      }),
    gstIncluded: z.boolean().default(true),
    postcodeFrom: postcode("From postcode"),
    postcodeTo: postcode("To postcode"),
    unloadType: z.preprocess(blankToUndefined, z.enum(UNLOAD_TYPES, { error: "Unknown unload type" }).optional()),
  })
  .superRefine((r, ctx) => {
    if (r.kind === "zone") {
      if (r.category !== "delivery") {
        ctx.addIssue({ code: "custom", path: ["category"], message: "A cartage zone is a delivery charge" });
      }
      if (!r.postcodeFrom || !r.postcodeTo) {
        ctx.addIssue({ code: "custom", path: ["postcodeFrom"], message: "A zone needs a from and a to postcode" });
      } else if (Number(r.postcodeFrom) > Number(r.postcodeTo)) {
        ctx.addIssue({ code: "custom", path: ["postcodeTo"], message: "The to postcode must not be below the from postcode" });
      }
      if (r.unloadType) {
        ctx.addIssue({ code: "custom", path: ["unloadType"], message: "Unload rules apply to charges, not zones" });
      }
    } else {
      if (r.postcodeFrom || r.postcodeTo) {
        ctx.addIssue({ code: "custom", path: ["postcodeFrom"], message: "Postcodes belong to a cartage zone" });
      }
      if (r.unloadType && r.category !== "delivery") {
        ctx.addIssue({ code: "custom", path: ["unloadType"], message: "An unload rule only applies to a delivery charge" });
      }
    }
  });

export type RateRowInput = z.input<typeof rateRowSchema>;
export type RateRow = z.output<typeof rateRowSchema>;

export const rateCardSchema = z.object({
  id: z.preprocess(blankToUndefined, z.uuid().optional()),
  name: z.string().trim().min(2, "Enter a name for the rate card").max(80, "Name must be 80 characters or fewer"),
  destinationPortId: z.coerce
    .number({ error: "Choose the destination port" })
    .int("Choose the destination port")
    .positive("Choose the destination port"),
  currency: z.enum(CURRENCIES, { error: "Choose a currency" }),
  validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date the prices are valid to"),
  rows: z.array(rateRowSchema).min(1, "Add at least one charge").max(MAX_RATE_ROWS, `A rate card can have at most ${MAX_RATE_ROWS} lines`),
});

export type RateCardInput = z.infer<typeof rateCardSchema>;

/** The valid-to date cannot be in the past. */
export function checkValidTo(validTo: string, now = new Date()): string | null {
  const d = new Date(`${validTo}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "Enter a valid date";
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return d.getTime() < today.getTime() ? "The valid-to date cannot be in the past" : null;
}

/** Shapes validated rows for the save_rate_card function. */
export function rowsToRpc(rows: RateRow[]) {
  return rows.map((r) => ({
    kind: r.kind,
    name: r.name,
    category: r.category,
    basis: r.basis,
    amount_minor: r.amount,
    gst_included: r.gstIncluded,
    postcode_from: r.kind === "zone" ? Number(r.postcodeFrom) : null,
    postcode_to: r.kind === "zone" ? Number(r.postcodeTo) : null,
    unload_type: r.unloadType ?? null,
  }));
}
