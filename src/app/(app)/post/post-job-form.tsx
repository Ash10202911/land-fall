"use client";

import { startTransition, useActionState, useState } from "react";
import { Lock, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { PortPicker, type Port } from "@/components/port-picker";
import { ScopeStrip } from "@/components/scope-strip";
import { CONTAINER_TYPES, INCOTERMS } from "@/lib/domain";
import {
  REPEAT_FREQUENCIES,
  REPEAT_LABELS,
  UNLOAD_LABELS,
  UNLOAD_TYPES,
  scopeFor,
  type LegKey,
} from "@/lib/scope";
import { cn } from "@/lib/utils";
import { postJob, type JobFormState } from "./actions";

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
  deliverySuburb: string | null;
  deliveryPostcode: string | null;
  unloadType: string | null;
  repeatFrequency: string;
  repeatVolume: string | null;
};

type Mode = "FCL" | "LCL" | "Air";
type Services = { destination_charges: boolean; customs_clearance: boolean; delivery: boolean };

const QUICK_TERMS = ["EXW", "FOB", "CIF", "DAP"] as const;
const CLOSE_OPTIONS = [
  ["24", "24 h"],
  ["48", "48 h"],
  ["72", "72 h"],
  ["168", "7 days"],
  ["custom", "Pick a date"],
] as const;

/** Sensible destination services for each Incoterm; the requester can change them on the strip. */
function servicesFor(incoterm: string): Services {
  if (incoterm === "DDP") return { destination_charges: false, customs_clearance: false, delivery: false };
  if (incoterm === "DAP" || incoterm === "DPU") return { destination_charges: false, customs_clearance: true, delivery: false };
  return { destination_charges: true, customs_clearance: true, delivery: false };
}

const LEG_TO_SERVICE: Partial<Record<LegKey, keyof Services>> = {
  destination: "destination_charges",
  customs: "customs_clearance",
  delivery: "delivery",
};

function Chip({
  on,
  onClick,
  children,
  className,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors",
        on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-foreground hover:border-sea",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-[20px] border border-border bg-card p-4 shadow-card">
      <legend className="sr-only">{title}</legend>
      <p aria-hidden className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </fieldset>
  );
}

function FlagToggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="relative inline-flex min-h-11 cursor-pointer items-center">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm font-semibold peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ring">
        {label}
      </span>
    </label>
  );
}

