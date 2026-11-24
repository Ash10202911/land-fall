"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { requestMagicLink } from "./actions";
import type { FormState } from "@/lib/validation/auth";
import { useT } from "@/components/i18n-provider";

/**
 * Email sign-in. The default is the stacked form; `inline` is the landing page's one-line invitation (email and
 * button side by side, stacked on small phones). Both send the same one-time link, for members and new people alike.
 */
export function SignInForm({ inline = false }: { inline?: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(requestMagicLink, {});

  if (state.ok) {
    return (
      <div role="status" className="rounded-2xl bg-[#e9f6ff] p-4 text-sm text-[#0b2f57]">
        <p className="font-semibold">{state.message}</p>
        <p className="mt-1 text-[#4a6785]">{t("The link works once and expires soon. You can close this page.")}</p>
      </div>
    );
  }

  if (inline) {
    const error = state.errors?.email;
    return (
      <form action={action} noValidate>
        <label htmlFor="email" className="sr-only">
          {t("Email address")}
        </label>
        <div className="flex flex-col gap-2 rounded-[1.4rem] bg-white p-2 shadow-[0_16px_40px_-20px_rgba(90,60,20,0.45)] ring-1 ring-[#eadfce] sm:flex-row">
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t("you@company.com")}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "email-error" : undefined}
            required
            className="min-h-12 min-w-0 flex-1 rounded-2xl bg-transparent px-4 text-base text-[#0b2f57] placeholder:text-[#8a9bb0] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#3cb9fc]/30"
          />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#0c5a9c] px-6 text-base font-bold text-white transition-colors hover:bg-[#0b3a6e] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#3cb9fc] disabled:opacity-70"
          >
            {pending ? t("Sending…") : t("Join the tribe")}
          </button>
        </div>
        {error ? (
          <p role="alert" id="email-error" className="mt-2 text-sm text-destructive">
            {t(error)}
          </p>
        ) : null}
        {state.message ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {t(state.message)}
          </p>
        ) : null}
      </form>
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
        {pending ? t("Sending…") : t("Email me a sign-in link")}
      </Button>
    </form>
  );
}
