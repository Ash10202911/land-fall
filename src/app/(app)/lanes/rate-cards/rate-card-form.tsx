"use client";

import { startTransition, useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { CURRENCIES } from "@/lib/domain";
import { UNLOAD_LABELS, UNLOAD_TYPES } from "@/lib/scope";
import type { FormState } from "@/lib/validation/auth";
import { BASIS_LABELS, CATEGORY_LABELS, CHARGE_CATEGORIES, MAX_RATE_ROWS, RATE_BASES } from "@/lib/validation/rate-card";
import { saveRateCard } from "../actions";
import type { PortOption } from "../add-lane-form";
import { useT } from "@/components/i18n-provider";

export type RowDraft = {
  kind: "charge" | "zone";
  name: string;
  category: string;
  basis: string;
  amount: string;
  gstIncluded: boolean;
  postcodeFrom: string;
  postcodeTo: string;
  unloadType: string;
};

export type CardDraft = {
  id?: string;
  name: string;
  destinationPortId: string;
  currency: string;
  validTo: string;
  rows: RowDraft[];
};

const blankCharge = (): RowDraft => ({
  kind: "charge", name: "", category: "destination", basis: "per_job", amount: "", gstIncluded: true, postcodeFrom: "", postcodeTo: "", unloadType: "",
});
const blankZone = (): RowDraft => ({
  kind: "zone", name: "", category: "delivery", basis: "per_container", amount: "", gstIncluded: true, postcodeFrom: "", postcodeTo: "", unloadType: "",
});

/** Editor for one rate card: fixed charges, then cartage zones by postcode range. */
export function RateCardForm({ ports, initial, minDate }: { ports: PortOption[]; initial: CardDraft; minDate: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(saveRateCard, {});
  const [charges, setCharges] = useState<RowDraft[]>(initial.rows.filter((r) => r.kind === "charge").length ? initial.rows.filter((r) => r.kind === "charge") : [blankCharge()]);
  const [zones, setZones] = useState<RowDraft[]>(initial.rows.filter((r) => r.kind === "zone"));
  const e = state.errors ?? {};
  const total = charges.length + zones.length;

  const patch = (list: RowDraft[], set: (r: RowDraft[]) => void, i: number, p: Partial<RowDraft>) =>
    set(list.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  // Errors are keyed by position in the merged list: charges first, then zones.
  const err = (index: number, field: string) => e[`rows.${index}.${field}`];

  const destinations = [...new Set(ports.map((p) => p.country))];

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(ev) => {
        ev.preventDefault();
        const data = new FormData(ev.currentTarget);
        data.set("rows", JSON.stringify([...charges, ...zones]));
        startTransition(() => action(data));
      }}
    >
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <section className="space-y-4 rounded-[20px] border border-border bg-card p-4 shadow-card">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("Name")} htmlFor="name" error={e.name} hint={t("For example: Port Botany destination charges")}>
            <Input id="name" name="name" defaultValue={initial.name} aria-invalid={Boolean(e.name)} />
          </Field>
          <Field label={t("Destination port")} htmlFor="destinationPortId" error={e.destinationPortId}>
            <Select id="destinationPortId" name="destinationPortId" defaultValue={initial.destinationPortId} aria-invalid={Boolean(e.destinationPortId)}>
              <option value="" disabled>
                {t("Choose a port")}
              </option>
              {destinations.map((c) => (
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
            <Select id="currency" name="currency" defaultValue={initial.currency}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("Prices valid to")} htmlFor="validTo" error={e.validTo}>
            <Input id="validTo" name="validTo" type="date" min={minDate} defaultValue={initial.validTo} aria-invalid={Boolean(e.validTo)} />
          </Field>
        </div>
      </section>

      <section aria-labelledby="charges-heading" className="space-y-3">
        <div>
          <h2 id="charges-heading" className="text-lg font-semibold tracking-tight">
            {t("Fixed charges")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("Port charges, fees and customs. Pick what each is priced per, and the quote works out the total from the job.")}
          </p>
        </div>
        <ul className="space-y-3">
          {charges.map((r, i) => (
            <li key={i} className="space-y-3 rounded-2xl border border-border bg-card p-3 shadow-card">
              <Field label={`Charge ${i + 1}`} htmlFor={`charge-name-${i}`} error={err(i, "name")}>
                <Input id={`charge-name-${i}`} value={r.name} placeholder={t("Port service charge (THC)")} onChange={(ev) => patch(charges, setCharges, i, { name: ev.target.value })} aria-invalid={Boolean(err(i, "name"))} />
              </Field>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Field label={t("Type")} htmlFor={`charge-category-${i}`} error={err(i, "category")}>
                  <Select id={`charge-category-${i}`} value={r.category} onChange={(ev) => patch(charges, setCharges, i, { category: ev.target.value, unloadType: ev.target.value === "delivery" ? r.unloadType : "" })}>
                    {CHARGE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("Priced")} htmlFor={`charge-basis-${i}`} error={err(i, "basis")}>
                  <Select id={`charge-basis-${i}`} value={r.basis} onChange={(ev) => patch(charges, setCharges, i, { basis: ev.target.value })}>
                    {RATE_BASES.map((b) => (
                      <option key={b} value={b}>
                        {BASIS_LABELS[b]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("Amount")} htmlFor={`charge-amount-${i}`} error={err(i, "amount")}>
                  <Input id={`charge-amount-${i}`} inputMode="decimal" value={r.amount} placeholder="165.00" onChange={(ev) => patch(charges, setCharges, i, { amount: ev.target.value })} aria-invalid={Boolean(err(i, "amount"))} />
                </Field>
                {r.category === "delivery" ? (
                  <Field label={t("Only when unloading")} htmlFor={`charge-unload-${i}`} error={err(i, "unloadType")}>
                    <Select id={`charge-unload-${i}`} value={r.unloadType} onChange={(ev) => patch(charges, setCharges, i, { unloadType: ev.target.value })}>
                      <option value="">{t("Always")}</option>
                      {UNLOAD_TYPES.map((u) => (
                        <option key={u} value={u}>
                          {UNLOAD_LABELS[u]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
              </div>
              <div className="flex items-center justify-between">
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input type="checkbox" checked={r.gstIncluded} onChange={(ev) => patch(charges, setCharges, i, { gstIncluded: ev.target.checked })} className="h-5 w-5 accent-[var(--sea)]" />
                  {t("GST included")}
                </label>
                {charges.length > 1 ? (
                  <Button type="button" variant="ghost" onClick={() => setCharges(charges.filter((_, idx) => idx !== i))} aria-label={`Remove charge ${i + 1}`}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                    {t("Remove")}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" disabled={total >= MAX_RATE_ROWS} onClick={() => setCharges([...charges, blankCharge()])}>
          <Plus className="h-4 w-4" aria-hidden />
          {t("Add a charge")}
        </Button>
      </section>

      <section aria-labelledby="zones-heading" className="space-y-3">
        <div>
          <h2 id="zones-heading" className="text-lg font-semibold tracking-tight">
            {t("Cartage by postcode zone")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("The job's delivery postcode picks the zone. Add side-loader or tailgate extras above as delivery charges.")}</p>
        </div>
        {zones.length === 0 ? <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{t("No zones yet. Without a zone, quotes will not include cartage.")}</p> : null}
        <ul className="space-y-3">
          {zones.map((r, j) => {
            const index = charges.length + j;
            return (
              <li key={j} className="space-y-3 rounded-2xl border border-border bg-card p-3 shadow-card">
                <Field label={`Zone ${j + 1}`} htmlFor={`zone-name-${j}`} error={err(index, "name")}>
                  <Input id={`zone-name-${j}`} value={r.name} placeholder={t("Zone 2 western Sydney")} onChange={(ev) => patch(zones, setZones, j, { name: ev.target.value })} aria-invalid={Boolean(err(index, "name"))} />
                </Field>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Field label={t("From postcode")} htmlFor={`zone-from-${j}`} error={err(index, "postcodeFrom")}>
                    <Input id={`zone-from-${j}`} inputMode="numeric" maxLength={4} value={r.postcodeFrom} onChange={(ev) => patch(zones, setZones, j, { postcodeFrom: ev.target.value })} aria-invalid={Boolean(err(index, "postcodeFrom"))} />
                  </Field>
                  <Field label={t("To postcode")} htmlFor={`zone-to-${j}`} error={err(index, "postcodeTo")}>
                    <Input id={`zone-to-${j}`} inputMode="numeric" maxLength={4} value={r.postcodeTo} onChange={(ev) => patch(zones, setZones, j, { postcodeTo: ev.target.value })} aria-invalid={Boolean(err(index, "postcodeTo"))} />
                  </Field>
                  <Field label={t("Priced")} htmlFor={`zone-basis-${j}`} error={err(index, "basis")}>
                    <Select id={`zone-basis-${j}`} value={r.basis} onChange={(ev) => patch(zones, setZones, j, { basis: ev.target.value })}>
                      {RATE_BASES.map((b) => (
                        <option key={b} value={b}>
                          {BASIS_LABELS[b]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("Amount")} htmlFor={`zone-amount-${j}`} error={err(index, "amount")}>
                    <Input id={`zone-amount-${j}`} inputMode="decimal" value={r.amount} placeholder="560.00" onChange={(ev) => patch(zones, setZones, j, { amount: ev.target.value })} aria-invalid={Boolean(err(index, "amount"))} />
                  </Field>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex min-h-11 items-center gap-3 text-sm">
                    <input type="checkbox" checked={r.gstIncluded} onChange={(ev) => patch(zones, setZones, j, { gstIncluded: ev.target.checked })} className="h-5 w-5 accent-[var(--sea)]" />
                    {t("GST included")}
                  </label>
                  <Button type="button" variant="ghost" onClick={() => setZones(zones.filter((_, idx) => idx !== j))} aria-label={`Remove zone ${j + 1}`}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                    {t("Remove")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        <Button type="button" variant="outline" disabled={total >= MAX_RATE_ROWS} onClick={() => setZones([...zones, blankZone()])}>
          <Plus className="h-4 w-4" aria-hidden />
          {t("Add a zone")}
        </Button>
      </section>

      {e.rows ? (
        <p role="alert" className="text-sm text-destructive">
          {e.rows}
        </p>
      ) : null}
      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      {Object.keys(e).length > 0 ? (
        <p role="alert" className="text-sm text-destructive">
          {t("Please fix the highlighted fields.")}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? t("Saving…") : t("Save rate card")}
        </Button>
        <Link href="/lanes" className="inline-flex min-h-11 items-center rounded-xl border border-input bg-card px-4 text-sm font-semibold">
          {t("Cancel")}
        </Link>
      </div>
    </form>
  );
}
