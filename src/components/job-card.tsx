import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { Badge, Card } from "@/components/ui/card";
import { formatDateTime, isJobClosed } from "@/lib/domain";
import { cargoSummary, portLabel, type JobRow } from "@/lib/jobs";

export function JobFlags({ job }: { job: Pick<JobRow, "flag_dg" | "flag_reefer" | "flag_bmsb"> }) {
  if (!job.flag_dg && !job.flag_reefer && !job.flag_bmsb) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {job.flag_dg ? <Badge tone="danger">Dangerous goods</Badge> : null}
      {job.flag_reefer ? <Badge tone="warning">Reefer</Badge> : null}
      {job.flag_bmsb ? <Badge tone="warning">BMSB risk</Badge> : null}
    </div>
  );
}

export function JobCard({ job, quoteCount }: { job: JobRow; quoteCount?: number }) {
  const closed = isJobClosed(job);
  const awarded = job.status === "awarded";
  return (
    <Link href={`/jobs/${job.id}`} className="block">
      <Card className="space-y-2 transition-colors hover:bg-muted/40">
        <div className="flex items-start justify-between gap-2">
          <p className="flex flex-wrap items-center gap-x-2 font-semibold">
            <span>{job.origin.name}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" aria-label="to" />
            <span>{job.destination.name}</span>
          </p>
          <Badge tone={awarded ? "verified" : job.status === "cancelled" ? "danger" : closed ? "neutral" : "success"}>
            {awarded ? "Awarded" : job.status === "cancelled" ? "Cancelled" : closed ? "Closed" : "Open"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {job.mode} · {cargoSummary(job)} · {job.incoterm} · {job.direction === "import" ? "Import" : "Export"}
        </p>
        <p className="line-clamp-2 text-sm">{job.cargo_description}</p>
        <JobFlags job={job} />
        <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            {quoteCount === undefined
              ? (job.company?.name ?? "Unknown company")
              : `${quoteCount} ${quoteCount === 1 ? "quote" : "quotes"} received`}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden />
            Quotes by {formatDateTime(job.deadline_at)}
          </span>
        </div>
      </Card>
    </Link>
  );
}

export { portLabel };
