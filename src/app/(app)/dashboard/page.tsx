import Link from "next/link";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { requireMember } from "@/lib/auth";
import { formatMoney } from "@/lib/domain";
import {
  buildActionQueue,
  buildJobScorecard,
  buildLaneDemand,
  buildQuoteScorecard,
  formatHours,
  marketplaceKpis,
  type ActionTone,
} from "@/lib/dashboard";
import { loadAdminData, loadDashboardData } from "@/lib/dashboard-data";

export const metadata = { title: "Dashboard" };

const toneLabel: Record<ActionTone, string> = {
  danger: "Blocked",
  warning: "Act soon",
  success: "Ready",
  neutral: "Opportunity",
};

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div>
        <h2 id={id} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="space-y-1 p-4 sm:p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

function Bar({ label, value, max, text }: { label: string; value: number; max: number; text: string }) {
  const width = max === 0 ? 0 : Math.max(4, Math.round((value / max) * 100));
  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium">{label}</span>
        <span className="shrink-0 text-muted-foreground">{text}</span>
      </div>
      <div className="h-2 rounded-full bg-muted" aria-hidden>
        <div className="h-2 rounded-full bg-accent" style={{ width: `${width}%` }} />
      </div>
    </li>
  );
}

const shortName = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, "");
const rate = (v: number | null) => (v === null ? "None yet" : `${v}%`);

