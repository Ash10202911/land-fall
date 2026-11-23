"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { updateProfile } from "./actions";
import type { FormState } from "@/lib/validation/auth";
import { useT } from "@/components/i18n-provider";

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfile, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        label={t("Your name")}
        htmlFor="fullName"
        error={e.fullName}
        hint={t("Shown to the other party after an award.")}
      >
        <Input
          id="fullName"
          name="fullName"
          defaultValue={fullName}
          autoComplete="name"
          aria-invalid={Boolean(e.fullName)}
          required
        />
      </Field>
      <Field
        label={t("Phone")}
        htmlFor="phone"
        error={e.phone}
        hint={t("Include the country code. Shown to the other party after an award.")}
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={phone}
          autoComplete="tel"
          aria-invalid={Boolean(e.phone)}
        />
      </Field>
      {state.message ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={state.ok ? "text-sm text-success" : "text-sm text-destructive"}
        >
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("Saving…") : t("Save details")}
      </Button>
    </form>
  );
}
