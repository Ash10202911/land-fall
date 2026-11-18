import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { Me, Company } from "@/lib/auth";
import { isJobClosed } from "@/lib/domain";
import type { JobRow } from "@/lib/jobs";
import { QUOTE_SELECT, normaliseQuote } from "@/lib/quotes";
import { MyQuote } from "./my-quote";
import { QuoteForm, type LineDraft } from "./quote-form";

function addDays(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** What a non-poster company sees on a job: send, edit or withdraw their own sealed quote. */
export async function QuoterSection({
  job,
  me,
  edit,
}: {
  job: JobRow;
  me: Me & { company: Company };
  edit: boolean;
}) {
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
          Your company is suspended and cannot send quotes.
        </p>
      </Card>
    );
  }

  const initialLines: LineDraft[] | undefined = mine?.lines.map((l) => ({
    chargeName: l.charge_name,
    amount: (Number(l.amount_minor) / 100).toFixed(2),
    currency: l.currency,
    gstIncluded: l.gst_included,
  }));

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">{mine ? "Edit your quote" : "Send a sealed quote"}</h2>
      {!mine ? (
        <>
          <p className="text-sm text-muted-foreground">
            Only {job.company?.name ?? "the poster"} can see your quote. You can edit or withdraw it until the
            deadline.
          </p>
          {me.company.trust_level !== "verified" ? (
            <p className="text-xs text-muted-foreground">
              Your company is unverified, so your quote will carry an “Unverified” label.
            </p>
          ) : null}
        </>
      ) : null}
      <QuoteForm
        jobId={job.id}
        quoteId={mine?.id}
        initialLines={initialLines}
        initialValidUntil={mine?.valid_until ?? addDays(14)}
        initialNotes={mine?.notes ?? ""}
        minDate={addDays(0)}
      />
    </Card>
  );
}
