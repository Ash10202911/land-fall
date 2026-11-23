import { msg } from "@/lib/i18n";
/** Shared constants and formatters. Money is integer minor units (cents) with a currency code. */

export const DIRECTIONS = ["import", "export"] as const;
export const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const;
export const MODES = ["FCL", "LCL", "Air"] as const;
export const CONTAINER_TYPES = ["20GP", "40GP", "40HC", "20RF", "40RF"] as const;
export const SERVICES = ["destination_charges", "customs_clearance", "delivery"] as const;
export const CURRENCIES = ["AUD", "NZD", "USD", "EUR", "GBP", "CNY", "SGD", "HKD", "JPY", "INR"] as const;

export const SERVICE_LABELS: Record<(typeof SERVICES)[number], string> = {
  destination_charges: msg("Destination charges"),
  customs_clearance: msg("Customs clearance"),
  delivery: msg("Delivery"),
};

export const CONTAINER_LABELS: Record<(typeof CONTAINER_TYPES)[number], string> = {
  "20GP": msg("20ft general purpose"),
  "40GP": msg("40ft general purpose"),
  "40HC": msg("40ft high cube"),
  "20RF": msg("20ft reefer"),
  "40RF": msg("40ft reefer"),
};

export const BANK_WARNING = msg(
  "Never change bank details based on a message. Always confirm by phone using a number you already trust.",
);

const pad = (n: number) => String(n).padStart(2, "0");

/** DD/MM/YYYY in UTC. Accepts a Date, ISO timestamp or YYYY-MM-DD date. */
export function formatDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00Z` : value) : value;
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** DD/MM/YYYY HH:mm UTC. */
export function formatDateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${formatDate(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** Formats minor units, for example (123456, "AUD") gives "A$1,234.56". */
export function formatMoney(minor: number | bigint, currency: string): string {
  const major = Number(minor) / 100;
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

/** Parses "1,234.56" into 123456 minor units, or null when invalid. */
export function parseMoneyToMinor(input: string): number | null {
  const cleaned = input.trim().replace(/,/g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(cleaned)) return null;
  const minor = Math.round(Number(cleaned) * 100);
  return minor > 0 ? minor : null;
}

/** Totals by currency without any conversion. */
export function totalsByCurrency(
  lines: { amount_minor: number | string | bigint; currency: string }[],
): { currency: string; minor: number }[] {
  const map = new Map<string, number>();
  for (const l of lines) {
    map.set(l.currency, (map.get(l.currency) ?? 0) + Number(l.amount_minor));
  }
  return [...map.entries()]
    .map(([currency, minor]) => ({ currency, minor }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function formatTotals(lines: { amount_minor: number | string | bigint; currency: string }[]): string {
  return totalsByCurrency(lines)
    .map((t) => formatMoney(t.minor, t.currency))
    .join(" + ");
}

/** A job is closed when it is no longer open or its deadline has passed. Checked on read. */
export function isJobClosed(job: { status: string; deadline_at: string }, now = new Date()): boolean {
  return job.status !== "open" || new Date(job.deadline_at).getTime() <= now.getTime();
}
