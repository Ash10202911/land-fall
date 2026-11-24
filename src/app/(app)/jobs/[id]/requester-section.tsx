import Link from "next/link";
import { AlertTriangle, Check, ChevronDown, Clock, Pencil, X } from "lucide-react";
import { CancelJobButton } from "./cancel-button";
import { cancelJob, extendJob } from "./job-actions";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/auth";
import { formatDate, formatTotals, isJobClosed } from "@/lib/domain";
import type { JobRow } from "@/lib/jobs";
import { QUOTE_SELECT, normaliseQuote, type QuoteRow } from "@/lib/quotes";
import { QuoteLines } from "./my-quote";
import { AwardButton } from "./award-button";
import { awardQuote } from "./award-actions";
import { getT } from "@/lib/i18n/server";
import { msg, type Translator } from "@/lib/i18n";
import {
  QUOTE_CATEGORY_LABELS,
  analyseQuote,
  lowestCompleteIds,
  mixedCurrencies,
  requiredCategories,
  type QuoteAnalysis,
  type QuoteCategory,
} from "@/lib/compare";

const ERRORS: Record<string, string> = {
  unverified: msg("Your company needs to be verified before it can award jobs."),
  suspended: msg("Your company is suspended and cannot award jobs."),
  failed: msg("We could not award that quote. It may have been changed. Refresh and try again."),
  address: msg("Enter the delivery street address (3 to 200 characters) to award this job."),
};

/** A quiet job can be extended in its last 12 hours, up to twice. Mirrors the database rule. */
const EXTEND_WINDOW_MS = 12 * 60 * 60 * 1000;
const MAX_EXTENSIONS = 2;

const legList = (t: Translator, legs: QuoteCategory[]) => legs.map((c) => t(QUOTE_CATEGORY_LABELS[c])).join(", ");

