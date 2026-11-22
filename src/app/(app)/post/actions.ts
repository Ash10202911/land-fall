"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { fieldErrors, type FormState } from "@/lib/validation/auth";
import { checkJobDates, deadlineFor, jobSchema } from "@/lib/validation/job";

export type JobFormState = FormState & { values?: Record<string, string | string[]> };

function readForm(formData: FormData) {
  return {
    direction: formData.get("direction"),
    incoterm: formData.get("incoterm"),
    mode: formData.get("mode"),
    originPortId: formData.get("originPortId"),
    destinationPortId: formData.get("destinationPortId"),
    containerType: formData.get("containerType") ?? undefined,
    containerQty: formData.get("containerQty") ?? undefined,
    weightKg: formData.get("weightKg") ?? undefined,
    volumeCbm: formData.get("volumeCbm") ?? undefined,
    cargoDescription: formData.get("cargoDescription"),
    readyDate: formData.get("readyDate"),
    services: formData.getAll("services"),
    flagDg: formData.get("flagDg") === "on",
    flagReefer: formData.get("flagReefer") === "on",
    flagBmsb: formData.get("flagBmsb") === "on",
    closeIn: formData.get("closeIn") ?? undefined,
    deadlineDate: formData.get("deadlineDate") ?? undefined,
    deadlineTime: formData.get("deadlineTime") ?? undefined,
    notes: formData.get("notes") ?? undefined,
    deliverySuburb: formData.get("deliverySuburb") ?? undefined,
    deliveryPostcode: formData.get("deliveryPostcode") ?? undefined,
    unloadType: formData.get("unloadType") ?? undefined,
    repeatFrequency: formData.get("repeatFrequency") ?? undefined,
    repeatVolume: formData.get("repeatVolume") ?? undefined,
    requiredBy: formData.get("requiredBy") ?? undefined,
  };
}

export async function postJob(_prev: JobFormState, formData: FormData): Promise<JobFormState> {
  const me = await requireMember();
  if (me.company.status !== "active") {
    return { message: "Your company is suspended and cannot request quotes." };
  }

  const raw = readForm(formData);
  const parsed = jobSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const now = new Date();
  const dateErrors = checkJobDates(parsed.data, now);
  if (Object.keys(dateErrors).length > 0) return { errors: dateErrors };

  // Admins may post on behalf of another active company; the database enforces this too.
  const onBehalf = String(formData.get("onBehalfOf") ?? "");
  const postingFor = me.is_admin && /^[0-9a-f-]{36}$/i.test(onBehalf) ? onBehalf : me.company.id;

  const v = parsed.data;
  const isFcl = v.mode === "FCL";
  const delivery = v.services.includes("delivery");
  const regular = v.repeatFrequency !== "one_off";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      company_id: postingFor,
      created_by: me.id,
      direction: v.direction,
      incoterm: v.incoterm,
      mode: v.mode,
      origin_port_id: v.originPortId,
      destination_port_id: v.destinationPortId,
      container_type: isFcl ? v.containerType : null,
      container_qty: isFcl ? v.containerQty : null,
      weight_kg: isFcl ? null : v.weightKg,
      volume_cbm: isFcl ? null : v.volumeCbm,
      cargo_description: v.cargoDescription,
      ready_date: v.readyDate,
      services: v.services,
      flag_dg: v.flagDg,
      flag_reefer: v.flagReefer,
      flag_bmsb: v.flagBmsb,
      deadline_at: deadlineFor(v, now).toISOString(),
      notes: v.notes ?? null,
      delivery_suburb: delivery ? (v.deliverySuburb ?? null) : null,
      delivery_postcode: delivery ? (v.deliveryPostcode ?? null) : null,
      unload_type: delivery ? (v.unloadType ?? null) : null,
      repeat_frequency: v.repeatFrequency,
      repeat_volume: regular ? (v.repeatVolume ?? null) : null,
      required_by: v.requiredBy ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { message: "We could not post your request. Check your details and try again." };
  }
  revalidatePath("/jobs");
  redirect(`/jobs/${data.id}`);
}
