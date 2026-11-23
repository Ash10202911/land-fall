import Link from "next/link";
import { FilePlus2, Lock, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { JobCard, type Band } from "@/components/job-card";
import { ActionList, JobScorecardView } from "@/components/scorecards";
import { createClient } from "@/lib/supabase/server";
import { requireMember, type Company } from "@/lib/auth";
import { JOB_SELECT, normaliseJob } from "@/lib/jobs";
import { MODES } from "@/lib/domain";
import { actionsFor, buildActionQueue, buildJobScorecard } from "@/lib/dashboard";
import { loadDashboardData } from "@/lib/dashboard-data";
import { isNewJob } from "@/lib/mode";
import { getSeenAt, getViewMode } from "@/lib/view-mode";
import { markJobsSeen } from "../mode-actions";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Jobs" };

async function Heading({ eyebrow, note }: { eyebrow: string; note: string }) {
  const t = await getT();
  return (
    <div>
      <p className="text-sm font-semibold text-accent">{eyebrow}</p>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("Jobs")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{note}</p>
    </div>
  );
}

const STEPS = [
  { icon: FilePlus2, title: "Request a quote", body: "Route, cargo and Incoterm in about 30 seconds. Your street address stays private." },
  { icon: Lock, title: "Forwarders send sealed quotes", body: "Verified ANZ forwarders quote. Only you see the prices." },
  { icon: Trophy, title: "Compare and award", body: "Line by line. Contact details unlock for you and the winner only." },
];

/** Shown to a requester with no jobs yet: what happens next, and one clear action. */
async function RequesterWelcome() {
  const t = await getT();
  return (
    <div className="overflow-hidden rounded-[22px] border border-border bg-card shadow-card">
      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center">
        <div className="space-y-3">
          <h3 className="text-2xl font-bold tracking-tight">{t("Get sealed quotes from verified ANZ forwarders")}</h3>
          <p className="text-muted-foreground">
            {t("Post your first request and it appears on the job board of every forwarder watching that lane.")}
          </p>
          <Link
            href="/post"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground"
          >
            <FilePlus2 className="h-4 w-4" aria-hidden />
            {t("Request your first quote")}
          </Link>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="rounded-2xl border border-border bg-sea-soft p-4">
              <span className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-card text-sea-ink shadow-card" aria-hidden>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-xs font-bold text-sea-ink">Step {i + 1}</span>
              </span>
              <p className="mt-3 font-bold">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Requester mode: jobs my company posted, with the quotes coming in. */
async function RequesterView({ company, now }: { company: Company; now: Date }) {
  const t = await getT();
  const supabase = await createClient();
  const [{ data }, dash] = await Promise.all([
    supabase
      .from("jobs")
      .select(`${JOB_SELECT}, quotes:quotes!job_id(count)`)
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(100),
    loadDashboardData(company.id, now),
  ]);
  // Withdrawn quotes are hidden by RLS, so the count is live quotes only.
  const mine = (data ?? []).map((row) => {
    const counts = (row as unknown as { quotes?: { count: number }[] }).quotes;
    return { job: normaliseJob(row), quoteCount: counts?.[0]?.count ?? 0 };
  });
  const actions = actionsFor(
    buildActionQueue({
      isVerified: company.trust_level === "verified",
      myJobs: dash.myJobs,
      myQuotes: [],
      openJobs: [],
      myCompanyId: company.id,
      now,
      limit: 50,
    }),
    "requester",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Heading eyebrow="My requests · Requester mode" note="Jobs your company posted and the sealed quotes coming in." />
        <Link
          href="/post"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <FilePlus2 className="h-4 w-4" aria-hidden />
          {t("Request a quote")}
        </Link>
      </div>
      <ActionList items={actions} />
      <JobScorecardView s={buildJobScorecard(dash.myJobs, now)} />
      <section aria-labelledby="my-jobs-heading" className="space-y-3">
        <h2 id="my-jobs-heading" className="text-lg font-semibold tracking-tight">
          {t("Your requests")}
        </h2>
        {mine.length === 0 ? (
          <RequesterWelcome />
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 [&>li]:min-w-0">
            {mine.map(({ job, quoteCount }) => (
              <li key={job.id}>
                <JobCard job={job} now={now} quoteCount={quoteCount} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Quoter mode: the open board of other companies' jobs to quote on. */
async function QuoterView({
  company,
  now,
  dest,
  mode,
  onlyNew,
}: {
  company: Company;
  now: Date;
  dest?: string;
  mode?: string;
  onlyNew: boolean;
}) {
  const t = await getT();
  const supabase = await createClient();
  const destId = Number.parseInt(dest ?? "", 10);
  const modeFilter = MODES.find((m) => m === mode);

  let query = supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("status", "open")
    .gt("deadline_at", now.toISOString())
    .neq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (Number.isInteger(destId) && destId > 0) query = query.eq("destination_port_id", destId);
  if (modeFilter) query = query.eq("mode", modeFilter);

  const [{ data: rows }, { data: ports }, seen] = await Promise.all([
    query,
    supabase.from("ports").select("id, code, name, country").order("country").order("name"),
    getSeenAt(),
  ]);
  const all = (rows ?? []).map(normaliseJob).map((job) => ({ job, isNew: isNewJob(job.created_at, seen, now) }));
  const newCount = all.filter((j) => j.isNew).length;
  const jobs = onlyNew ? all.filter((j) => j.isNew) : all;

  const bands = new Map<string, Band>();
  if (jobs.length > 0) {
    const { data } = await supabase.rpc("job_quote_bands", { p_job_ids: jobs.map((j) => j.job.id) });
    for (const r of (data ?? []) as { job_id: string; band: Band }[]) bands.set(r.job_id, r.band);
  }
  const filtered = Boolean(modeFilter) || (Number.isInteger(destId) && destId > 0) || onlyNew;

  return (
    <div className="space-y-5">
      <Heading eyebrow="Job board · Quoter mode" note="Open jobs from other companies. Your quote is sealed: only the requester sees it." />

      {newCount > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-primary p-3 pl-4 text-primary-foreground" role="status">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-cyan-300 motion-reduce:animate-none" aria-hidden />
          <p className="min-w-0 flex-1 text-sm">
            <strong className="text-cyan-200">
              {newCount} new {newCount === 1 ? "job" : "jobs"}
            </strong>{" "}
            since your last visit
          </p>
          {!onlyNew ? (
            <Link href="/jobs?new=1" className="inline-flex min-h-10 items-center rounded-xl bg-cyan-300 px-3 text-sm font-bold text-primary">
              {t("Show new")}
            </Link>
          ) : null}
          <form action={markJobsSeen}>
            <button type="submit" className="min-h-10 rounded-xl border border-white/30 px-3 text-sm font-semibold">
              {t("Mark seen")}
            </button>
          </form>
        </div>
      ) : null}

      <form method="get" className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_9rem_auto]">
        <Select name="dest" defaultValue={Number.isInteger(destId) ? String(destId) : ""} aria-label={t("Destination port")}>
          <option value="">{t("All destinations")}</option>
          {(ports ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code})
            </option>
          ))}
        </Select>
        <Select name="mode" defaultValue={modeFilter ?? ""} aria-label={t("Mode")}>
          <option value="">{t("All modes")}</option>
          {MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Button type="submit" variant="default" className="flex-1">
            {t("Filter")}
          </Button>
          {filtered ? (
            <Link href="/jobs" className="inline-flex min-h-11 items-center rounded-xl border border-input bg-card px-4 text-sm">
              {t("Clear")}
            </Link>
          ) : null}
        </div>
      </form>

      {jobs.length === 0 ? (
        <EmptyState
          title={filtered ? t("No jobs match those filters") : t("No open jobs right now")}
          body={filtered ? "Try a different destination or mode." : "New jobs from other companies appear here, newest first."}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 [&>li]:min-w-0">
          {jobs.map(({ job, isNew }) => (
            <li key={job.id}>
              <JobCard job={job} now={now} isNew={isNew} band={bands.get(job.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ dest?: string; mode?: string; new?: string }>;
}) {
  const me = await requireMember();
  const viewMode = await getViewMode(me.company);
  const { dest, mode, new: onlyNew } = await searchParams;
  const now = new Date();
  return viewMode === "requester" ? (
    <RequesterView company={me.company} now={now} />
  ) : (
    <QuoterView company={me.company} now={now} dest={dest} mode={mode} onlyNew={onlyNew === "1"} />
  );
}
