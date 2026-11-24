"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { fieldErrors, type FormState } from "@/lib/validation/auth";
import { QUESTION_ERRORS, answerSchema, questionErrorMessage, questionSchema } from "@/lib/validation/question";
import { notifyQuestionAnswered, notifyQuestionAsked } from "@/lib/notifications";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A forwarder asks a public question. The asker stays anonymous to everyone but their own company. */
export async function askQuestion(jobId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireMember();
  if (!UUID.test(jobId)) return { message: QUESTION_ERRORS.failed };
  const parsed = questionSchema.safeParse({ text: formData.get("text") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ask_question", { p_job_id: jobId, p_question: parsed.data.text });
  if (error || !data) return { message: questionErrorMessage(error) };

  await notifyQuestionAsked({ jobId, questionId: data as string });
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

/** The requester answers a question. The answer is then visible to everyone who can see the job. */
export async function answerQuestion(jobId: string, questionId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireMember();
  if (!UUID.test(jobId) || !UUID.test(questionId)) return { message: QUESTION_ERRORS.failed };
  const parsed = answerSchema.safeParse({ text: formData.get("text") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("answer_question", { p_question_id: questionId, p_answer: parsed.data.text });
  if (error) return { message: questionErrorMessage(error) };

  await notifyQuestionAnswered({ jobId, questionId });
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}
