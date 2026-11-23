import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { loadRateCards } from "@/lib/rate-card-data";
import { buildQuoteFromRateCard, pickRateCard } from "@/lib/rate-cards";
import type { Me, Company } from "@/lib/auth";
import { formatMoney, isJobClosed } from "@/lib/domain";
import type { JobRow } from "@/lib/jobs";
import { QUOTE_SELECT, normaliseQuote } from "@/lib/quotes";
import { MyQuote } from "./my-quote";
import { QuoteForm, type LineDraft } from "./quote-form";
import { getT } from "@/lib/i18n/server";

function addDays(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** What a quoting company sees on a job: send, edit or withdraw their own sealed quote. */
export async function QuoterSection({
  job,
  me,
  edit,
}: {
  job: JobRow;
  me: Me & { company: Company };
  edit: boolean;
}) {
  const t = await getT();
  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select(QUOTE_SELECT)
    .eq("job_id", job.id)
    .eq("company_id", me.company.id)
    .neq("status", "withdrawn")
    .maybeSingle();
  const mine = data ? normaliseQuote(data) : null;
  const closed = isJobClosed(job);
  const suspended = me.company.status !== "active";

  if (mine && !(edit && !closed && !suspended && mine.status === "sent")) {
    return <MyQuote quote={mine} jobId={job.id} canChange={!closed && !suspended} />;
  }

  if (closed && !mine) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">
          {job.status === "awarded"
            ? "This job has been awarded."
            : "Quotes are closed for this job."}
        </p>
      </Card>
    );
  }
  if (suspended) {
    return (
      <Card>
        <p role="alert" className="text-sm text-destructive">
          {t("Your company is suspended and cannot send quotes.")}
        </p>
      </Card>
    );
  }

  let initialLines: LineDraft[] | undefined = mine?.lines.map((l) => ({
    chargeName: l.charge_name,
    amount: (Number(l.amount_minor) / 100).toFixed(2),
    currency: l.currency,
    gstIncluded: l.gst_included,
  }));

  // A new quote opens pre-filled from the company's rate card for this port, when it has one.
  // Nothing is sent: the forwarder checks and edits the lines first.
  let validUntil = mine?.valid_until ?? addDays(14);
  let prefill: { cardName: string; total: string; warnings: string[] } | null = null;
  let cardMissedJob: { cardName: string; warnings: string[] } | null = null;
  if (!mine) {
    const cards = await loadRateCards(supabase, me.company.id, job.destination.code);
    const card = pickRateCard(cards, job.destination.code, addDays(0));
    if (card) {
      const built = buildQuoteFromRateCard(card, { ...job, destination_code: job.destination.code });
      if (built.lines.length > 0) {
        initialLines = built.lines.map(({ chargeName, amount, currency, gstIncluded, source }) => ({ chargeName, amount, currency, gstIncluded, source }));
        if (card.valid_to < validUntil) validUntil = card.valid_to;
        prefill = { cardName: card.name, total: formatMoney(built.totalMinor, card.currency), warnings: built.warnings };
      } else {
        cardMissedJob = { cardName: card.name, warnings: built.warnings };
      }
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">{mine ? "Edit your quote" : "Send a sealed quote"}</h2>
      {prefill ? (
        <div role="status" className="space-y-1.5 rounded-xl bg-sea-soft p-3 text-sm text-sea-ink">
          <p className="flex items-start gap-2 font-semibold">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Filled in from your rate card &ldquo;{prefill.cardName}&rdquo;: {prefill.total}. Check every line, then send.
            </span>
          </p>
          {prefill.warnings.map((w) => (
            <p key={w} className="pl-6 text-amber-900">
              {w}
            </p>
          ))}
        </div>
      ) : null}
      {cardMissedJob ? (
        <div role="status" className="space-y-1 rounded-xl bg-muted p-3 text-sm">
          <p className="font-semibold">Your rate card &ldquo;{cardMissedJob.cardName}&rdquo; has nothing that fits this job, so nothing was filled in.</p>
          {cardMissedJob.warnings.map((w) => (
            <p key={w} className="text-muted-foreground">
              {w}
            </p>
          ))}
        </div>
      ) : null}
      {!mine ? (
        <>
          <p className="text-sm text-muted-foreground">
            Only {job.company?.name ?? "the requester"} can see your quote. You can edit or withdraw it until the
            deadline.
          </p>
          {me.company.trust_level !== "verified" ? (
            <p className="text-xs text-muted-foreground">
              {t("Your company is unverified, so your quote will carry an “Unverified” label.")}
            </p>
          ) : null}
        </>
      ) : null}
      <QuoteForm
        jobId={job.id}
        quoteId={mine?.id}
        initialLines={initialLines}
        initialValidUntil={validUntil}
        initialNotes={mine?.notes ?? ""}
        minDate={addDays(0)}
      />
    </Card>
  );
}