function CoverageChips({ analysis, required, t }: { analysis: QuoteAnalysis; required: QuoteCategory[]; t: Translator }) {
  if (required.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t("What this quote covers")} data-testid="coverage">
      {required.map((c) => {
        const has = analysis.covered.includes(c);
        const known = analysis.tagged;
        return (
          <li
            key={c}
            data-covered={known ? String(has) : "unknown"}
            className={
              !known
                ? "inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                : has
                  ? "inline-flex items-center gap-1 rounded-full bg-sea-soft px-2.5 py-1 text-xs font-semibold text-sea-ink"
                  : "inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive"
            }
          >
            {known ? has ? <Check className="h-3 w-3" aria-hidden /> : <X className="h-3 w-3" aria-hidden /> : null}
            {t(QUOTE_CATEGORY_LABELS[c])}
            {known ? <span className="sr-only">{has ? t("included") : t("not included")}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

async function QuoteCard({
  quote,
  job,
  canAward,
  analysis,
  required,
  lowest,
}: {
  quote: QuoteRow;
  job: JobRow;
  canAward: boolean;
  analysis: QuoteAnalysis;
  required: QuoteCategory[];
  lowest: boolean;
}) {
  const t = await getT();
  const verified = quote.company?.trust_level === "verified";
  const award = awardQuote.bind(null, job.id, quote.id);
  const won = quote.status === "won";
  const warnings: string[] = [];
  if (analysis.missing.length > 0) warnings.push(t("Does not include: {legs}", { legs: legList(t, analysis.missing) }));
  if (required.length > 0 && !analysis.tagged) warnings.push(t("Coverage was not tagged on this quote. Check the line items to see what is included."));
  if (analysis.expiresBeforeReady) {
    warnings.push(t("Valid until {valid}, before your cargo is ready on {ready}.", { valid: formatDate(quote.valid_until), ready: formatDate(job.ready_date) }));
  }
  if (analysis.currencies.length > 1) warnings.push(t("Priced in more than one currency: {list}.", { list: analysis.currencies.join(", ") }));

  return (
    <Card className="space-y-3" data-testid="quote-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{quote.company?.name ?? t("Unknown company")}</p>
          <p className="text-xs text-muted-foreground">{quote.company?.country}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {verified ? <Badge tone="verified">{t("Verified")}</Badge> : <Badge tone="warning">{t("Unverified")}</Badge>}
          {lowest ? <Badge tone="success">{t("Lowest complete quote")}</Badge> : null}
          {won ? <Badge tone="success">{t("Won")}</Badge> : null}
          {quote.status === "lost" ? <Badge tone="danger">{t("Lost")}</Badge> : null}
        </div>
      </div>
      <div>
        <p className="text-lg font-semibold">{formatTotals(quote.lines)}</p>
        <p className="text-sm text-muted-foreground">{t("Valid until {date}", { date: formatDate(quote.valid_until) })}</p>
      </div>
      <CoverageChips analysis={analysis} required={required} t={t} />
      {warnings.length > 0 ? (
        <ul className="space-y-1" data-testid="quote-warnings">
          {warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {w}
            </li>
          ))}
        </ul>
      ) : null}
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-medium text-accent">
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
          {t("Show line items")}
        </summary>
        <div className="pt-2">
          <QuoteLines quote={quote} />
          {quote.notes ? <p className="mt-2 whitespace-pre-wrap text-sm">{quote.notes}</p> : null}
        </div>
      </details>
      {canAward && quote.status === "sent" ? (
        <AwardButton
          action={award}
          companyName={quote.company?.name ?? t("this company")}
          needsAddress={job.services.includes("delivery")}
          suburb={job.delivery_suburb ? `${job.delivery_suburb} ${job.delivery_postcode ?? ""}`.trim() : undefined}
        />
      ) : null}
    </Card>
  );
}

/** Offers 24 or 48 more hours when a job is about to close with no live quotes. */
async function ExtendPanel({ job }: { job: JobRow }) {
  const t = await getT();
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card" data-testid="extend-panel">
      <p className="flex items-start gap-2 text-sm font-semibold">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
        {t("No quotes yet and this job closes soon. Give forwarders more time?")}
      </p>
      <div className="flex flex-wrap gap-2">
        {[24, 48].map((hours) => (
          <form key={hours} action={extendJob.bind(null, job.id, hours)}>
            <Button type="submit" variant="outline">
              {t("Extend by {hours} hours", { hours })}
            </Button>
          </form>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("Forwarders watching this lane are told again. You can extend a job up to twice.")}
      </p>
    </div>
  );
}

/** The requester's view of a job: every quote as a stacked card, with award when allowed. */
export async function RequesterSection({
  job,
  company,
  awardError,
  onlyComplete = false,
}: {
  job: JobRow;
  company: Company;
  awardError?: string;
  onlyComplete?: boolean;
}) {
  const t = await getT();
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

  const required = requiredCategories(job.services);
  const analyses = new Map(quotes.map((q) => [q.id, analyseQuote(q, required, job.ready_date)]));
  const sentAnalyses = quotes.filter((q) => q.status === "sent").map((q) => analyses.get(q.id)!);
  const lowest = open ? lowestCompleteIds(sentAnalyses) : new Set<string>();
  const mixed = mixedCurrencies(sentAnalyses);
  const anyTagged = sentAnalyses.some((a) => a.tagged);
  const shown = onlyComplete ? quotes.filter((q) => analyses.get(q.id)!.complete) : quotes;

  const liveQuotes = quotes.filter((q) => q.status === "sent").length;
  const canExtend =
    open &&
    !closedForQuotes &&
    company.status === "active" &&
    liveQuotes === 0 &&
    job.extensions < MAX_EXTENSIONS &&
    new Date(job.deadline_at).getTime() - new Date().getTime() <= EXTEND_WINDOW_MS;

  return (
    <section aria-labelledby="quotes-heading" className="space-y-3">
      <h2 id="quotes-heading" className="font-semibold">
        {t("Quotes ({n})", { n: quotes.length })}
      </h2>

      {open && !closedForQuotes ? (
        <div className="flex flex-wrap items-start gap-2">
          <Link
            href={`/jobs/${job.id}/edit`}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium"
          >
            <Pencil className="h-4 w-4" aria-hidden />
            {t("Edit job")}
          </Link>
          <CancelJobButton action={cancelJob.bind(null, job.id)} />
        </div>
      ) : null}

      {canExtend ? <ExtendPanel job={job} /> : null}
      {open && job.extensions > 0 ? (
        <p className="text-xs text-muted-foreground">{t("Extended {n} of {max} times.", { n: job.extensions, max: MAX_EXTENSIONS })}</p>
      ) : null}

      {awardError && ERRORS[awardError] ? (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {t(ERRORS[awardError])}
        </p>
      ) : null}

      {open && !verifiedActive ? (
        <div className="rounded-xl bg-muted p-3 text-sm">
          <p className="font-medium">{t("Get verified to award")}</p>
          <p className="text-muted-foreground">
            {company.status === "suspended"
              ? t("Your company is suspended.")
              : t("You can compare quotes now. An admin must verify your company before you can award.")}{" "}
            <Link href="/profile" className="text-accent underline">
              {t("View your profile")}
            </Link>
          </p>
        </div>
      ) : null}

      {mixed ? (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-muted p-3 text-sm" data-testid="mixed-currency">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          {t("These quotes are in different currencies, so the totals cannot be compared directly. No exchange rate is assumed.")}
        </p>
      ) : null}

      {required.length > 0 && anyTagged && quotes.length > 1 ? (
        <Link
          href={onlyComplete ? `/jobs/${job.id}` : `/jobs/${job.id}?complete=1`}
          className="inline-flex min-h-11 items-center rounded-xl border border-input bg-card px-4 text-sm font-medium hover:bg-muted"
        >
          {onlyComplete ? t("Show all quotes") : t("Show only quotes that cover everything")}
        </Link>
      ) : null}

      {quotes.length === 0 ? (
        <EmptyState
          title={t("No quotes yet")}
          body={closedForQuotes ? t("The deadline has passed with no quotes.") : t("Forwarders have until the deadline to send sealed quotes.")}
        />
      ) : shown.length === 0 ? (
        <EmptyState title={t("No quote covers everything")} body={t("Show all quotes to compare what each one includes.")} />
      ) : (
        <ul className="space-y-3">
          {shown.map((q) => (
            <li key={q.id}>
              <QuoteCard
                quote={q}
                job={job}
                canAward={canAward}
                analysis={analyses.get(q.id)!}
                required={required}
                lowest={lowest.has(q.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
