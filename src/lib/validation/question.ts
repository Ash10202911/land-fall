import { z } from "zod";
import { msg } from "@/lib/i18n";

/** Questions and answers are plain text. The database also blocks contact details (email, phone, links). */
export const questionSchema = z.object({
  text: z
    .string()
    .trim()
    .min(5, msg("Ask your question in at least 5 characters"))
    .max(500, msg("Keep your question to 500 characters or fewer")),
});

export const answerSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, msg("Write an answer"))
    .max(1000, msg("Keep your answer to 1000 characters or fewer")),
});

export const QUESTION_ERRORS = {
  contact: msg("Please do not include contact details such as an email, phone number or link. They are shared after an award."),
  limit: msg("You have reached the question limit for this job, or asked too many today."),
  closed: msg("Questions are closed for this job."),
  denied: msg("You cannot do that on this job."),
  failed: msg("We could not save that. Please try again."),
} as const;

/** Turns a database error from ask_question or answer_question into a friendly message. */
export function questionErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return QUESTION_ERRORS.failed;
  if (/contact details/i.test(error.message ?? "")) return QUESTION_ERRORS.contact;
  if (error.code === "54000") return QUESTION_ERRORS.limit;
  if (/closed/i.test(error.message ?? "")) return QUESTION_ERRORS.closed;
  if (error.code === "42501") return QUESTION_ERRORS.denied;
  return QUESTION_ERRORS.failed;
}
