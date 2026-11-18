"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { fieldErrors, type FormState } from "@/lib/validation/auth";
import { checkJobDates, deadlineToDate, jobSchema } from "@/lib/validation/job";

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
    deadlineDate: formData.get("deadlineDate"),
    deadlineTime: formData.get("deadlineTime"),
    notes: formData.get("notes") ?? undefined,
  };
}

export async function postJob(_prev: JobFormState, formData: FormData): Promise<JobFormState> {
  const me = await requireMember();
  if (me.company.status !== "active") {
    return { message: "Your company is suspended and cannot post jobs." };
  }

  const raw = readForm(formData);
  const parsed = jobSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const dateErrors = checkJobDates(parsed.data);
  if (Object.keys(dateErrors).length > 0) return { errors: dateErrors };

  const v = parsed.data;
  const isFcl = v.mode === "FCL";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      company_id: me.company.id,
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
      deadline_at: deadlineToDate(v.deadlineDate, v.deadlineTime).toISOString(),
      notes: v.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { message: "We could not post your job. Check your details and try again." };
  }
  revalidatePath("/jobs");
  redirect(`/jobs/${data.id}`);
}
