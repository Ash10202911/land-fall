import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge, Card } from "@/components/ui/card";
import { JobFlags } from "@/components/job-card";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { JOB_SELECT, cargoSummary, normaliseJob, portLabel } from "@/lib/jobs";
import { QuoterSection } from "./quoter-section";
import { RequesterSection } from "./requester-section";
import { ScopeStrip } from "@/components/scope-strip";
import { REPEAT_LABELS, UNLOAD_LABELS, scopeFor } from "@/lib/scope";
import { AwardContacts } from "./contacts";
import { QuestionsSection } from "./questions-section";
import { CONTAINER_LABELS, SERVICE_LABELS, formatDate, formatDateTime, isJobClosed } from "@/lib/domain";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Job" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string; award_error?: string; job_error?: string; extended?: string; complete?: string }>;
}) {
  const t = await getT();
  const { id } = await params;
  const { edit, award_error: awardError, job_error: jobError, extended, complete } = await searchParams;
  if (!UUID.test(id)) notFound();

  const me = await requireMember();
  const supabase = await createClient();
  const { data } = await supabase.from("jobs").select(JOB_SELECT).eq("id", id).maybeSingle();
  if (!data) notFound();

  const job = normaliseJob(data);
  // Which side a company sees always follows ownership, never the Requester / Quoter switch.
  const isRequester = job.company_id === me.company.id;
  const scope = scopeFor(job.incoterm, job.services);
  const closed = isJobClosed(job);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Link href="/jobs" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("Jobs")}
      </Link>

      <div className="space-y-2">
        <h1 className="text-xl font-semibold">
          {t("{origin} to {destination}", { origin: job.origin.name, destination: job.destination.name })}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {job.status === "awarded" ? (
            <Badge tone="success">{t("Awarded")}</Badge>
          ) : job.status === "cancelled" ? (
            <Badge tone="danger">{t("Cancelled")}</Badge>
          ) : closed ? (
            <Badge tone="neutral">{t("Closed")}</Badge>
          ) : (
            <Badge tone="success">{t("Open for quotes")}</Badge>
          )}
          {isRequester ? <Badge tone="verified">{t("Your job")}</Badge> : null}
          <span className="text-sm text-muted-foreground">
            {t("Posted by {name}", { name: job.company?.name ?? t("Unknown") })}
            {job.company?.trust_level === "verified" ? ` ${t("(Verified)")}` : ""}
          </span>
        </div>
        <JobFlags job={job} />
      </div>

      {job.status === "cancelled" ? (
        <p role="status" className="rounded-md bg-muted p-3 text-sm">
          {t("The requester cancelled this job. It can no longer be quoted.")}
        </p>
      ) : null}

      {jobError ? (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {jobError === "extend"
            ? t("We could not extend this job. It may have received a quote, already been extended twice, or closed.")
            : t("We could not cancel this job. It may already be awarded or closed.")}
        </p>
      ) : null}

      {extended === "24" || extended === "48" ? (
        <p role="status" className="rounded-xl bg-sea-soft p-3 text-sm text-sea-ink">
          {t("Deadline extended by {hours} hours. Forwarders watching this lane have been told.", { hours: extended })}
        </p>
      ) : null}

      {closed && job.status === "open" ? (
        <p role="status" className="rounded-xl bg-muted p-3 text-sm">
          {t("The quote deadline has passed. This job is closed and can no longer be quoted.")}
        </p>
      ) : null}

      <Card className="space-y-3">
        <p className="font-bold">
          {t("Forwarders price:")} <span className="text-sea-ink">{t(scope.summary)}</span>
        </p>
        <ScopeStrip legs={scope.legs} air={job.mode === "Air"} />
      </Card>

      <Card>
        <dl className="divide-y divide-border">
          <Row label={t("Direction")}>{job.direction === "import" ? t("Import") : t("Export")}</Row>
          <Row label={t("Mode")}>{job.mode}</Row>
          <Row label={t("Origin")}>{portLabel(job.origin)}, {job.origin.country}</Row>
          <Row label={t("Destination")}>{portLabel(job.destination)}, {job.destination.country}</Row>
          <Row label={t("Incoterm")}>{job.incoterm}</Row>
          <Row label={t("Cargo")}>
            {cargoSummary(job)}
            {job.mode === "FCL" && job.container_type ? ` (${t(CONTAINER_LABELS[job.container_type])})` : ""}
          </Row>
          <Row label={t("Cargo ready")}>{formatDate(job.ready_date)}</Row>
          <Row label={t("Needed by")}>{job.required_by ? formatDate(job.required_by) : t("Flexible")}</Row>
          <Row label={t("Quotes due")}>{formatDateTime(job.deadline_at)}</Row>
          {job.delivery_suburb ? (
            <Row label={t("Deliver to")}>
              {job.delivery_suburb} {job.delivery_postcode}
              {job.unload_type ? ` · ${t(UNLOAD_LABELS[job.unload_type])}` : ""}
            </Row>
          ) : null}
          <Row label={t("Regular work")}>
            {job.repeat_frequency === "one_off"
              ? t("One-off")
              : `${t(REPEAT_LABELS[job.repeat_frequency])}${job.repeat_volume ? ` · ${job.repeat_volume}` : ""}`}
          </Row>
          <Row label={t("Services")}>
            {job.services.length > 0 ? job.services.map((s) => t(SERVICE_LABELS[s])).join(", ") : t("None specified")}
          </Row>
        </dl>
      </Card>

      <Card className="space-y-1">
        <h2 className="text-sm font-semibold">{t("Cargo description")}</h2>
        <p className="whitespace-pre-wrap text-sm">{job.cargo_description}</p>
        {job.notes ? (
          <>
            <h2 className="pt-2 text-sm font-semibold">{t("Notes")}</h2>
            <p className="whitespace-pre-wrap text-sm">{job.notes}</p>
          </>
        ) : null}
      </Card>

      {job.status === "awarded" ? <AwardContacts jobId={job.id} suburb={job.delivery_suburb ? `${job.delivery_suburb} ${job.delivery_postcode ?? ""}`.trim() : null} /> : null}

      {isRequester ? (
        <RequesterSection job={job} company={me.company} awardError={awardError} onlyComplete={complete === "1"} />
      ) : (
        <QuoterSection job={job} me={me} edit={edit === "1"} />
      )}

      <QuestionsSection
        jobId={job.id}
        isRequester={isRequester}
        canAsk={!isRequester && job.status === "open" && !closed && me.company.status === "active"}
        canAnswer={isRequester && job.status === "open" && !closed && me.company.status === "active"}
      />
    </div>
  );
}
