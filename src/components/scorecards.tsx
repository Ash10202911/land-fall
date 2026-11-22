import Link from "next/link";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { formatMoney } from "@/lib/domain";
import {
  formatHours,
  marketplaceKpis,
  type ActionItem,
  type ActionTone,
  type JobScorecard,
  type LaneDemand,
  type MarketplaceStats,
  type QuoteScorecard,
} from "@/lib/dashboard";

const toneLabel: Record<ActionTone, string> = {
  danger: "Blocked",
  warning: "Act soon",
  success: "Ready",
  neutral: "Opportunity",
};

const shortName = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, "");
const rate = (v: number | null) => (v === null ? "None yet" : `${v}%`);

export function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
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

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
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
        <div className="h-2 rounded-full bg-sea" style={{ width: `${width}%` }} />
      </div>
    </li>
  );
}

/** "Needs attention": the next things that move a job or a quote forward. Hidden when empty. */
export function ActionList({ items }: { items: ActionItem[] }) {
  if (items.length === 0) return null;
  return (
    <Section id="attention-heading" title="Needs attention">
      <ul className="grid gap-2 lg:grid-cols-2" data-testid="action-queue">
        {items.map((a) => (
          <li key={a.id}>
            <Link href={a.href} className="block h-full">
              <Card className="flex h-full items-start justify-between gap-3 p-4 transition-colors hover:bg-muted/40 sm:p-4">
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
    </Section>
  );
}

/** Requester side: how my jobs attract quotes and turn into awards. */
export function JobScorecardView({ s }: { s: JobScorecard }) {
  if (s.posted === 0) return null;
  return (
    <Section id="posting-heading" title="Your jobs" note={`Last ${s.days} days.`}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="job-scorecard">
        <Stat label="Jobs posted" value={String(s.posted)} hint={`${s.open} open, ${s.awarded} awarded, ${s.cancelled} cancelled`} />
        <Stat
          label="Award rate"
          value={rate(s.awardRate)}
          hint={s.expired > 0 ? `${s.expired} closed without an award` : "Of jobs that have closed"}
        />
        <Stat
          label="Quotes per job"
          value={s.avgQuotesPerJob === null ? "None yet" : String(s.avgQuotesPerJob)}
          hint={s.noQuoteRate === null ? undefined : `${s.noQuoteRate}% of closed jobs got none`}
        />
        <Stat label="Time to first quote" value={formatHours(s.medianHoursToFirstQuote)} hint="Median" />
      </div>
      {s.avgPriceSpreadPct !== null ? (
        <p className="text-sm text-muted-foreground">
          The lowest quote was on average {s.avgPriceSpreadPct}% below the highest, across {s.spreadJobs}{" "}
          {s.spreadJobs === 1 ? "comparison" : "comparisons"}.
          {s.awardsCompared > 0 ? ` You chose the lowest quote in ${s.lowestPicked} of ${s.awardsCompared} awards.` : ""}
        </p>
      ) : null}
    </Section>
  );
}

/** Quoter side: win rate gauge, funnel and win rate by mode. */
export function QuoteScorecardView({ s }: { s: QuoteScorecard }) {
  if (s.sent === 0) return null;
  const win = s.winRate ?? 0;
  const arc = Math.PI * 62;
  return (
    <Section id="quoting-heading" title="Your quotes" note={`Last ${s.days} days.`}>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="flex items-center gap-4 p-4 sm:p-4" data-testid="quote-scorecard">
          <div
            className="relative h-[88px] w-[150px] shrink-0"
            role="img"
            aria-label={s.winRate === null ? "Win rate: nothing decided yet" : `Win rate ${s.winRate} percent`}
          >
            <svg width="150" height="88" viewBox="0 0 150 88" aria-hidden>
              <path d="M 13 80 A 62 62 0 0 1 137 80" fill="none" stroke="var(--muted)" strokeWidth="14" strokeLinecap="round" />
              <path
                d="M 13 80 A 62 62 0 0 1 137 80"
                fill="none"
                stroke="var(--sea)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${((arc * win) / 100).toFixed(1)} ${arc.toFixed(1)}`}
              />
            </svg>
            <span className="absolute inset-x-0 bottom-0 text-center">
              <span className="block text-2xl font-bold">{rate(s.winRate)}</span>
              <span className="text-xs text-muted-foreground">win rate</span>
            </span>
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
            <li className="flex justify-between gap-2"><span>Sent</span><strong>{s.sent}</strong></li>
            <li className="flex justify-between gap-2"><span>Still open</span><strong>{s.open}</strong></li>
            <li className="flex justify-between gap-2"><span>Won / lost</span><strong>{s.won} / {s.lost}</strong></li>
            <li className="flex justify-between gap-2"><span>Your median reply</span><strong>{formatHours(s.medianHoursToQuote)}</strong></li>
          </ul>
        </Card>
        <Card className="space-y-3 p-4 sm:p-4">
          <h3 className="text-sm font-semibold">Win rate by mode</h3>
          {s.byMode.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing decided yet.</p>
          ) : (
            <ul className="space-y-3">
              {s.byMode.map((m) => (
                <Bar key={m.mode} label={m.mode} value={m.winRate ?? 0} max={100} text={`${rate(m.winRate)} · ${m.sent} sent`} />
              ))}
            </ul>
          )}
          {s.wonValue.length > 0 ? (
            <p className="text-sm">
              <span className="font-medium">Value won: </span>
              {s.wonValue.map((v) => formatMoney(v.minor, v.currency)).join(" + ")}
            </p>
          ) : null}
        </Card>
      </div>
    </Section>
  );
}

/** Busiest lanes on the public board (jobs are public, so no sealed data is involved). */
export function LaneDemandView({ d }: { d: LaneDemand }) {
  if (d.lanes.length === 0) return null;
  const maxLane = Math.max(0, ...d.lanes.map((l) => l.jobs));
  return (
    <Section
      id="demand-heading"
      title="Where the demand is"
      note={`Jobs posted in the last ${d.days} days, compared with the ${d.days} days before.`}
    >
      <Card className="space-y-4 p-4 sm:p-4" data-testid="lane-demand">
        <ul className="space-y-4">
          {d.lanes.map((l) => {
            const change = l.jobs - l.previous;
            return (
              <li key={l.key} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 font-medium">
                    {shortName(l.origin)} to {shortName(l.destination)}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {l.jobs} {l.jobs === 1 ? "job" : "jobs"}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted" aria-hidden>
                  <div className="h-2 rounded-full bg-sea" style={{ width: `${Math.max(4, Math.round((l.jobs / maxLane) * 100))}%` }} />
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
      </Card>
    </Section>
  );
}

type QueueRow = {
  company_id: string;
  company_name: string;
  company_country: string;
  company_role: string;
  waiting_quotes: number;
  awaiting_jobs: number;
};

/** Admin only: counts and timings for the whole marketplace, plus who is stuck waiting on verification. */
export function MarketplaceHealth({ stats, queue }: { stats: MarketplaceStats | null; queue: QueueRow[] }) {
  return (
    <Section id="health-heading" title="Marketplace health" note="Last 30 days. Counts and timings only: admins never see quote amounts.">
      {stats ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="marketplace-kpis">
            {marketplaceKpis(stats).map((k) => (
              <Stat key={k.label} label={k.label} value={k.value} hint={k.hint} />
            ))}
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Verification queue</h3>
            <p className="text-sm text-muted-foreground">
              Basic companies with quotes waiting on their jobs. They cannot award until verified.
            </p>
            {queue.length === 0 ? (
              <EmptyState title="No one is waiting to be verified" />
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
                {queue.map((c) => (
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
  );
}
