import { tEn, type Translator } from "@/lib/i18n";
import { formatMoney } from "@/lib/domain";
import { UNLOAD_LABELS } from "@/lib/scope";
import { CATEGORY_SERVICE } from "@/lib/validation/rate-card";

export type ChargeRow = {
  position: number;
  kind: "charge" | "zone";
  name: string;
  category: "destination" | "customs" | "delivery";
  basis: "per_job" | "per_container" | "per_20ft" | "per_40ft" | "per_cbm" | "per_kg";
  amount_minor: number | string;
  gst_included: boolean;
  postcode_from: number | null;
  postcode_to: number | null;
  unload_type: string | null;
};

export type RateCard = {
  id: string;
  name: string;
  currency: string;
  valid_to: string;
  destination_code: string;
  updated_at?: string;
  charges: ChargeRow[];
};

/** The parts of a job a rate card needs. */
export type QuoteJob = {
  mode: "FCL" | "LCL" | "Air";
  container_type: string | null;
  container_qty: number | null;
  weight_kg: number | string | null;
  volume_cbm: number | string | null;
  services: readonly string[];
  unload_type: string | null;
  delivery_suburb: string | null;
  delivery_postcode: string | null;
  destination_code: string;
};

export type PrefillLine = {
  chargeName: string;
  amount: string;
  currency: string;
  gstIncluded: boolean;
  category: "destination" | "customs" | "delivery";
  /** Where the line came from, shown to the forwarder so nothing is a surprise. */
  source: string;
  minor: number;
};

/** The newest valid card for the job's destination port, or null. Expired cards are ignored. */
export function pickRateCard(cards: RateCard[], destinationCode: string, today: string): RateCard | null {
  const usable = cards
    .filter((c) => c.destination_code === destinationCode && c.valid_to >= today)
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
  return usable[0] ?? null;
}

function quantity(row: ChargeRow, job: QuoteJob): { qty: number; label: (unit: string) => string } | null {
  const containers = job.mode === "FCL" ? (job.container_qty ?? 0) : 0;
  const type = job.container_type ?? "";
  const loose = job.mode !== "FCL";
  switch (row.basis) {
    case "per_job":
      return { qty: 1, label: () => "" };
    case "per_container":
      return containers > 0 ? { qty: containers, label: (u) => ` · ${containers} × ${u}` } : null;
    case "per_20ft":
      return containers > 0 && type.startsWith("20") ? { qty: containers, label: (u) => ` · ${containers} × ${u}` } : null;
    case "per_40ft":
      return containers > 0 && type.startsWith("40") ? { qty: containers, label: (u) => ` · ${containers} × ${u}` } : null;
    case "per_cbm": {
      const cbm = Number(job.volume_cbm ?? 0);
      return loose && cbm > 0 ? { qty: cbm, label: (u) => ` · ${cbm} cbm × ${u}` } : null;
    }
    case "per_kg": {
      const kg = Number(job.weight_kg ?? 0);
      return loose && kg > 0 ? { qty: kg, label: (u) => ` · ${kg} kg × ${u}` } : null;
    }
  }
}

/**
 * Works out the quote lines a rate card gives for a job: only the charges for the services the job asks
 * for, the cartage zone that covers the delivery postcode, and any unload rule that matches. Nothing is
 * sent: the forwarder checks and edits the result before sending.
 */
export function buildQuoteFromRateCard(card: RateCard, job: QuoteJob, t: Translator = tEn): { lines: PrefillLine[]; warnings: string[]; totalMinor: number } {
  const lines: PrefillLine[] = [];
  const warnings: string[] = [];
  const rows = [...card.charges].sort((a, b) => a.position - b.position);
  const wantsDelivery = job.services.includes(CATEGORY_SERVICE.delivery);
  const postcode = job.delivery_postcode ? Number(job.delivery_postcode) : null;

  const zones = rows.filter((r) => r.kind === "zone");
  const zone =
    wantsDelivery && postcode !== null ? zones.find((z) => z.postcode_from! <= postcode && postcode <= z.postcode_to!) : undefined;
  if (wantsDelivery && zones.length === 0) {
    warnings.push(t("\"{name}\" has no cartage zones, so delivery is not included.", { name: card.name }));
  } else if (wantsDelivery && postcode === null) {
    warnings.push(t("This job has no delivery postcode, so no cartage zone could be chosen."));
  } else if (wantsDelivery && !zone) {
    warnings.push(t("No cartage zone in \"{name}\" covers postcode {postcode}. Add the cartage yourself.", { name: card.name, postcode: job.delivery_postcode ?? "" }));
  }

  for (const row of rows) {
    if (!job.services.includes(CATEGORY_SERVICE[row.category])) continue;
    if (row.kind === "zone" && row !== zone) continue;
    if (row.unload_type && row.unload_type !== job.unload_type) continue;
    const q = quantity(row, job);
    if (!q) continue;
    const unit = Number(row.amount_minor);
    const minor = Math.round(unit * q.qty);
    const unitText = formatMoney(unit, card.currency);
    const place = job.delivery_suburb ?? job.delivery_postcode ?? "";
    const base = row.kind === "zone" && place ? `Cartage to ${place}` : row.name;
    lines.push({
      chargeName: `${base}${q.label(unitText)}`.slice(0, 120),
      amount: (minor / 100).toFixed(2),
      currency: card.currency,
      gstIncluded: row.gst_included,
      category: row.category,
      source: row.kind === "zone" ? `${row.name} · postcode ${job.delivery_postcode}` : row.unload_type ? `Job says ${UNLOAD_LABELS[row.unload_type as keyof typeof UNLOAD_LABELS] ?? row.unload_type}` : "Rate card",
      minor,
    });
  }

  if (lines.length > 20) {
    warnings.push(t("The rate card gave more than 20 lines, so the extra lines were left out."));
    lines.length = 20;
  }
  return { lines, warnings, totalMinor: lines.reduce((n, l) => n + l.minor, 0) };
}
