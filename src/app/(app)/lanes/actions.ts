"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { MODES } from "@/lib/domain";
import { ALERT_FREQUENCIES } from "@/lib/lane-alerts";
import { parseRateSheet, MAX_SHEET_BYTES } from "@/lib/rate-sheet";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation/auth";
import { checkValidTo, rateCardSchema, rowsToRpc } from "@/lib/validation/rate-card";
import { quoteFieldErrors } from "@/lib/validation/quote";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Lane alerts
// ---------------------------------------------------------------------------

const laneSchema = z.object({
  origin: z.string().regex(/^(any|country:.{2,80}|port:\d{1,9})$/, "Choose where the cargo comes from"),
  destinationPortId: z.coerce.number({ error: "Choose the destination port" }).int("Choose the destination port").positive("Choose the destination port"),
  modes: z.array(z.enum(MODES)).default([]),
  destinationOnly: z.boolean().default(false),
  frequency: z.enum(ALERT_FREQUENCIES, { error: "Choose how often to email you" }),
});

function laneError(code: string | undefined): string {
  if (code === "54000") return "You can have at most 20 lane alerts. Remove one first.";
  if (code === "42501") return "Your company cannot add lane alerts right now.";
  return "We could not save that lane. Please try again.";
}

export async function addLaneAlert(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireMember();
  const parsed = laneSchema.safeParse({
    origin: formData.get("origin"),
    destinationPortId: formData.get("destinationPortId"),
    modes: formData.getAll("modes"),
    destinationOnly: formData.get("destinationOnly") === "on",
    frequency: formData.get("frequency"),
  });
  if (!parsed.success) return { errors: quoteFieldErrors(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("lane_alerts").insert({
    company_id: me.company.id,
    created_by: me.id,
    origin_port_id: v.origin.startsWith("port:") ? Number(v.origin.slice(5)) : null,
    origin_country: v.origin.startsWith("country:") ? v.origin.slice(8) : null,
    destination_port_id: v.destinationPortId,
    modes: v.modes,
    destination_only: v.destinationOnly,
    frequency: v.frequency,
  });
  if (error) return { message: laneError(error.code) };
  revalidatePath("/lanes");
  return { ok: true };
}

export async function setLaneFrequency(id: string, frequency: string): Promise<void> {
  await requireMember();
  const parsed = z.enum(ALERT_FREQUENCIES).safeParse(frequency);
  if (!UUID.test(id) || !parsed.success) return;
  const supabase = await createClient();
  await supabase.from("lane_alerts").update({ frequency: parsed.data }).eq("id", id);
  revalidatePath("/lanes");
}

export async function deleteLaneAlert(id: string): Promise<void> {
  await requireMember();
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("lane_alerts").delete().eq("id", id);
  revalidatePath("/lanes");
}

// ---------------------------------------------------------------------------
// Rate cards
// ---------------------------------------------------------------------------

function rateError(code: string | undefined, message: string | undefined): string {
  if (code === "54000") return "You can have at most 10 rate cards. Delete one first.";
  if (code === "42501") return "Your company cannot save rate cards right now, or this card is not yours.";
  if (code === "22023" && message) return message;
  return "We could not save the rate card. Check the lines and try again.";
}

async function persistRateCard(input: unknown): Promise<FormState & { id?: string }> {
  const parsed = rateCardSchema.safeParse(input);
  if (!parsed.success) return { errors: quoteFieldErrors(parsed.error) };
  const dateError = checkValidTo(parsed.data.validTo);
  if (dateError) return { errors: { validTo: dateError } };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_rate_card", {
    p_id: parsed.data.id ?? null,
    p_name: parsed.data.name,
    p_port: parsed.data.destinationPortId,
    p_currency: parsed.data.currency,
    p_valid_to: parsed.data.validTo,
    p_charges: rowsToRpc(parsed.data.rows),
  });
  if (error || !data) return { message: rateError(error?.code, error?.message) };
  revalidatePath("/lanes");
  return { ok: true, id: data as string };
}

/** Saves the card from the in-app editor. The rows arrive as JSON from the form. */
export async function saveRateCard(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireMember();
  let rows: unknown = [];
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    rows = [];
  }
  const result = await persistRateCard({
    id: formData.get("id") ?? undefined,
    name: formData.get("name"),
    destinationPortId: formData.get("destinationPortId"),
    currency: formData.get("currency"),
    validTo: formData.get("validTo"),
    rows,
  });
  if (!result.ok) return result;
  redirect("/lanes");
}

/** Creates a card from an uploaded CSV. Any problem in the file rejects the whole file with row numbers. */
export async function uploadRateCard(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireMember();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { errors: { file: "Choose a CSV file to upload" } };
  if (file.size > MAX_SHEET_BYTES) return { errors: { file: "The file is too large. Keep it under 100 KB." } };
  if (!/\.(csv|txt)$/i.test(file.name)) {
    return { errors: { file: "Save the spreadsheet as CSV first (Excel: File, Save As, CSV) and upload that." } };
  }
  const sheet = parseRateSheet(await file.text());
  if (sheet.errors.length > 0) return { errors: { file: sheet.errors.join("\n") } };

  const result = await persistRateCard({
    name: formData.get("name"),
    destinationPortId: formData.get("destinationPortId"),
    currency: formData.get("currency"),
    validTo: formData.get("validTo"),
    rows: sheet.rows,
  });
  if (!result.ok) {
    // Row-level problems are already caught while reading the file; report anything else against the form.
    const errors = { ...(result.errors ?? {}) };
    for (const key of Object.keys(errors)) if (key.startsWith("rows")) errors.file = errors[key];
    return { ...result, errors };
  }
  redirect("/lanes");
}

export async function deleteRateCard(id: string): Promise<void> {
  await requireMember();
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("rate_cards").delete().eq("id", id);
  revalidatePath("/lanes");
  redirect("/lanes");
}
