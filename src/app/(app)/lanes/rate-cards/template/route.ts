import { SHEET_TEMPLATE } from "@/lib/rate-sheet";

/** The rate card spreadsheet template. Signed-in users only (the proxy redirects everyone else). */
export function GET() {
  return new Response(SHEET_TEMPLATE, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="southbound-rate-card-template.csv"',
      "Cache-Control": "private, max-age=3600",
    },
  });
}
