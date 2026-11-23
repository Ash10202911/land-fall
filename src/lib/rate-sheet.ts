import { MAX_RATE_ROWS, rateRowSchema, type RateRowInput } from "@/lib/validation/rate-card";

/**
 * Reads a rate card from a spreadsheet saved as CSV (Excel: File, Save As, CSV). One row per charge or
 * cartage zone. The card's name, port, currency and valid-to date are entered on the upload form.
 */

export const SHEET_COLUMNS = [
  "type",
  "name",
  "category",
  "basis",
  "amount",
  "gst_included",
  "from_postcode",
  "to_postcode",
  "unload_type",
] as const;

const REQUIRED = ["type", "name", "category", "basis", "amount"] as const;
export const MAX_SHEET_BYTES = 100_000;

export const SHEET_TEMPLATE = [
  SHEET_COLUMNS.join(","),
  "charge,Port service charge (THC),destination,per_40ft,165.00,yes,,,",
  "charge,Delivery order fee,destination,per_job,95.00,yes,,,",
  "charge,Customs entry,customs,per_job,120.00,yes,,,",
  "zone,Zone 1 inner metro,delivery,per_container,420.00,yes,2000,2050,",
  "zone,Zone 2 western Sydney,delivery,per_container,560.00,yes,2140,2170,",
  "charge,Side-loader,delivery,per_container,80.00,yes,,,side_loader",
  "charge,Tailgate truck,delivery,per_container,45.00,yes,,,tailgate",
  "",
].join("\r\n");

/** Splits CSV text into rows of cells. Handles quoted cells, doubled quotes and CRLF. */
export function parseCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, "_");

/**
 * In a semicolon-separated file (Excel with a European regional setting) amounts use a decimal comma:
 * 1,50 or 1.250,50. Convert those to 1.50 and 1250.50. Other files are left as they are, and anything
 * ambiguous is rejected later by the amount check rather than guessed.
 */
function localiseAmount(value: string, delimiter: string): string {
  if (delimiter !== ";") return value;
  if (/^\d+,\d{1,2}$/.test(value)) return value.replace(",", ".");
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(value)) return value.replace(/\./g, "").replace(",", ".");
  return value;
}

function yesNo(v: string | undefined): boolean | null {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "") return true;
  if (["yes", "y", "true", "1", "included"].includes(s)) return true;
  if (["no", "n", "false", "0", "excluded"].includes(s)) return false;
  return null;
}

export type SheetResult = { rows: RateRowInput[]; errors: string[] };

/** Parses and validates a rate sheet. Any error rejects the whole file, with row numbers. */
export function parseRateSheet(text: string): SheetResult {
  if (text.length > MAX_SHEET_BYTES) return { rows: [], errors: ["The file is too large. Keep it under 100 KB."] };
  const firstLine = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  const table = parseCsv(text, delimiter).filter((r) => r.some((c) => c.trim() !== ""));
  if (table.length === 0) return { rows: [], errors: ["The file is empty."] };

  const header = table[0].map(norm);
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return { rows: [], errors: [`The first row must list the columns. Missing: ${missing.join(", ")}. Download the template to start.`] };
  }
  const col = (name: string) => header.indexOf(name);
  const body = table.slice(1);
  if (body.length === 0) return { rows: [], errors: ["The file has a header row but no charges."] };
  if (body.length > MAX_RATE_ROWS) return { rows: [], errors: [`A rate card can have at most ${MAX_RATE_ROWS} lines. This file has ${body.length}.`] };

  const rows: RateRowInput[] = [];
  const errors: string[] = [];
  body.forEach((cells, i) => {
    const rowNo = i + 2; // spreadsheet row number: the header is row 1
    const get = (name: string) => (col(name) >= 0 ? (cells[col(name)] ?? "").trim() : "");
    const gst = yesNo(get("gst_included"));
    if (gst === null) {
      errors.push(`Row ${rowNo}: gst_included must be yes or no.`);
      return;
    }
    const candidate: RateRowInput = {
      kind: norm(get("type")) as RateRowInput["kind"],
      name: get("name"),
      category: norm(get("category")) as RateRowInput["category"],
      basis: norm(get("basis")) as RateRowInput["basis"],
      amount: localiseAmount(get("amount").replace(/^[A-Za-z$]+\s*/, ""), delimiter),
      gstIncluded: gst,
      postcodeFrom: get("from_postcode"),
      postcodeTo: get("to_postcode"),
      unloadType: norm(get("unload_type")),
    };
    const parsed = rateRowSchema.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      errors.push(`Row ${rowNo}: ${issue.message}${issue.path[0] ? ` (${String(issue.path[0])})` : ""}.`);
      return;
    }
    rows.push(candidate);
  });

  if (errors.length > 0) {
    const shown = errors.slice(0, 10);
    if (errors.length > shown.length) shown.push(`And ${errors.length - shown.length} more.`);
    return { rows: [], errors: shown };
  }
  return { rows, errors: [] };
}
