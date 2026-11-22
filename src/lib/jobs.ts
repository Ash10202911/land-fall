import { CONTAINER_LABELS, SERVICE_LABELS } from "@/lib/domain";
import type { REPEAT_FREQUENCIES, UNLOAD_TYPES } from "@/lib/scope";

export type PortRef = { code: string; name: string; country: string };

export type JobRow = {
  id: string;
  company_id: string;
  created_by: string;
  direction: "import" | "export";
  incoterm: string;
  mode: "FCL" | "LCL" | "Air";
  container_type: keyof typeof CONTAINER_LABELS | null;
  container_qty: number | null;
  weight_kg: number | null;
  volume_cbm: number | null;
  cargo_description: string;
  ready_date: string;
  services: (keyof typeof SERVICE_LABELS)[];
  flag_dg: boolean;
  flag_reefer: boolean;
  flag_bmsb: boolean;
  deadline_at: string;
  notes: string | null;
  status: "open" | "awarded" | "cancelled";
  awarded_quote_id: string | null;
  created_at: string;
  delivery_suburb: string | null;
  delivery_postcode: string | null;
  unload_type: (typeof UNLOAD_TYPES)[number] | null;
  repeat_frequency: (typeof REPEAT_FREQUENCIES)[number];
  repeat_volume: string | null;
  required_by: string | null;
  origin: PortRef;
  destination: PortRef;
  company: { id: string; name: string; country: string; trust_level: "basic" | "verified" } | null;
};

/** PostgREST select string for a job with its ports and posting company. */
export const JOB_SELECT = `
  id, company_id, created_by, direction, incoterm, mode, container_type, container_qty,
  weight_kg, volume_cbm, cargo_description, ready_date, services, flag_dg, flag_reefer,
  flag_bmsb, deadline_at, notes, status, awarded_quote_id, created_at,
  delivery_suburb, delivery_postcode, unload_type, repeat_frequency, repeat_volume, required_by,
  origin:ports!origin_port_id(code, name, country),
  destination:ports!destination_port_id(code, name, country),
  company:companies(id, name, country, trust_level)
`;

/** Embedded to-one relations can arrive as an object or a one-element array. */
export function normaliseJob(row: unknown): JobRow {
  const r = row as Record<string, unknown>;
  const one = <T,>(v: unknown): T => (Array.isArray(v) ? (v[0] as T) : (v as T));
  return {
    ...(r as unknown as JobRow),
    origin: one<PortRef>(r.origin),
    destination: one<PortRef>(r.destination),
    company: one<JobRow["company"]>(r.company) ?? null,
  };
}

export function portLabel(p: PortRef) {
  return `${p.name} (${p.code})`;
}

export function cargoSummary(j: Pick<JobRow, "mode" | "container_type" | "container_qty" | "weight_kg" | "volume_cbm">) {
  if (j.mode === "FCL") {
    return `${j.container_qty ?? 1} × ${j.container_type ?? ""}`.trim();
  }
  return `${j.weight_kg ?? 0} kg · ${j.volume_cbm ?? 0} cbm`;
}
