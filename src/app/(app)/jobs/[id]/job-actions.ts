"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { notifyJobCancelled } from "@/lib/notifications";
import { notifyLaneAlertsForExtension } from "@/lib/lane-notifications";
import { fieldErrors, type FormState } from "@/lib/validation/auth";
import { checkDeadlineExtension, deadlineToDate, jobEditSchema } from "@/lib/validation/job";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cancels an open job. The database decides who may (only the requester's company, only while open). */
export async function cancelJob(jobId: string): Promise<void> {
  await requireMember();
  if (!UUID.test(jobId)) redirect("/jobs");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_job", { p_job_id: jobId });
  if (error) redirect(`/jobs/${jobId}?job_error=cancel`);

  await notifyJobCancelled({ jobId });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/quotes");
  redirect(`/jobs/${jobId}`);
}

/**
 * One-tap extension of a quiet job: 24 or 48 hours, only in its last 12 hours with no live quotes, at most
 * twice. The database enforces every rule; the lanes are told again once per extension.
 */
export async function extendJob(jobId: string, hours: number): Promise<void> {
  await requireMember();
  if (!UUID.test(jobId) || (hours !== 24 && hours !== 48)) redirect("/jobs");

  const supabase = await createClient();
  const { error } = await supabase.rpc("extend_job", { p_job_id: jobId, p_hours: hours });
  if (error) redirect(`/jobs/${jobId}?job_error=extend`);

  await notifyLaneAlertsForExtension(jobId);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  redirect(`/jobs/${jobId}?extended=${hours}`);
}

function friendlyError(message: string | undefined): string {
  if (message && /cargo details cannot change/i.test(message)) {
    return "Cargo details cannot change once quotes have been sent. You can still edit the notes and extend the deadline.";
  }
  if (message && /only be extended/i.test(message)) return "The deadline can only be extended, not shortened.";
  if (message && /open job/i.test(message)) return "This job can no longer be edited.";
  return "We could not save your changes. Please try again.";
}

/** Edits notes, cargo details (until quotes exist) and extends the deadline. */
export async function updateJob(
  jobId: string,
  currentDeadline: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireMember();
  if (!UUID.test(jobId)) return { message: "Job not found." };

  const parsed = jobEditSchema.safeParse({
    cargoDescription: formData.get("cargoDescription"),
    readyDate: formData.get("readyDate"),
    deadlineDate: formData.get("deadlineDate"),
    deadlineTime: formData.get("deadlineTime"),
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const dateErrors = checkDeadlineExtension(parsed.data, currentDeadline);
  if (Object.keys(dateErrors).length > 0) return { errors: dateErrors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_job", {
    p_job_id: jobId,
    p_cargo_description: parsed.data.cargoDescription,
    p_notes: parsed.data.notes ?? null,
    p_ready_date: parsed.data.readyDate,
    p_deadline_at: deadlineToDate(parsed.data.deadlineDate, parsed.data.deadlineTime).toISOString(),
  });
  if (error) return { message: friendlyError(error.message) };

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  redirect(`/jobs/${jobId}`);
}
