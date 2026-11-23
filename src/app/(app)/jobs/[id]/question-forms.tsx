"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { useT } from "@/components/i18n-provider";
import type { FormState } from "@/lib/validation/auth";
import { answerQuestion, askQuestion } from "./question-actions";

/** Ask a public question. Forwarders write in English so every requester can read it. */
export function AskQuestionForm({ jobId }: { jobId: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(askQuestion.bind(null, jobId), {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-3" noValidate>
      <Field label={t("Ask the requester a question")} htmlFor="question" error={state.errors?.text} hint={t("Write in English. Do not include contact details. Your company stays anonymous.")}>
        <Textarea id="question" name="text" maxLength={500} aria-invalid={Boolean(state.errors?.text)} />
      </Field>
      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {t(state.message)}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-success">
          {t("Question sent. The requester has been told.")}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? t("Sending…") : t("Send question")}
      </Button>
    </form>
  );
}

/** The requester's answer. It is shown to everyone who can see the job. */
export function AnswerForm({ jobId, questionId }: { jobId: string; questionId: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(answerQuestion.bind(null, jobId, questionId), {});
  const id = `answer-${questionId}`;
  return (
    <form action={action} className="space-y-3" noValidate>
      <Field label={t("Your answer")} htmlFor={id} error={state.errors?.text} hint={t("Everyone who can see this job will see your answer.")}>
        <Textarea id={id} name="text" maxLength={1000} aria-invalid={Boolean(state.errors?.text)} />
      </Field>
      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {t(state.message)}
        </p>
      ) : null}
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? t("Sending…") : t("Post answer")}
      </Button>
    </form>
  );
}
