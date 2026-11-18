import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/auth";
import { formatDate, formatTotals, isJobClosed } from "@/lib/domain";
import type { JobRow } from "@/lib/jobs";
import { QUOTE_SELECT, normaliseQuote, type QuoteRow } from "@/lib/quotes";
import { QuoteLines } from "./my-quote";
import { AwardButton } from "./award-button";
import { awardQuote } from "./award-actions";

const ERRORS: Record<string, string> = {
  unverified: "Your company needs to be verified before it can award jobs.",
  suspended: "Your company is suspended and cannot award jobs.",
  failed: "We could not award that quote. It may have been changed. Refresh and try again.",
};

function QuoteCard({
  quote,
  job,
  canAward,
}: {
  quote: QuoteRow;
  job: JobRow;
  canAward: boolean;
}) {
  const verified = quote.company?.trust_level === "verified";
  const award = awardQuote.bind(null, job.id, quote.id);
  const won = quote.status === "won";
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{quote.company?.name ?? "Unknown company"}</p>
          <p className="text-xs text-muted-foreground">{quote.company?.country}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {verified ? <Badge tone="verified">Verified</Badge> : <Badge tone="warning">Unverified</Badge>}
          {won ? <Badge tone="success">Won</Badge> : null}
          {quote.status === "lost" ? <Badge tone="danger">Lost</Badge> : null}
        </div>
      </div>
      <div>
        <p className="text-lg font-semibold">{formatTotals(quote.lines)}</p>
        <p className="text-sm text-muted-foreground">Valid until {formatDate(quote.valid_until)}</p>
      </div>
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-medium text-accent">
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
          Show line items
        </summary>
        <div className="pt-2">
          <QuoteLines quote={quote} />
          {quote.notes ? <p className="mt-2 whitespace-pre-wrap text-sm">{quote.notes}</p> : null}
        </div>
      </details>
      {canAward && quote.status === "sent" ? (
        <AwardButton action={award} companyName={quote.company?.name ?? "this company"} />
      ) : null}
    </Card>
  );
}

/** The poster's view of a job: every quote as a stacked card, with award when allowed. */
export async function PosterSection({
  job,
  company,
  awardError,
}: {
  job: JobRow;
  company: Company;
  awardError?: string;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select(QUOTE_SELECT)
    .eq("job_id", job.id)
    .order("created_at", { ascending: true });
  const quotes = (data ?? []).map(normaliseQuote).filter((q) => q.status !== "withdrawn");

  const open = job.status === "open";
  const verifiedActive = company.trust_level === "verified" && company.status === "active";
  const canAward = open && verifiedActive;
  const closedForQuotes = isJobClosed(job);

  return (
    <section aria-labelledby="quotes-heading" className="space-y-3">
      <h2 id="quotes-heading" className="font-semibold">
        Quotes ({quotes.length})
      </h2>

      {awardError && ERRORS[awardError] ? (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {ERRORS[awardError]}
        </p>
      ) : null}

      {open && !verifiedActive ? (
        <div className="rounded-xl bg-muted p-3 text-sm">
          <p className="font-medium">Get verified to award</p>
          <p className="text-muted-foreground">
            {company.status === "suspended"
              ? "Your company is suspended."
              : "You can compare quotes now. An admin must verify your company before you can award."}{" "}
            <Link href="/profile" className="text-accent underline">
              View your profile
            </Link>
          </p>
        </div>
      ) : null}

      {quotes.length === 0 ? (
        <EmptyState
          title="No quotes yet"
          body={closedForQuotes ? "The deadline has passed with no quotes." : "Forwarders have until the deadline to send sealed quotes."}
        />
      ) : (
        <ul className="space-y-3">
          {quotes.map((q) => (
            <li key={q.id}>
              <QuoteCard quote={q} job={job} canAward={canAward} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
