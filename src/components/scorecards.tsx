"use client";

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
import { useT } from "@/components/i18n-provider";
import { msg, type Translator } from "@/lib/i18n";

const toneLabel: Record<ActionTone, string> = {
  danger: msg("Blocked"),
  warning: msg("Act soon"),
  success: msg("Ready"),
  neutral: msg("Opportunity"),
};

const shortName = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, "");
const rate = (v: number | null, t: Translator) => (v === null ? t("None yet") : `${v}%`);

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
  const t = useT();
  if (items.length === 0) return null;
  return (
    <Section id="attention-heading" title={t("Needs attention")}>
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
                  <Badge tone={a.tone}>{t(toneLabel[a.tone])}</Badge>
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
  const t = useT();
  if (s.posted === 0) return null;
  return (
    <Section id="posting-heading" title={t("How your requests are doing")} note={t("Last {n} days.", { n: s.days })}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="job-scorecard">
        <Stat label={t("Jobs posted")} value={String(s.posted)} hint={t("{open} open, {awarded} awarded, {cancelled} cancelled", { open: s.open, awarded: s.awarded, cancelled: s.cancelled })} />
        <Stat
          label={t("Award rate")}
          value={rate(s.awardRate, t)}
          hint={s.expired > 0 ? t("{n} closed without an award", { n: s.expired }) : t("Of jobs that have closed")}
        />
        <Stat
          label={t("Quotes per job")}
          value={s.avgQuotesPerJob === null ? t("None yet") : String(s.avgQuotesPerJob)}
          hint={s.noQuoteRate === null ? undefined : t("{n}% of closed jobs got none", { n: s.noQuoteRate })}
        />
        <Stat label={t("Time to first quote")} value={formatHours(s.medianHoursToFirstQuote, t)} hint={t("Median")} />
      </div>
      {s.avgPriceSpreadPct !== null ? (
        <p className="text-sm text-muted-foreground">
          {t.plural(s.spreadJobs, "The lowest quote was on average {pct}% below the highest, across {n} comparison.", "The lowest quote was on average {pct}% below the highest, across {n} comparisons.", { pct: s.avgPriceSpreadPct })}
          {s.awardsCompared > 0 ? ` ${t("You chose the lowest quote in {picked} of {total} awards.", { picked: s.lowestPicked, total: s.awardsCompared })}` : ""}
        </p>
      ) : null}
    </Section>
  );
}

/** Quoter side: win rate gauge, funnel and win rate by mode. */
export function QuoteScorecardView({ s }: { s: QuoteScorecard }) {
  const t = useT();
  if (s.sent === 0) return null;
  const win = s.winRate ?? 0;
  const arc = Math.PI * 62;
  return (
    <Section id="quoting-heading" title={t("How your quotes are doing")} note={t("Last {n} days.", { n: s.days })}>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="flex items-center gap-4 p-4 sm:p-4" data-testid="quote-scorecard">
          <div
            className="relative h-[88px] w-[150px] shrink-0"
            role="img"
            aria-label={s.winRate === null ? t("Win rate: nothing decided yet") : t("Win rate {n} percent", { n: s.winRate })}
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
              <span className="block text-2xl font-bold">{rate(s.winRate, t)}</span>
              <span className="text-xs text-muted-foreground">{t("win rate")}</span>
            </span>
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
            <li className="flex justify-between gap-2"><span>{t("Sent")}</span><strong>{s.sent}</strong></li>
            <li className="flex justify-between gap-2"><span>{t("Still open")}</span><strong>{s.open}</strong></li>
            <li className="flex justify-between gap-2"><span>{t("Won / lost")}</span><strong>{s.won} / {s.lost}</strong></li>
            <li className="flex justify-between gap-2"><span>{t("Your median reply")}</span><strong>{formatHours(s.medianHoursToQuote, t)}</strong></li>
          </ul>
        </Card>
        <Card className="space-y-3 p-4 sm:p-4">
          <h3 className="text-sm font-semibold">{t("Win rate by mode")}</h3>
          {s.byMode.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("Nothing decided yet.")}</p>
          ) : (
            <ul className="space-y-3">
              {s.byMode.map((m) => (
                <Bar key={m.mode} label={m.mode} value={m.winRate ?? 0} max={100} text={`${rate(m.winRate, t)} · ${t("{n} sent", { n: m.sent })}`} />
              ))}
            </ul>
          )}
          {s.wonValue.length > 0 ? (
            <p className="text-sm">
              <span className="font-medium">{t("Value won:")} </span>
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
  const t = useT();
  if (d.lanes.length === 0) return null;
  const maxLane = Math.max(0, ...d.lanes.map((l) => l.jobs));
  return (
    <Section
      id="demand-heading"
      title={t("Where the demand is")}
      note={t("Jobs posted in the last {n} days, compared with the {n} days before.", { n: d.days })}
    >
      <Card className="space-y-4 p-4 sm:p-4" data-testid="lane-demand">
        <ul className="space-y-4">
          {d.lanes.map((l) => {
            const change = l.jobs - l.previous;
            return (
              <li key={l.key} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 font-medium">
                    {t("{origin} to {destination}", { origin: shortName(l.origin), destination: shortName(l.destination) })}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {t.plural(l.jobs, "{n} job", "{n} jobs")}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted" aria-hidden>
                  <div className="h-2 rounded-full bg-sea" style={{ width: `${Math.max(4, Math.round((l.jobs / maxLane) * 100))}%` }} />
                </div>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>{t("{n} open now", { n: l.openNow })}</span>
                  <span>{l.modes}</span>
                  <span className="inline-flex items-center gap-1">
                    {change > 0 ? (
                      <TrendingUp className="h-3.5 w-3.5 text-success" aria-hidden />
                    ) : change < 0 ? (
                      <TrendingDown className="h-3.5 w-3.5 text-destructive" aria-hidden />
                    ) : null}
                    {change > 0 ? t("up {n} on the period before", { n: change }) : change < 0 ? t("down {n} on the period before", { n: -change }) : t("no change on the period before")}
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
  const t = useT();
  return (
    <Section id="health-heading" title={t("Marketplace health")} note="Last 30 days. Counts and timings only: admins never see quote amounts.">
      {stats ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="marketplace-kpis">
            {marketplaceKpis(stats).map((k) => (
              <Stat key={k.label} label={k.label} value={k.value} hint={k.hint} />
            ))}
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">{t("Verification queue")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("Basic companies with quotes waiting on their jobs. They cannot award until verified.")}
            </p>
            {queue.length === 0 ? (
              <EmptyState title={t("No one is waiting to be verified")} />
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
          {t("Marketplace figures are not available. The latest database migration may not be applied yet.")}
        </p>
      )}
    </Section>
  );
}
