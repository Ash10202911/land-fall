"use client";

import { startTransition, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import type { FormState } from "@/lib/validation/auth";
import { updateJob } from "../job-actions";

export function EditJobForm({
  jobId,
  currentDeadline,
  defaults,
  cargoLocked,
}: {
  jobId: string;
  currentDeadline: string;
  defaults: { cargoDescription: string; readyDate: string; deadlineDate: string; deadlineTime: string; notes: string };
  cargoLocked: boolean;
}) {
  const bound = updateJob.bind(null, jobId, currentDeadline);
  const [state, action, pending] = useActionState<FormState, FormData>(bound, {});
  const e = state.errors ?? {};

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        const data = new FormData(ev.currentTarget);
        startTransition(() => action(data));
      }}
    >
      {cargoLocked ? (
        <p className="rounded-md bg-muted p-3 text-sm">
          Quotes have been sent, so the cargo description and ready date are locked to keep quoting fair. You can still
          edit the notes and extend the deadline.
        </p>
      ) : null}
      <Field label="Cargo description" htmlFor="cargoDescription" error={e.cargoDescription}>
        <Textarea
          id="cargoDescription"
          name="cargoDescription"
          defaultValue={defaults.cargoDescription}
          readOnly={cargoLocked}
          aria-invalid={Boolean(e.cargoDescription)}
        />
      </Field>
      <Field label="Cargo ready date" htmlFor="readyDate" error={e.readyDate}>
        <Input
          id="readyDate"
          name="readyDate"
          type="date"
          defaultValue={defaults.readyDate}
          readOnly={cargoLocked}
          aria-invalid={Boolean(e.readyDate)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quote deadline date" htmlFor="deadlineDate" error={e.deadlineDate} hint="Can only be extended">
          <Input
            id="deadlineDate"
            name="deadlineDate"
            type="date"
            defaultValue={defaults.deadlineDate}
            min={defaults.deadlineDate}
            aria-invalid={Boolean(e.deadlineDate)}
          />
        </Field>
        <Field label="Time (UTC)" htmlFor="deadlineTime" error={e.deadlineTime}>
          <Input
            id="deadlineTime"
            name="deadlineTime"
            type="time"
            defaultValue={defaults.deadlineTime}
            aria-invalid={Boolean(e.deadlineTime)}
          />
        </Field>
      </div>
      <Field label="Notes (optional)" htmlFor="notes" error={e.notes}>
        <Textarea id="notes" name="notes" defaultValue={defaults.notes} aria-invalid={Boolean(e.notes)} />
      </Field>
      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="accent" size="full" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
