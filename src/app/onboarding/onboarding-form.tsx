"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { completeOnboarding } from "./actions";
import type { FormState } from "@/lib/validation/auth";
import { useT } from "@/components/i18n-provider";

export function OnboardingForm() {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(completeOnboarding, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label={t("Company name")} htmlFor="companyName" error={e.companyName}>
        <Input
          id="companyName"
          name="companyName"
          autoComplete="organization"
          aria-invalid={Boolean(e.companyName)}
          required
        />
      </Field>
      <Field label={t("Country")} htmlFor="country" error={e.country}>
        <Input
          id="country"
          name="country"
          autoComplete="country-name"
          aria-invalid={Boolean(e.country)}
          required
        />
      </Field>
      <Field label={t("Company website")} htmlFor="website" error={e.website} hint={t("So we can check who you are before you are verified. For example acme.com")}>
        <Input
          id="website"
          name="website"
          type="text"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          placeholder="acme.com"
          aria-invalid={Boolean(e.website)}
          required
        />
      </Field>
      <Field label={t("Your company is a")} htmlFor="role" error={e.role}>
        <Select id="role" name="role" defaultValue="" aria-invalid={Boolean(e.role)} required>
          <option value="" disabled>
            {t("Choose one")}
          </option>
          <option value="agent">{t("Overseas agent (posts jobs)")}</option>
          <option value="forwarder">{t("Australia or New Zealand forwarder (sends quotes)")}</option>
        </Select>
      </Field>
      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" size="full" disabled={pending}>
        {pending ? t("Saving…") : t("Continue")}
      </Button>
    </form>
  );
}
