import { z } from "zod";
import { CONTAINER_TYPES, DIRECTIONS, INCOTERMS, MODES, SERVICES } from "@/lib/domain";
import { REPEAT_FREQUENCIES, UNLOAD_TYPES } from "@/lib/scope";

/** Quote window presets in hours, or a custom date and time. */
export const CLOSE_IN = ["24", "48", "72", "168", "custom"] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const optionalNumber = (label: string, max: number) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: `${label} must be a number` })
      .positive(`${label} must be more than zero`)
      .max(max, `${label} is too large`)
      .optional(),
  );

const portId = (label: string) =>
  z.coerce.number({ error: `Choose a ${label} port` }).int(`Choose a ${label} port`).positive(`Choose a ${label} port`);

export const jobSchema = z
  .object({
    direction: z.enum(DIRECTIONS, { error: "Choose import or export" }),
    incoterm: z.enum(INCOTERMS, { error: "Choose an incoterm" }),
    mode: z.enum(MODES, { error: "Choose FCL, LCL or Air" }),
    originPortId: portId("origin"),
    destinationPortId: portId("destination"),
    containerType: z.preprocess(emptyToUndefined, z.enum(CONTAINER_TYPES).optional()),
    containerQty: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1").max(999).optional(),
    ),
    weightKg: optionalNumber("Weight", 1_000_000),
    volumeCbm: optionalNumber("Volume", 100_000),
    cargoDescription: z
      .string()
      .trim()
      .min(2, "Describe the cargo")
      .max(1000, "Cargo description must be 1000 characters or fewer"),
    readyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the cargo ready date"),
    services: z.array(z.enum(SERVICES)).default([]),
    flagDg: z.boolean().default(false),
    flagReefer: z.boolean().default(false),
    flagBmsb: z.boolean().default(false),
    closeIn: z.preprocess(emptyToUndefined, z.enum(CLOSE_IN).optional()),
    deadlineDate: z.preprocess(emptyToUndefined, z.string().regex(DATE, "Enter the quote deadline date").optional()),
    deadlineTime: z.preprocess(
      emptyToUndefined,
      z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter the quote deadline time").optional(),
    ),
    notes: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(2000, "Notes must be 2000 characters or fewer").optional(),
    ),
    deliverySuburb: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(2, "Enter the delivery suburb").max(80, "Suburb must be 80 characters or fewer").optional(),
    ),
    deliveryPostcode: z.preprocess(emptyToUndefined, z.string().trim().regex(/^\d{4}$/, "Enter a 4-digit postcode").optional()),
    unloadType: z.preprocess(emptyToUndefined, z.enum(UNLOAD_TYPES, { error: "Choose how it will be unloaded" }).optional()),
    repeatFrequency: z.preprocess(emptyToUndefined, z.enum(REPEAT_FREQUENCIES).default("one_off")),
    repeatVolume: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(120, "Expected volume must be 120 characters or fewer").optional(),
    ),
    requiredBy: z.preprocess(emptyToUndefined, z.string().regex(DATE, "Enter a valid needed-by date").optional()),
  })
  .superRefine((v, ctx) => {
    if (v.services.includes("delivery")) {
      if (!v.deliverySuburb) ctx.addIssue({ code: "custom", path: ["deliverySuburb"], message: "Enter the delivery suburb" });
      if (!v.deliveryPostcode) ctx.addIssue({ code: "custom", path: ["deliveryPostcode"], message: "Enter a 4-digit postcode" });
      if (!v.unloadType) ctx.addIssue({ code: "custom", path: ["unloadType"], message: "Choose how it will be unloaded" });
    }
    if (v.requiredBy && v.requiredBy < v.readyDate) {
      ctx.addIssue({ code: "custom", path: ["requiredBy"], message: "The needed-by date must be on or after the ready date" });
    }
    if (closeInFor(v) === "custom" && (!v.deadlineDate || !v.deadlineTime)) {
      ctx.addIssue({ code: "custom", path: ["deadlineDate"], message: "Enter the quote deadline date and time" });
    }
    if (v.originPortId === v.destinationPortId) {
      ctx.addIssue({ code: "custom", path: ["destinationPortId"], message: "Origin and destination must differ" });
    }
    if (v.mode === "FCL") {
      if (!v.containerType) ctx.addIssue({ code: "custom", path: ["containerType"], message: "Choose a container type" });
      if (!v.containerQty) ctx.addIssue({ code: "custom", path: ["containerQty"], message: "Enter the number of containers" });
    } else {
      if (!v.weightKg) ctx.addIssue({ code: "custom", path: ["weightKg"], message: "Enter the weight in kg" });
      if (!v.volumeCbm) ctx.addIssue({ code: "custom", path: ["volumeCbm"], message: "Enter the volume in cbm" });
    }
  });

