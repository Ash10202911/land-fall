import Link from "next/link";
import { Clock, Container, Plane } from "lucide-react";
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

const shortName = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, "");

export function JobCard({ job, quoteCount }: { job: JobRow; quoteCount?: number }) {
  const closed = isJobClosed(job);
  const awarded = job.status === "awarded";
  const ModeIcon = job.mode === "Air" ? Plane : Container;
  return (
    <Link href={`/jobs/${job.id}`} className="group block">
      <Card className="space-y-3 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lift">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
            <ModeIcon className="h-3.5 w-3.5" aria-hidden />
            {job.mode}
          </span>
          <Badge tone={awarded ? "verified" : job.status === "cancelled" ? "danger" : closed ? "neutral" : "success"}>
            {awarded ? "Awarded" : job.status === "cancelled" ? "Cancelled" : closed ? "Closed" : "Open"}
          </Badge>
        </div>

        {/* Route: origin and destination joined by a dotted line */}
        <div className="flex items-center gap-3" aria-label={`${job.origin.name} to ${job.destination.name}`}>
          <p className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">{shortName(job.origin.name)}</p>
          <span className="flex min-w-8 flex-1 items-center" aria-hidden>
            <span className="h-2 w-2 rounded-full border-2 border-accent" />
            <span className="h-px flex-1 border-t-2 border-dotted border-input" />
            <span className="h-2 w-2 rounded-full bg-accent" />
          </span>
          <p className="min-w-0 flex-1 truncate text-right text-lg font-semibold tracking-tight">
            {shortName(job.destination.name)}
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          {cargoSummary(job)} · {job.incoterm} · {job.direction === "import" ? "Import" : "Export"}
        </p>
        <p className="line-clamp-2 text-sm">{job.cargo_description}</p>
        <JobFlags job={job} />

        <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
          <span className="min-w-0 truncate font-medium text-foreground/80">
            {quoteCount === undefined
              ? (job.company?.name ?? "Unknown company")
              : `${quoteCount} ${quoteCount === 1 ? "quote" : "quotes"} received`}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden />
            by {formatDateTime(job.deadline_at)}
          </span>
        </div>
      </Card>
    </Link>
  );
}

export { portLabel };