export default async function DashboardPage() {
  const me = await requireMember();
  const now = new Date();
  const [data, admin] = await Promise.all([
    loadDashboardData(me.company.id, now),
    me.is_admin ? loadAdminData(30) : Promise.resolve(null),
  ]);

  const openJobs = data.board.filter((j) => j.status === "open" && new Date(j.deadline_at) > now);
  const actions = buildActionQueue({
    isVerified: me.company.trust_level === "verified",
    myJobs: data.myJobs,
    myQuotes: data.myQuotes,
    openJobs,
    myCompanyId: me.company.id,
    now,
  });
  const quoting = buildQuoteScorecard(data.myQuotes, now);
  const posting = buildJobScorecard(data.myJobs, now);
  const demand = buildLaneDemand(data.board, now);
  const maxLane = Math.max(0, ...demand.lanes.map((l) => l.jobs));
  const kpis = admin?.stats ? marketplaceKpis(admin.stats) : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {me.company.name}. Your own activity covers the last {quoting.days} days.
        </p>
      </div>

      {data.failed ? (
        <p role="alert" className="rounded-lg border border-border bg-muted p-3 text-sm">
          Some figures could not be loaded. Refresh the page to try again.
        </p>
      ) : null}

      <Section id="attention-heading" title="Needs attention" note="The next things that move a job or a quote forward.">
        {actions.length === 0 ? (
          <EmptyState title="You are all caught up" body="Nothing is waiting on you right now." />
        ) : (
          <ul className="space-y-2" data-testid="action-queue">
            {actions.map((a) => (
              <li key={a.id}>
                <Link href={a.href} className="block">
                  <Card className="flex items-start justify-between gap-3 p-4 transition-colors hover:bg-muted/40 sm:p-4">
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold">{a.title}</p>
                      <p className="text-sm text-muted-foreground">{a.detail}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Badge tone={a.tone}>{toneLabel[a.tone]}</Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {admin ? (
        <Section
          id="health-heading"
          title="Marketplace health"
          note="Last 30 days. Counts and timings only: admins never see quote amounts."
        >
          {admin.stats ? (
            <>
              <div className="grid grid-cols-2 gap-3" data-testid="marketplace-kpis">
                {kpis.map((k) => (
                  <Stat key={k.label} label={k.label} value={k.value} hint={k.hint} />
                ))}
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Verification queue</h3>
                <p className="text-sm text-muted-foreground">
                  Basic companies with quotes waiting on their jobs. They cannot award until verified.
                </p>
                {admin.queue.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No one is waiting to be verified.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
                    {admin.queue.map((c) => (
                      <li key={c.company_id}>
                        <Link
                          href={`/admin?q=${encodeURIComponent(c.company_name)}`}
                          className="flex min-h-12 items-center justify-between gap-3 p-3 hover:bg-muted/40"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{c.company_name}</span>
                            <span className="block text-muted-foreground">
                              {c.company_country} · {c.company_role === "agent" ? "Agent" : "Forwarder"}
                            </span>
                          </span>
                          <span className="shrink-0 text-right text-muted-foreground">
                            {c.waiting_quotes} {c.waiting_quotes === 1 ? "quote" : "quotes"} on {c.awaiting_jobs}{" "}
                            {c.awaiting_jobs === 1 ? "job" : "jobs"}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <p role="alert" className="rounded-lg border border-border bg-muted p-3 text-sm">
              Marketplace figures are not available. The latest database migration may not be applied yet.
            </p>
          )}
        </Section>
      ) : null}

      <Section id="quoting-heading" title="Your quotes" note="How your quotes perform when you quote on other companies' jobs.">
        {quoting.sent === 0 ? (
          <EmptyState title="No quotes yet" body="Send a sealed quote on an open job and your win rate will show here." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3" data-testid="quote-scorecard">
              <Stat
                label="Win rate"
                value={rate(quoting.winRate)}
                hint={quoting.won + quoting.lost === 0 ? "Nothing decided yet" : `${quoting.won} won, ${quoting.lost} lost`}
              />
              <Stat label="Quotes sent" value={String(quoting.sent)} hint={`${quoting.withdrawn} withdrawn`} />
              <Stat label="Open now" value={String(quoting.open)} hint={`${quoting.awaitingAward} awaiting the poster`} />
              <Stat label="Time to quote" value={formatHours(quoting.medianHoursToQuote)} hint="Median, from the job being posted" />
            </div>
            {quoting.wonValue.length > 0 ? (
              <p className="text-sm">
                <span className="font-medium">Value won: </span>
                {quoting.wonValue.map((v) => formatMoney(v.minor, v.currency)).join(" + ")}
              </p>
            ) : null}
            {quoting.byMode.length > 0 ? (
              <Card className="space-y-3 p-4 sm:p-4">
                <h3 className="text-sm font-semibold">Win rate by mode</h3>
                <ul className="space-y-3">
                  {quoting.byMode.map((m) => (
                    <Bar
                      key={m.mode}
                      label={m.mode}
                      value={m.winRate ?? 0}
                      max={100}
                      text={`${rate(m.winRate)} · ${m.sent} sent`}
                    />
                  ))}
                </ul>
              </Card>
            ) : null}
          </>
        )}
      </Section>

      <Section id="posting-heading" title="Your jobs" note="How the jobs you post attract quotes and turn into awards.">
        {posting.posted === 0 ? (
          <EmptyState title="No jobs posted yet" body="Post a job and you will see how quickly quotes arrive." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3" data-testid="job-scorecard">
              <Stat
                label="Jobs posted"
                value={String(posting.posted)}
                hint={`${posting.open} open, ${posting.awarded} awarded, ${posting.cancelled} cancelled`}
              />
              <Stat
                label="Award rate"
                value={rate(posting.awardRate)}
                hint={posting.expired > 0 ? `${posting.expired} closed without an award` : "Of jobs that have closed"}
              />
              <Stat
                label="Quotes per job"
                value={posting.avgQuotesPerJob === null ? "None yet" : String(posting.avgQuotesPerJob)}
                hint={posting.noQuoteRate === null ? undefined : `${posting.noQuoteRate}% of closed jobs got none`}
              />
              <Stat label="Time to first quote" value={formatHours(posting.medianHoursToFirstQuote)} hint="Median" />
            </div>
            {posting.avgPriceSpreadPct !== null ? (
              <p className="text-sm text-muted-foreground">
                The lowest quote was on average {posting.avgPriceSpreadPct}% below the highest, across{" "}
                {posting.spreadJobs} {posting.spreadJobs === 1 ? "comparison" : "comparisons"}.
                {posting.awardsCompared > 0
                  ? ` You chose the lowest quote in ${posting.lowestPicked} of ${posting.awardsCompared} awards.`
                  : ""}
              </p>
            ) : null}
          </>
        )}
      </Section>

      <Section
        id="demand-heading"
        title="Where the demand is"
        note={`Jobs posted in the last ${demand.days} days across the board, compared with the ${demand.days} days before.`}
      >
        {demand.lanes.length === 0 ? (
          <EmptyState title="No jobs on the board yet" body="Busy lanes will show here as jobs are posted." />
        ) : (
          <Card className="space-y-4 p-4 sm:p-4" data-testid="lane-demand">
            <p className="text-sm">
              <span className="font-semibold">{demand.total}</span> {demand.total === 1 ? "job" : "jobs"} posted
              {demand.previousTotal > 0 ? (
                <span className="text-muted-foreground"> (previously {demand.previousTotal})</span>
              ) : null}
            </p>
            <ul className="space-y-4">
              {demand.lanes.map((l) => {
                const change = l.jobs - l.previous;
                return (
                  <li key={l.key} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 font-medium">{shortName(l.origin)} to {shortName(l.destination)}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {l.jobs} {l.jobs === 1 ? "job" : "jobs"}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted" aria-hidden>
                      <div
                        className="h-2 rounded-full bg-accent"
                        style={{ width: `${Math.max(4, Math.round((l.jobs / maxLane) * 100))}%` }}
                      />
                    </div>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span>{l.openNow} open now</span>
                      <span>{l.modes}</span>
                      <span className="inline-flex items-center gap-1">
                        {change > 0 ? (
                          <TrendingUp className="h-3.5 w-3.5 text-success" aria-hidden />
                        ) : change < 0 ? (
                          <TrendingDown className="h-3.5 w-3.5 text-destructive" aria-hidden />
                        ) : null}
                        {change > 0 ? `up ${change}` : change < 0 ? `down ${-change}` : "no change"} on the period before
                      </span>
                    </p>
                  </li>
                );
              })}
            </ul>
            {demand.modeMix.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                Mode mix: {demand.modeMix.map((m) => `${m.mode} ${m.pct}%`).join(", ")}.
                {demand.flags.dg + demand.flags.reefer + demand.flags.bmsb > 0
                  ? ` Special cargo: ${demand.flags.dg} dangerous goods, ${demand.flags.reefer} reefer, ${demand.flags.bmsb} BMSB risk.`
                  : ""}
              </p>
            ) : null}
          </Card>
        )}
      </Section>
    </div>
  );
}
