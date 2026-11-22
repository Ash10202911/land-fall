import Link from "next/link";
import { Pencil, Undo2 } from "lucide-react";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney, formatTotals } from "@/lib/domain";
import { QUOTE_STATUS_LABEL, type QuoteRow } from "@/lib/quotes";
import { withdrawQuote } from "./quote-actions";

const tone = { sent: "neutral", withdrawn: "warning", won: "success", lost: "danger" } as const;

export function QuoteLines({ quote }: { quote: QuoteRow }) {
  return (
    <ul className="divide-y divide-border text-sm">
      {quote.lines.map((l) => (
        <li key={l.id} className="flex items-start justify-between gap-3 py-2">
          <span>
            {l.charge_name}
            <span className="block text-xs text-muted-foreground">
              {l.gst_included ? "GST included" : "GST not included"}
            </span>
          </span>
          <span className="font-medium">{formatMoney(Number(l.amount_minor), l.currency)}</span>
        </li>
      ))}
    </ul>
  );
}

/** The signed-in company's own quote on a job. */
export function MyQuote({ quote, jobId, canChange }: { quote: QuoteRow; jobId: string; canChange: boolean }) {
  const withdraw = withdrawQuote.bind(null, jobId, quote.id);
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Your quote</h2>
        <Badge tone={tone[quote.status]}>{QUOTE_STATUS_LABEL[quote.status]}</Badge>
      </div>
      <QuoteLines quote={quote} />
      <div className="text-sm">
        <p className="font-medium">Total {formatTotals(quote.lines)}</p>
        <p className="text-muted-foreground">Valid until {formatDate(quote.valid_until)}</p>
        {quote.notes ? <p className="mt-1 whitespace-pre-wrap">{quote.notes}</p> : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Sealed: only the requester can see this quote. Other forwarders cannot.
      </p>
      {canChange && quote.status === "sent" ? (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/jobs/${jobId}?edit=1`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-input bg-card px-4 text-sm font-medium hover:bg-muted"
          >
            <Pencil className="h-4 w-4" aria-hidden />
            Edit quote
          </Link>
          <form action={withdraw}>
            <Button type="submit" variant="outline">
              <Undo2 className="h-4 w-4" aria-hidden />
              Withdraw quote
            </Button>
          </form>
        </div>
      ) : null}
    </Card>
  );
}