/**
 * Request a quote in about 30 seconds: route and cargo, the Incoterm (which sets what forwarders
 * price), delivery suburb, dates. Less common choices sit behind one "Defaults" line.
 */
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
  const e = state.errors ?? {};
  const today = new Date().toISOString().slice(0, 10);

  const [mode, setMode] = useState<Mode>(defaults?.mode ?? "FCL");
  const [qty, setQty] = useState<number>(defaults?.containerQty ?? 1);
  const [ctype, setCtype] = useState<string>(defaults?.containerType ?? "40HC");
  const [incoterm, setIncoterm] = useState<string>(defaults?.incoterm ?? "FOB");
  const [services, setServices] = useState<Services>(() =>
    defaults
      ? {
          destination_charges: defaults.services.includes("destination_charges"),
          customs_clearance: defaults.services.includes("customs_clearance"),
          delivery: defaults.services.includes("delivery"),
        }
      : servicesFor("FOB"),
  );
  const [unload, setUnload] = useState<string>(defaults?.unloadType ?? "");
  const [closeIn, setCloseIn] = useState<string>("48");
  const [repeat, setRepeat] = useState<string>(defaults?.repeatFrequency ?? "one_off");
  const [direction, setDirection] = useState<"import" | "export">(defaults?.direction ?? "import");
  const [moreOpen, setMoreOpen] = useState(false);

  const hiddenErrors = ["deadlineDate", "deadlineTime", "notes", "repeatVolume", "closeIn"].some((k) => e[k]);
  const showMore = moreOpen || hiddenErrors;
  const picked = (Object.keys(services) as (keyof Services)[]).filter((k) => services[k]);
  const scope = scopeFor(incoterm, picked);
  const air = mode === "Air";
  const closeLabel = CLOSE_OPTIONS.find(([v]) => v === closeIn)?.[1] ?? "48 h";

  const chooseTerm = (term: string) => {
    setIncoterm(term);
    setServices(servicesFor(term));
  };
  const toggleLeg = (key: LegKey) => {
    const s = LEG_TO_SERVICE[key];
    if (s) setServices((prev) => ({ ...prev, [s]: !prev[s] }));
  };

  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        const data = new FormData(ev.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="incoterm" value={incoterm} />
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="closeIn" value={closeIn} />
      <input type="hidden" name="repeatFrequency" value={repeat} />
      {mode === "FCL" ? <input type="hidden" name="containerType" value={ctype} /> : null}
      {services.delivery ? <input type="hidden" name="unloadType" value={unload} /> : null}
      {picked.map((s) => (
        <input key={s} type="hidden" name="services" value={s} />
      ))}

      {companies ? (
        <Card title="Admin: post on behalf of">
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
        </Card>
      ) : null}

      <Card title="Route and cargo">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From" htmlFor="originPortId" error={e.originPortId}>
            <PortPicker id="originPortId" name="originPortId" ports={ports} defaultPortId={defaults?.originPortId} invalid={Boolean(e.originPortId)} />
          </Field>
          <Field label="To" htmlFor="destinationPortId" error={e.destinationPortId}>
            <PortPicker
              id="destinationPortId"
              name="destinationPortId"
              ports={ports}
              defaultPortId={defaults?.destinationPortId}
              invalid={Boolean(e.destinationPortId)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Mode">
          <Chip on={mode === "FCL"} onClick={() => setMode("FCL")}>Sea FCL</Chip>
          <Chip on={mode === "LCL"} onClick={() => setMode("LCL")}>Sea LCL</Chip>
          <Chip on={mode === "Air"} onClick={() => setMode("Air")}>Air</Chip>
        </div>
        {mode === "FCL" ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center overflow-hidden rounded-xl border border-input">
              <button type="button" aria-label="One fewer container" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-11 w-11 place-items-center bg-muted/60">
                <Minus className="h-4 w-4" aria-hidden />
              </button>
              <label htmlFor="containerQty" className="sr-only">
                Number of containers
              </label>
              <input
                id="containerQty"
                name="containerQty"
                inputMode="numeric"
                value={qty}
                onChange={(ev) => setQty(Math.max(1, Math.min(999, Number.parseInt(ev.target.value, 10) || 1)))}
                className="h-11 w-12 bg-card text-center text-lg font-bold"
                aria-invalid={Boolean(e.containerQty)}
              />
              <button type="button" aria-label="One more container" onClick={() => setQty((q) => Math.min(999, q + 1))} className="grid h-11 w-11 place-items-center bg-muted/60">
                <Plus className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <span className="font-bold text-muted-foreground" aria-hidden>
              ×
            </span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Container type">
              {CONTAINER_TYPES.map((term) => (
                <Chip key={term} on={ctype === term} onClick={() => setCtype(term)} className="px-2.5">
                  {term}
                </Chip>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Weight (kg)" htmlFor="weightKg" error={e.weightKg}>
              <Input id="weightKg" name="weightKg" type="number" inputMode="decimal" step="any" min={0} defaultValue={defaults?.weightKg ?? undefined} aria-invalid={Boolean(e.weightKg)} />
            </Field>
            <Field label="Volume (cbm)" htmlFor="volumeCbm" error={e.volumeCbm}>
              <Input id="volumeCbm" name="volumeCbm" type="number" inputMode="decimal" step="any" min={0} defaultValue={defaults?.volumeCbm ?? undefined} aria-invalid={Boolean(e.volumeCbm)} />
            </Field>
          </div>
        )}
        <Field label="What is it?" htmlFor="cargoDescription" error={e.cargoDescription} hint="A short line is enough, for example: furniture and homewares, palletised.">
          <Input id="cargoDescription" name="cargoDescription" defaultValue={defaults?.cargoDescription} aria-invalid={Boolean(e.cargoDescription)} />
        </Field>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Special cargo">
          <FlagToggle name="flagDg" label="Dangerous goods" defaultChecked={defaults?.flagDg} />
          <FlagToggle name="flagReefer" label="Reefer" defaultChecked={defaults?.flagReefer} />
          <FlagToggle name="flagBmsb" label="BMSB risk" defaultChecked={defaults?.flagBmsb} />
        </div>
      </Card>

      <Card title="Incoterm and what forwarders price">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Incoterm">
          {QUICK_TERMS.map((term) => (
            <Chip key={term} on={incoterm === term} onClick={() => chooseTerm(term)}>
              {term}
            </Chip>
          ))}
          <label className="min-w-28 flex-1">
            <span className="sr-only">Other Incoterm</span>
            <Select
              value={(QUICK_TERMS as readonly string[]).includes(incoterm) ? "" : incoterm}
              onChange={(ev) => ev.target.value && chooseTerm(ev.target.value)}
            >
              <option value="">More…</option>
              {INCOTERMS.filter((term) => !(QUICK_TERMS as readonly string[]).includes(term)).map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <p className="text-sm font-bold">
          Forwarders price: <span className="text-sea-ink">{scope.summary}</span>
        </p>
        <ScopeStrip legs={scope.legs} air={air} onToggle={toggleLeg} />
        <p className="text-xs text-muted-foreground">Tap Dest., Customs or Delivery to add or remove it. Pickup and freight follow the Incoterm.</p>
      </Card>

      {services.delivery ? (
        <Card title="Delivery">
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
            <Field label="Suburb" htmlFor="deliverySuburb" error={e.deliverySuburb}>
              <Input id="deliverySuburb" name="deliverySuburb" autoComplete="address-level2" defaultValue={defaults?.deliverySuburb ?? undefined} aria-invalid={Boolean(e.deliverySuburb)} />
            </Field>
            <Field label="Postcode" htmlFor="deliveryPostcode" error={e.deliveryPostcode}>
              <Input id="deliveryPostcode" name="deliveryPostcode" inputMode="numeric" maxLength={4} autoComplete="postal-code" defaultValue={defaults?.deliveryPostcode ?? undefined} aria-invalid={Boolean(e.deliveryPostcode)} />
            </Field>
          </div>
          <div>
            <p id="unload-label" className="mb-1.5 text-sm font-semibold">
              How will it be unloaded?
            </p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="unload-label">
              {UNLOAD_TYPES.map((u) => (
                <Chip key={u} on={unload === u} onClick={() => setUnload(u)}>
                  {UNLOAD_LABELS[u]}
                </Chip>
              ))}
            </div>
            {e.unloadType ? (
              <p role="alert" className="mt-1 text-sm text-destructive">
                {e.unloadType}
              </p>
            ) : null}
          </div>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            The suburb shows on the board. We ask for the street address only when you award, and share it with the winner alone.
          </p>
        </Card>
      ) : null}

      <Card title="When">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ready on" htmlFor="readyDate" error={e.readyDate}>
            <Input id="readyDate" name="readyDate" type="date" min={today} aria-invalid={Boolean(e.readyDate)} />
          </Field>
          <Field label="Needed by (optional)" htmlFor="requiredBy" error={e.requiredBy}>
            <Input id="requiredBy" name="requiredBy" type="date" min={today} aria-invalid={Boolean(e.requiredBy)} />
          </Field>
        </div>
      </Card>

      <section className="rounded-[20px] border border-border bg-card p-4 shadow-card">
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={showMore}
          aria-controls="defaults-panel"
          className="flex min-h-11 w-full items-center gap-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">Defaults</span>
            <span className="mt-1 block text-sm font-semibold">
              Closes in {closeLabel} · {REPEAT_LABELS[repeat as (typeof REPEAT_FREQUENCIES)[number]]} ·{" "}
              {direction === "import" ? "Import to ANZ" : "Export from ANZ"}
            </span>
          </span>
          <span className="text-sm font-bold text-accent">{showMore ? "Done" : "Change"}</span>
        </button>
        <div id="defaults-panel" hidden={!showMore} className="mt-3 space-y-4">
          <div>
            <p id="close-label" className="mb-1.5 text-sm font-semibold">
              Quotes close in
            </p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="close-label">
              {CLOSE_OPTIONS.map(([v, label]) => (
                <Chip key={v} on={closeIn === v} onClick={() => setCloseIn(v)}>
                  {label}
                </Chip>
              ))}
            </div>
          </div>
          {closeIn === "custom" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Deadline date" htmlFor="deadlineDate" error={e.deadlineDate}>
                <Input id="deadlineDate" name="deadlineDate" type="date" min={today} aria-invalid={Boolean(e.deadlineDate)} />
              </Field>
              <Field label="Time (UTC)" htmlFor="deadlineTime" error={e.deadlineTime}>
                <Input id="deadlineTime" name="deadlineTime" type="time" defaultValue="09:00" aria-invalid={Boolean(e.deadlineTime)} />
              </Field>
            </div>
          ) : e.deadlineDate ? (
            <p role="alert" className="text-sm text-destructive">
              {e.deadlineDate}
            </p>
          ) : null}
          <div>
            <p id="repeat-label" className="mb-1.5 text-sm font-semibold">
              Is this regular work?
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="group" aria-labelledby="repeat-label">
              {REPEAT_FREQUENCIES.map((r) => (
                <Chip key={r} on={repeat === r} onClick={() => setRepeat(r)}>
                  {REPEAT_LABELS[r]}
                </Chip>
              ))}
            </div>
          </div>
          {repeat !== "one_off" ? (
            <Field label="Expected volume each time" htmlFor="repeatVolume" error={e.repeatVolume} hint="Regular work gets a green badge on the board and attracts more quotes.">
              <Input id="repeatVolume" name="repeatVolume" defaultValue={defaults?.repeatVolume ?? undefined} placeholder="About 4 x 40HC" aria-invalid={Boolean(e.repeatVolume)} />
            </Field>
          ) : null}
          <div>
            <p id="direction-label" className="mb-1.5 text-sm font-semibold">
              Direction
            </p>
            <div className="grid grid-cols-2 gap-1.5" role="group" aria-labelledby="direction-label">
              <Chip on={direction === "import"} onClick={() => setDirection("import")}>Import to ANZ</Chip>
              <Chip on={direction === "export"} onClick={() => setDirection("export")}>Export from ANZ</Chip>
            </div>
          </div>
          <Field label="Notes (optional)" htmlFor="notes" error={e.notes}>
            <Textarea id="notes" name="notes" defaultValue={defaults?.notes ?? undefined} aria-invalid={Boolean(e.notes)} />
          </Field>
        </div>
      </section>

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

      <div className="sticky bottom-[5.5rem] z-10 flex items-center gap-3 rounded-[22px] bg-primary p-3 pl-4 text-primary-foreground shadow-lift md:bottom-4">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">
            {scope.summary} · {mode === "FCL" ? `${qty} × ${ctype}` : mode === "Air" ? "Air" : "Sea LCL"}
          </span>
          <span className="block truncate text-xs text-cyan-100">
            {incoterm} · closes in {closeLabel}
            {repeat !== "one_off" ? ` · ${REPEAT_LABELS[repeat as (typeof REPEAT_FREQUENCIES)[number]]}` : ""}
          </span>
        </span>
        <Button type="submit" disabled={pending} className="shrink-0 bg-cyan-300 text-primary hover:bg-cyan-200">
          {pending ? "Posting…" : "Post request"}
        </Button>
      </div>
    </form>
  );
}
