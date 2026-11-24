import { formatTotals } from "@/lib/domain";
import { msg } from "@/lib/i18n";

export type QuoteLineRow = {
  id: string;
  charge_name: string;
  amount_minor: number | string;
  currency: string;
  gst_included: boolean;
  category: string;
};

export type QuoteRow = {
  id: string;
  job_id: string;
  company_id: string;
  created_by: string;
  valid_until: string;
  notes: string | null;
  status: "sent" | "withdrawn" | "won" | "lost";
  created_at: string;
  updated_at: string;
  lines: QuoteLineRow[];
  company?: { id: string; name: string; country: string; trust_level: "basic" | "verified" } | null;
};

export const QUOTE_SELECT = `
  id, job_id, company_id, created_by, valid_until, notes, status, created_at, updated_at,
  lines:quote_lines(id, charge_name, amount_minor, currency, gst_included, category),
  company:companies(id, name, country, trust_level)
`;

export function normaliseQuote(row: unknown): QuoteRow {
  const r = row as Record<string, unknown>;
  const company = Array.isArray(r.company) ? r.company[0] : r.company;
  return { ...(r as unknown as QuoteRow), lines: (r.lines as QuoteLineRow[]) ?? [], company: company ?? null };
}

export function quoteTotal(q: Pick<QuoteRow, "lines">): string {
  return formatTotals(q.lines);
}

export const QUOTE_STATUS_LABEL: Record<QuoteRow["status"], string> = {
  sent: msg("Sent"),
  withdrawn: msg("Withdrawn"),
  won: msg("Won"),
  lost: msg("Lost"),
};
