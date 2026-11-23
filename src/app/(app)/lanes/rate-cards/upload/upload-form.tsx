"use client";

import { startTransition, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { CURRENCIES } from "@/lib/domain";
import type { FormState } from "@/lib/validation/auth";
import { uploadRateCard } from "../../actions";
import type { PortOption } from "../../add-lane-form";
import { useT } from "@/components/i18n-provider";

/** Upload a rate card from a spreadsheet saved as CSV. A single mistake rejects the file, with row numbers. */
export function UploadForm({ ports, defaultCurrency, minDate, defaultValidTo }: { ports: PortOption[]; defaultCurrency: string; minDate: string; defaultValidTo: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(uploadRateCard, {});
  const e = state.errors ?? {};
  const countries = [...new Set(ports.map((p) => p.country))];
  const fileErrors = e.file ? e.file.split("\n") : [];

  return (
    <form
      noValidate
      className="space-y-4 rounded-[20px] border border-border bg-card p-4 shadow-card"
      // Submitted by hand rather than with form action, because React clears a form after its action ends and
      // a rejected file must not wipe the name and port the person typed.
      onSubmit={(ev) => {
        ev.preventDefault();
        const data = new FormData(ev.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("Name")} htmlFor="name" error={e.name}>
          <Input id="name" name="name" placeholder={t("Port Botany destination charges")} aria-invalid={Boolean(e.name)} />
        </Field>
        <Field label={t("Destination port")} htmlFor="destinationPortId" error={e.destinationPortId}>
          <Select id="destinationPortId" name="destinationPortId" defaultValue="" aria-invalid={Boolean(e.destinationPortId)}>
            <option value="" disabled>
              {t("Choose a port")}
            </option>
            {countries.map((c) => (
              <optgroup key={c} label={c}>
                {ports.filter((p) => p.country === c).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label={t("Currency")} htmlFor="currency" error={e.currency}>
          <Select id="currency" name="currency" defaultValue={defaultCurrency}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Prices valid to")} htmlFor="validTo" error={e.validTo}>
          <Input id="validTo" name="validTo" type="date" min={minDate} defaultValue={defaultValidTo} aria-invalid={Boolean(e.validTo)} />
        </Field>
      </div>

      <div className="space-y-1">
        <label htmlFor="file" className="mb-1.5 block text-sm font-semibold">
          {t("Spreadsheet (CSV)")}
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv,text/plain"
          aria-invalid={Boolean(e.file)}
          className="block w-full rounded-xl border border-input bg-card p-2 text-sm file:mr-3 file:min-h-9 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:text-sm file:font-semibold file:text-primary-foreground"
        />
        {fileErrors.length > 0 ? (
          <ul role="alert" className="mt-2 space-y-1 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            {fileErrors.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Reading the file…" : "Upload rate card"}
      </Button>
    </form>
  );
}
