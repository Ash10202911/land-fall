"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { checkValidUntil, linesToRpc, quoteFieldErrors, quoteSchema } from "@/lib/validation/quote";
import { notifyNewQuote } from "@/lib/notifications";
import type { FormState } from "@/lib/validation/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseQuote(formData: FormData) {
  let lines: unknown = [];
  try {
    lines = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    lines = [];
  }
  return quoteSchema.safeParse({
    validUntil: formData.get("validUntil"),
    notes: formData.get("notes") ?? undefined,
    lines,
  });
}

function friendlyError(code: string | undefined): string {
  if (code === "42501") return "This quote can no longer be changed. The deadline may have passed or the job was awarded.";
  if (code === "23505") return "Your company already has a quote on this job. Edit it instead.";
  return "We could not save your quote. Please try again.";
}

export async function submitQuote(jobId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireMember();
  if (!UUID.test(jobId)) return { message: "Job not found." };
  if (me.company.status !== "active") return { message: "Your company is suspended and cannot send quotes." };

  const parsed = parseQuote(formData);
  if (!parsed.success) return { errors: quoteFieldErrors(parsed.error) };
  const dateError = checkValidUntil(parsed.data.validUntil);
  if (dateError) return { errors: { validUntil: dateError } };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_quote", {
    p_job_id: jobId,
    p_valid_until: parsed.data.validUntil,
    p_notes: parsed.data.notes ?? null,
    p_lines: linesToRpc(parsed.data.lines),
  });
  if (error || !data) return { message: friendlyError(error?.code) };

  await notifyNewQuote({ jobId, quoteId: data as string });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/quotes");
  redirect(`/jobs/${jobId}`);
}

export async function updateQuote(
  jobId: string,
  quoteId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireMember();
  if (!UUID.test(quoteId)) return { message: "Quote not found." };

  const parsed = parseQuote(formData);
  if (!parsed.success) return { errors: quoteFieldErrors(parsed.error) };
  const dateError = checkValidUntil(parsed.data.validUntil);
  if (dateError) return { errors: { validUntil: dateError } };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_quote", {
    p_quote_id: quoteId,
    p_valid_until: parsed.data.validUntil,
    p_notes: parsed.data.notes ?? null,
    p_lines: linesToRpc(parsed.data.lines),
  });
  if (error) return { message: friendlyError(error.code) };

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/quotes");
  redirect(`/jobs/${jobId}`);
}

export async function withdrawQuote(jobId: string, quoteId: string): Promise<void> {
  await requireMember();
  if (!UUID.test(quoteId)) return;
  const supabase = await createClient();
  await supabase.rpc("withdraw_quote", { p_quote_id: quoteId });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/quotes");
  redirect(`/jobs/${jobId}`);
}
