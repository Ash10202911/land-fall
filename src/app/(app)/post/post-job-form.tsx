"use client";

import { startTransition, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { PortPicker, type Port } from "@/components/port-picker";
import {
  CONTAINER_LABELS,
  CONTAINER_TYPES,
  INCOTERMS,
  SERVICES,
  SERVICE_LABELS,
} from "@/lib/domain";
import { postJob, type JobFormState } from "./actions";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

export type JobDefaults = {
  direction: "import" | "export";
  incoterm: string;
  mode: "FCL" | "LCL" | "Air";
  originPortId: number;
  destinationPortId: number;
  containerType: string | null;
  containerQty: number | null;
  weightKg: number | null;
  volumeCbm: number | null;
  cargoDescription: string;
  services: string[];
  flagDg: boolean;
  flagReefer: boolean;
  flagBmsb: boolean;
  notes: string | null;
};

function Check({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string;
  value?: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="h-5 w-5 accent-[var(--accent)]"
      />
      {label}
    </label>
  );
}

export function PostJobForm({
  ports,
  defaults,
  companies,
}: {
  ports: Port[];
  defaults?: JobDefaults;
  companies?: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<JobFormState, FormData>(postJob, {});
  const [mode, setMode] = useState<"FCL" | "LCL" | "Air">(defaults?.mode ?? "FCL");
  const e = state.errors ?? {};
  const today = new Date().toISOString().slice(0, 10);

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
      {companies ? (
        <Section title="Admin: post on behalf of">
          <Field label="Company" htmlFor="onBehalfOf">
            <Select id="onBehalfOf" name="onBehalfOf" defaultValue="">
              <option value="">My own company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </Section>
      ) : null}

      <Section title="Shipment">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Direction" htmlFor="direction" error={e.direction}>
            <Select id="direction" name="direction" defaultValue={defaults?.direction ?? "import"} aria-invalid={Boolean(e.direction)}>
              <option value="import">Import to ANZ</option>
              <option value="export">Export from ANZ</option>
            </Select>
          </Field>
          <Field label="Incoterm" htmlFor="incoterm" error={e.incoterm}>
            <Select id="incoterm" name="incoterm" defaultValue={defaults?.incoterm ?? "FOB"} aria-invalid={Boolean(e.incoterm)}>
              {INCOTERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Mode" htmlFor="mode" error={e.mode}>
          <Select
            id="mode"
            name="mode"
            value={mode}
            onChange={(ev) => setMode(ev.target.value as "FCL" | "LCL" | "Air")}
            aria-invalid={Boolean(e.mode)}
          >
            <option value="FCL">FCL (full container)</option>
            <option value="LCL">LCL (part container)</option>
            <option value="Air">Air freight</option>
          </Select>
        </Field>
        <Field label="Origin port" htmlFor="originPortId" error={e.originPortId}>
          <PortPicker
            id="originPortId"
            name="originPortId"
            ports={ports}
            defaultPortId={defaults?.originPortId}
            invalid={Boolean(e.originPortId)}
          />
        </Field>
        <Field label="Destination port" htmlFor="destinationPortId" error={e.destinationPortId}>
          <PortPicker
            id="destinationPortId"
            name="destinationPortId"
            ports={ports}
            defaultPortId={defaults?.destinationPortId}
            invalid={Boolean(e.destinationPortId)}
          />
        </Field>
      </Section>

      <Section title="Cargo">
        {mode === "FCL" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Container type" htmlFor="containerType" error={e.containerType}>
              <Select id="containerType" name="containerType" defaultValue={defaults?.containerType ?? "40HC"} aria-invalid={Boolean(e.containerType)}>
                {CONTAINER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t} ({CONTAINER_LABELS[t]})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Quantity" htmlFor="containerQty" error={e.containerQty}>
              <Input
                id="containerQty"
                name="containerQty"
                type="number"
                inputMode="numeric"
                min={1}
                defaultValue={defaults?.containerQty ?? 1}
                aria-invalid={Boolean(e.containerQty)}
              />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Weight (kg)" htmlFor="weightKg" error={e.weightKg}>
              <Input
                id="weightKg"
                name="weightKg"
                defaultValue={defaults?.weightKg ?? undefined}
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                aria-invalid={Boolean(e.weightKg)}
              />
            </Field>
            <Field label="Volume (cbm)" htmlFor="volumeCbm" error={e.volumeCbm}>
              <Input
                id="volumeCbm"
                name="volumeCbm"
                defaultValue={defaults?.volumeCbm ?? undefined}
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                aria-invalid={Boolean(e.volumeCbm)}
              />
            </Field>
          </div>
        )}
        <Field label="Cargo description" htmlFor="cargoDescription" error={e.cargoDescription}>
          <Textarea
            id="cargoDescription"
            name="cargoDescription"
            defaultValue={defaults?.cargoDescription}
            aria-invalid={Boolean(e.cargoDescription)} />
        </Field>
        <div>
          <p className="mb-1 text-sm font-medium">Cargo flags</p>
          <Check name="flagDg" label="Dangerous goods" defaultChecked={defaults?.flagDg} />
          <Check name="flagReefer" label="Reefer (temperature controlled)" defaultChecked={defaults?.flagReefer} />
          <Check name="flagBmsb" label="BMSB-risk goods" defaultChecked={defaults?.flagBmsb} />
        </div>
        <Field label="Cargo ready date" htmlFor="readyDate" error={e.readyDate}>
          <Input id="readyDate" name="readyDate" type="date" min={today} aria-invalid={Boolean(e.readyDate)} />
        </Field>
      </Section>

      <Section title="Services needed">
        {SERVICES.map((s) => (
          <Check key={s} name="services" value={s} label={SERVICE_LABELS[s]} defaultChecked={defaults?.services.includes(s)} />
        ))}
      </Section>

      <Section title="Quote deadline">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="deadlineDate" error={e.deadlineDate}>
            <Input id="deadlineDate" name="deadlineDate" type="date" min={today} aria-invalid={Boolean(e.deadlineDate)} />
          </Field>
          <Field label="Time (UTC)" htmlFor="deadlineTime" error={e.deadlineTime}>
            <Input
              id="deadlineTime"
              name="deadlineTime"
              type="time"
              defaultValue="09:00"
              aria-invalid={Boolean(e.deadlineTime)}
            />
          </Field>
        </div>
        <Field label="Notes (optional)" htmlFor="notes" error={e.notes}>
          <Textarea id="notes" name="notes" defaultValue={defaults?.notes ?? undefined} aria-invalid={Boolean(e.notes)} />
        </Field>
      </Section>

      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      {Object.keys(e).length > 0 ? (
        <p role="alert" className="text-sm text-destructive">
          Please fix the highlighted fields.
        </p>
      ) : null}
      <Button type="submit" variant="accent" size="full" disabled={pending}>
        {pending ? "Posting…" : "Post job"}
      </Button>
    </form>
  );
}
