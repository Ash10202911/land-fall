import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { JobCard } from "@/components/job-card";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { JOB_SELECT, normaliseJob } from "@/lib/jobs";
import { MODES } from "@/lib/domain";

export const metadata = { title: "Jobs" };

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ dest?: string; mode?: string }>;
}) {
  const me = await requireMember();
  const { dest, mode } = await searchParams;
  const supabase = await createClient();

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
      <h1 className="text-xl font-semibold">Open jobs</h1>

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
              className="inline-flex min-h-11 items-center rounded-md border border-input bg-card px-4 text-sm"
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
        <ul className="space-y-3">
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
