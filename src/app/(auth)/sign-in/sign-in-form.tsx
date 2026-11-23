"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { requestMagicLink } from "./actions";
import type { FormState } from "@/lib/validation/auth";
import { useT } from "@/components/i18n-provider";

export function SignInForm() {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(requestMagicLink, {});

  if (state.ok) {
    return (
      <div role="status" className="rounded-xl bg-accent-soft p-4 text-sm">
        <p className="font-medium">{state.message}</p>
        <p className="mt-1 text-muted-foreground">
          {t("The link works once and expires soon. You can close this page.")}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label={t("Email address")} htmlFor="email" error={state.errors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t("you@company.com")}
          aria-invalid={Boolean(state.errors?.email)}
          aria-describedby={state.errors?.email ? "email-error" : undefined}
          required
        />
      </Field>
      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" size="full" disabled={pending}>
        <Mail className="h-4 w-4" aria-hidden />
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