export type JobInput = z.infer<typeof jobSchema>;

/** The chosen quote window: an explicit choice, else a custom date when one is given, else 48 hours. */
export function closeInFor(v: { closeIn?: (typeof CLOSE_IN)[number]; deadlineDate?: string }): (typeof CLOSE_IN)[number] {
  return v.closeIn ?? (v.deadlineDate ? "custom" : "48");
}

/** The quote deadline: now plus the preset hours, or the custom UTC date and time. */
export function deadlineFor(
  v: { closeIn?: (typeof CLOSE_IN)[number]; deadlineDate?: string; deadlineTime?: string },
  now = new Date(),
): Date {
  const close = closeInFor(v);
  if (close === "custom") return deadlineToDate(v.deadlineDate ?? "", v.deadlineTime ?? "");
  return new Date(now.getTime() + Number(close) * 3_600_000);
}

/** Combines the UTC deadline date and time into a Date. */
export function deadlineToDate(date: string, time: string): Date {
  return new Date(`${date}T${time}:00Z`);
}

/** Server-side checks that depend on the clock. Returns field errors. */
export function checkJobDates(
  input: Pick<JobInput, "deadlineDate" | "deadlineTime" | "readyDate"> & { closeIn?: JobInput["closeIn"] },
  now = new Date(),
): Record<string, string> {
  const errors: Record<string, string> = {};
  const deadline = deadlineFor(input, now);
  if (Number.isNaN(deadline.getTime())) {
    errors.deadlineDate = "Enter a valid quote deadline";
  } else if (deadline.getTime() <= now.getTime()) {
    errors.deadlineDate = "The quote deadline must be in the future";
  }
  const ready = new Date(`${input.readyDate}T00:00:00Z`);
  if (Number.isNaN(ready.getTime())) errors.readyDate = "Enter a valid ready date";
  return errors;
}

/** Fields a poster may change after posting (cargo and ready date lock once quotes exist). */
export const jobEditSchema = z.object({
  cargoDescription: z
    .string()
    .trim()
    .min(2, "Describe the cargo")
    .max(1000, "Cargo description must be 1000 characters or fewer"),
  readyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the cargo ready date"),
  deadlineDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the quote deadline date"),
  deadlineTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter the quote deadline time"),
  notes: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(2000, "Notes must be 2000 characters or fewer").optional(),
  ),
});

/** The deadline can only move later, and must be in the future. Returns field errors. */
export function checkDeadlineExtension(
  input: { deadlineDate: string; deadlineTime: string },
  currentDeadlineIso: string,
  now = new Date(),
): Record<string, string> {
  const next = deadlineToDate(input.deadlineDate, input.deadlineTime);
  if (Number.isNaN(next.getTime())) return { deadlineDate: "Enter a valid quote deadline" };
  if (next.getTime() <= now.getTime()) return { deadlineDate: "The quote deadline must be in the future" };
  if (next.getTime() < new Date(currentDeadlineIso).getTime()) {
    return { deadlineDate: "The deadline can only be extended, not shortened" };
  }
  return {};
}
