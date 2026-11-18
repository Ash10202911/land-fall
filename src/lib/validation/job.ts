import { z } from "zod";
import { CONTAINER_TYPES, DIRECTIONS, INCOTERMS, MODES, SERVICES } from "@/lib/domain";

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
    deadlineDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the quote deadline date"),
    deadlineTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter the quote deadline time"),
    notes: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(2000, "Notes must be 2000 characters or fewer").optional(),
    ),
  })
  .superRefine((v, ctx) => {
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

/** Combines the UTC deadline date and time into a Date. */
export function deadlineToDate(date: string, time: string): Date {
  return new Date(`${date}T${time}:00Z`);
}

/** Server-side checks that depend on the clock. Returns field errors. */
export function checkJobDates(
  input: Pick<JobInput, "deadlineDate" | "deadlineTime" | "readyDate">,
  now = new Date(),
): Record<string, string> {
  const errors: Record<string, string> = {};
  const deadline = deadlineToDate(input.deadlineDate, input.deadlineTime);
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
