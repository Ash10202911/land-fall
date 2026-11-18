"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { CURRENCIES, formatMoney, parseMoneyToMinor, totalsByCurrency } from "@/lib/domain";
import type { FormState } from "@/lib/validation/auth";
import { submitQuote, updateQuote } from "./quote-actions";

export type LineDraft = { chargeName: string; amount: string; currency: string; gstIncluded: boolean };

const blankLine = (): LineDraft => ({ chargeName: "", amount: "", currency: "AUD", gstIncluded: true });

export function QuoteForm({
  jobId,
  quoteId,
  initialLines,
  initialValidUntil,
  initialNotes,
  minDate,
}: {
  jobId: string;
  quoteId?: string;
  initialLines?: LineDraft[];
  initialValidUntil: string;
  initialNotes?: string;
  minDate: string;
}) {
  const bound = quoteId
    ? (prev: FormState, fd: FormData) => updateQuote(jobId, quoteId, prev, fd)
    : (prev: FormState, fd: FormData) => submitQuote(jobId, prev, fd);
  const [state, action, pending] = useActionState<FormState, FormData>(bound, {});
  const [lines, setLines] = useState<LineDraft[]>(initialLines?.length ? initialLines : [blankLine()]);
  const e = state.errors ?? {};

  const totals = useMemo(
    () =>
      totalsByCurrency(
        lines.flatMap((l) => {
          const minor = parseMoneyToMinor(l.amount);
          return minor === null ? [] : [{ amount_minor: minor, currency: l.currency }];
        }),
      ),
    [lines],
  );

  function update(i: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        const data = new FormData(ev.currentTarget);
        data.set("lines", JSON.stringify(lines));
        startTransition(() => action(data));
      }}
    >
      <ul className="space-y-3">
        {lines.map((line, i) => (
          <li key={i} className="space-y-3 rounded-xl border border-border p-3">
            <Field label={`Charge ${i + 1}`} htmlFor={`charge-${i}`} error={e[`lines.${i}.chargeName`]}>
              <Input
                id={`charge-${i}`}
                value={line.chargeName}
                placeholder="For example, Destination terminal handling"
                onChange={(ev) => update(i, { chargeName: ev.target.value })}
                aria-invalid={Boolean(e[`lines.${i}.chargeName`])}
              />
            </Field>
            <div className="grid grid-cols-[1fr_6.5rem] gap-3">
              <Field label="Amount" htmlFor={`amount-${i}`} error={e[`lines.${i}.amount`]}>
                <Input
                  id={`amount-${i}`}
                  inputMode="decimal"
                  value={line.amount}
                  placeholder="0.00"
                  onChange={(ev) => update(i, { amount: ev.target.value })}
                  aria-invalid={Boolean(e[`lines.${i}.amount`])}
                />
              </Field>
              <Field label="Currency" htmlFor={`currency-${i}`} error={e[`lines.${i}.currency`]}>
                <Select
                  id={`currency-${i}`}
                  value={line.currency}
                  onChange={(ev) => update(i, { currency: ev.target.value })}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={line.gstIncluded}
                  onChange={(ev) => update(i, { gstIncluded: ev.target.checked })}
                  className="h-5 w-5 accent-[var(--accent)]"
                />
                GST included
              </label>
              {lines.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label={`Remove charge ${i + 1}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Remove
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {e.lines ? (
        <p role="alert" className="text-sm text-destructive">
          {e.lines}
        </p>
      ) : null}
      {lines.length < 20 ? (
        <Button type="button" variant="outline" onClick={() => setLines((prev) => [...prev, blankLine()])}>
          <Plus className="h-4 w-4" aria-hidden />
          Add charge
        </Button>
      ) : null}

      <div className="rounded-xl bg-muted p-3 text-sm" aria-live="polite">
        <p className="font-medium">Total</p>
        {totals.length === 0 ? (
          <p className="text-muted-foreground">Add an amount to see the total.</p>
        ) : (
          <ul>
            {totals.map((t) => (
              <li key={t.currency}>{formatMoney(t.minor, t.currency)}</li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-muted-foreground">Totals are shown per currency. No conversion.</p>
      </div>

      <Field label="Quote valid until" htmlFor="validUntil" error={e.validUntil}>
        <Input
          id="validUntil"
          name="validUntil"
          type="date"
          min={minDate}
          defaultValue={initialValidUntil}
          aria-invalid={Boolean(e.validUntil)}
        />
      </Field>
      <Field label="Notes (optional)" htmlFor="notes" error={e.notes}>
        <Textarea id="notes" name="notes" defaultValue={initialNotes ?? ""} aria-invalid={Boolean(e.notes)} />
      </Field>

      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="accent" size="full" disabled={pending}>
        {pending ? "Saving…" : quoteId ? "Save changes" : "Send sealed quote"}
      </Button>
    </form>
  );
}
