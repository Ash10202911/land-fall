"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form";
import { MODES } from "@/lib/domain";
import { ALERT_FREQUENCIES, FREQUENCY_LABELS } from "@/lib/lane-alerts";
import type { FormState } from "@/lib/validation/auth";
import { addLaneAlert } from "./actions";
import { useT } from "@/components/i18n-provider";
import { msg } from "@/lib/i18n";

export type PortOption = { id: number; code: string; name: string; country: string };

const MODE_LABEL: Record<(typeof MODES)[number], string> = { FCL: msg("Sea, full container"), LCL: msg("Sea, shared container"), Air: msg("Air") };
const ANZ = ["Australia", "New Zealand"];

/** Add a lane: where from, where to, which modes, and how often to be emailed. */
export function AddLaneForm({ ports }: { ports: PortOption[] }) {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(addLaneAlert, {});
  const formRef = useRef<HTMLFormElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const e = state.errors ?? {};

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      if (detailsRef.current) detailsRef.current.open = false;
    }
  }, [state]);

  // Any port can be an origin, so a forwarder here can watch exports as well as imports.
  const overseas = ports;
  const countries = [...new Set(overseas.map((p) => p.country))].sort();
  const byCountry = (list: PortOption[]) => [...new Set(list.map((p) => p.country))].sort();

  return (
    <details ref={detailsRef} className="group rounded-2xl border border-dashed border-input bg-card/60 p-4">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-bold text-accent">
        <Plus className="h-4 w-4" aria-hidden />
        {t("Add a lane")}
      </summary>
      <form
        ref={formRef}
        noValidate
        className="mt-4 space-y-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          const data = new FormData(ev.currentTarget);
          startTransition(() => action(data));
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("From")} htmlFor="origin" error={e.origin}>
            <Select id="origin" name="origin" defaultValue="any" aria-invalid={Boolean(e.origin)}>
              <option value="any">{t("Anywhere")}</option>
              <optgroup label={t("A whole country")}>
                {countries.map((c) => (
                  <option key={c} value={`country:${c}`}>
                    {t("{country} (any port)", { country: c })}
                  </option>
                ))}
              </optgroup>
              {countries.map((c) => (
                <optgroup key={c} label={t("{country}: one port", { country: c })}>
                  {overseas
                    .filter((p) => p.country === c)
                    .map((p) => (
                      <option key={p.id} value={`port:${p.id}`}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label={t("To")} htmlFor="destinationPortId" error={e.destinationPortId}>
            <Select id="destinationPortId" name="destinationPortId" defaultValue="" aria-invalid={Boolean(e.destinationPortId)}>
              <option value="" disabled>
                {t("Choose a port")}
              </option>
              {[...ANZ, ...byCountry(ports).filter((c) => !ANZ.includes(c))].map((c) => (
                <optgroup key={c} label={c}>
                  {ports
                    .filter((p) => p.country === c)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">{t("Modes (none ticked means every mode)")}</legend>
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <label key={m} className="relative inline-flex min-h-11 cursor-pointer items-center">
                <input type="checkbox" name="modes" value={m} className="peer sr-only" />
                <span className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm font-semibold peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ring">
                  {t(MODE_LABEL[m])}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <input type="checkbox" name="destinationOnly" className="h-5 w-5 accent-[var(--sea)]" />
          {t("Only jobs where I price the destination side only (CIF, CFR and similar)")}
        </label>

        <Field label={t("Email me")} htmlFor="frequency" error={e.frequency}>
          <Select id="frequency" name="frequency" defaultValue="instant">
            {ALERT_FREQUENCIES.filter((f) => f !== "off").map((f) => (
              <option key={f} value={f}>
                {f === "instant" ? t("Instantly, as each job is posted") : t("One summary a day at 7am")}
              </option>
            ))}
          </Select>
        </Field>

        {state.message ? (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        ) : null}
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? t("Saving…") : t("Save lane")}
        </Button>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">
        {t("{label} means 7am Sydney time. Alerts go to the person who creates the lane.", { label: t(FREQUENCY_LABELS.daily) })}
      </p>
    </details>
  );
}
