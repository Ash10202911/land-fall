"use client";

import { useState } from "react";
import { Lock, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { useT } from "@/components/i18n-provider";

/**
 * Two-step award: awarding cannot be undone, so ask once before submitting. When the job asks for
 * delivery, the street address is collected here and shared with the winner only.
 */
export function AwardButton({
  action,
  companyName,
  needsAddress,
  suburb,
}: {
  action: (formData: FormData) => Promise<void>;
  companyName: string;
  needsAddress: boolean;
  suburb?: string;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  // The name is bold, so split the sentence around a marker and put the name back in between.
  const [beforeName, afterName] = t(
    "Award this job to {name}? Other quotes will be marked lost and you will both see each other's contact details. This cannot be undone.",
    { name: "\u0000" },
  ).split("\u0000");

  if (!confirming) {
    return (
      <Button type="button" variant="accent" size="full" onClick={() => setConfirming(true)}>
        <Trophy className="h-4 w-4" aria-hidden />
        {t("Award to {name}", { name: companyName })}
      </Button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-xl bg-muted p-3">
      <p className="text-sm">
        {beforeName}
        <strong>{companyName}</strong>
        {afterName}
      </p>
      {needsAddress ? (
        <div className="space-y-1">
          <Field label={t("Delivery street address")} htmlFor="street" hint={suburb ? t("In {suburb}, from your request.", { suburb }) : undefined}>
            <Input id="street" name="street" required minLength={3} maxLength={200} autoComplete="street-address" />
          </Field>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            {t("Shared only with {name}. The other quoters are told the job is closed, without your details or the winning price.", { name: companyName })}
          </p>
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" variant="accent" className="flex-1">
          {t("Confirm award")}
        </Button>
        <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
          {t("Cancel")}
        </Button>
      </div>
    </form>
  );
}
