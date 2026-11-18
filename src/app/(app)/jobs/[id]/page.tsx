import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge, Card } from "@/components/ui/card";
import { JobFlags } from "@/components/job-card";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { JOB_SELECT, cargoSummary, normaliseJob, portLabel } from "@/lib/jobs";
import { QuoterSection } from "./quoter-section";
import { PosterSection } from "./poster-section";
import { AwardContacts } from "./contacts";
import { CONTAINER_LABELS, SERVICE_LABELS, formatDate, formatDateTime, isJobClosed } from "@/lib/domain";

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
  searchParams: Promise<{ edit?: string; award_error?: string }>;
}) {
  const { id } = await params;
  const { edit, award_error: awardError } = await searchParams;
  if (!UUID.test(id)) notFound();

  const me = await requireMember();
  const supabase = await createClient();
  const { data } = await supabase.from("jobs").select(JOB_SELECT).eq("id", id).maybeSingle();
  if (!data) notFound();

  const job = normaliseJob(data);
  const isPoster = job.company_id === me.company.id;
  const closed = isJobClosed(job);

  return (
    <div className="space-y-4">
      <Link href="/jobs" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Jobs
      </Link>

      <div className="space-y-2">
        <h1 className="text-xl font-semibold">
          {job.origin.name} to {job.destination.name}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {job.status === "awarded" ? (
            <Badge tone="success">Awarded</Badge>
          ) : closed ? (
            <Badge tone="neutral">Closed</Badge>
          ) : (
            <Badge tone="success">Open for quotes</Badge>
          )}
          {isPoster ? <Badge tone="verified">Your job</Badge> : null}
          <span className="text-sm text-muted-foreground">
            Posted by {job.company?.name ?? "Unknown"}
            {job.company?.trust_level === "verified" ? " (Verified)" : ""}
          </span>
        </div>
        <JobFlags job={job} />
      </div>

      {closed && job.status === "open" ? (
        <p role="status" className="rounded-md bg-muted p-3 text-sm">
          The quote deadline has passed. This job is closed and can no longer be quoted.
        </p>
      ) : null}

      <Card>
        <dl className="divide-y divide-border">
          <Row label="Direction">{job.direction === "import" ? "Import" : "Export"}</Row>
          <Row label="Mode">{job.mode}</Row>
          <Row label="Origin">{portLabel(job.origin)}, {job.origin.country}</Row>
          <Row label="Destination">{portLabel(job.destination)}, {job.destination.country}</Row>
          <Row label="Incoterm">{job.incoterm}</Row>
          <Row label="Cargo">
            {cargoSummary(job)}
            {job.mode === "FCL" && job.container_type ? ` (${CONTAINER_LABELS[job.container_type]})` : ""}
          </Row>
          <Row label="Cargo ready">{formatDate(job.ready_date)}</Row>
          <Row label="Quotes due">{formatDateTime(job.deadline_at)}</Row>
          <Row label="Services">
            {job.services.length > 0 ? job.services.map((s) => SERVICE_LABELS[s]).join(", ") : "None specified"}
          </Row>
        </dl>
      </Card>

      <Card className="space-y-1">
        <h2 className="text-sm font-semibold">Cargo description</h2>
        <p className="whitespace-pre-wrap text-sm">{job.cargo_description}</p>
        {job.notes ? (
          <>
            <h2 className="pt-2 text-sm font-semibold">Notes</h2>
            <p className="whitespace-pre-wrap text-sm">{job.notes}</p>
          </>
        ) : null}
      </Card>

      {job.status === "awarded" ? <AwardContacts jobId={job.id} /> : null}

      {isPoster ? (
        <PosterSection job={job} company={me.company} awardError={awardError} />
      ) : (
        <QuoterSection job={job} me={me} edit={edit === "1"} />
      )}
    </div>
  );
}
