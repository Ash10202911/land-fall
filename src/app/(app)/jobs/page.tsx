import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { JobCard } from "@/components/job-card";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { JOB_SELECT, normaliseJob } from "@/lib/jobs";
import { MODES } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const metadata = { title: "Jobs" };

function ViewTabs({ view }: { view: "open" | "mine" }) {
  const tab = (active: boolean) =>
    cn(
      "inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 text-sm font-medium",
      active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
    );
  return (
    <nav aria-label="Jobs view" className="flex gap-1 rounded-2xl sm:max-w-md border border-border bg-card p-1">
      <Link href="/jobs" aria-current={view === "open" ? "page" : undefined} className={tab(view === "open")}>
        Open jobs
      </Link>
      <Link href="/jobs?view=mine" aria-current={view === "mine" ? "page" : undefined} className={tab(view === "mine")}>
        My jobs
      </Link>
    </nav>
  );
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ dest?: string; mode?: string; view?: string }>;
}) {
  const me = await requireMember();
  const { dest, mode, view } = await searchParams;
  const supabase = await createClient();

  if (view === "mine") {
    // Jobs posted by my company, with the number of quotes received (withdrawn quotes are hidden by RLS).
    const { data } = await supabase
      .from("jobs")
      .select(`${JOB_SELECT}, quotes:quotes!job_id(count)`)
      .eq("company_id", me.company.id)
      .order("created_at", { ascending: false })
      .limit(100);
    const mine = (data ?? []).map((row) => {
      const counts = (row as unknown as { quotes?: { count: number }[] }).quotes;
      return { job: normaliseJob(row), quoteCount: counts?.[0]?.count ?? 0 };
    });
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Jobs</h1>
        <ViewTabs view="mine" />
        {mine.length === 0 ? (
          <EmptyState title="You have not posted a job yet" body="Use the Post tab to ask forwarders for sealed quotes." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {mine.map(({ job, quoteCount }) => (
              <li key={job.id}>
                <JobCard job={job} quoteCount={quoteCount} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const destId = Number.parseInt(dest ?? "", 10);
  const modeFilter = MODES.find((m) => m === mode);

  let query = supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("status", "open")
    .gt("deadline_at", new Date().toISOString())
    .neq("company_id", me.company.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (Number.isInteger(destId) && destId > 0) query = query.eq("destination_port_id", destId);
  if (modeFilter) query = query.eq("mode", modeFilter);

  const [{ data: rows }, { data: ports }] = await Promise.all([
    query,
    supabase.from("ports").select("id, code, name, country").order("country").order("name"),
  ]);
  const jobs = (rows ?? []).map(normaliseJob);
  const filtered = Boolean(modeFilter) || (Number.isInteger(destId) && destId > 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Jobs</h1>
      <ViewTabs view="open" />

      <form method="get" className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_9rem_auto]">
        <Select name="dest" defaultValue={Number.isInteger(destId) ? String(destId) : ""} aria-label="Destination port">
          <option value="">All destinations</option>
          {(ports ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code})
            </option>
          ))}
        </Select>
        <Select name="mode" defaultValue={modeFilter ?? ""} aria-label="Mode">
          <option value="">All modes</option>
          {MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Button type="submit" variant="default" className="flex-1">
            Filter
          </Button>
          {filtered ? (
            <Link
              href="/jobs"
              className="inline-flex min-h-11 items-center rounded-xl border border-input bg-card px-4 text-sm"
            >
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {jobs.length === 0 ? (
        <EmptyState
          title={filtered ? "No jobs match those filters" : "No open jobs right now"}
          body={
            filtered
              ? "Try a different destination or mode."
              : "New jobs from other companies appear here, newest first."
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <JobCard job={job} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
