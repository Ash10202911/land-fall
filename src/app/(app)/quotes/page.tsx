import Link from "next/link";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { ActionList, LaneDemandView, QuoteScorecardView } from "@/components/scorecards";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { formatDate } from "@/lib/domain";
import { flagFor } from "@/lib/geo";
import { actionsFor, buildActionQueue, buildLaneDemand, buildQuoteScorecard } from "@/lib/dashboard";
import { loadDashboardData } from "@/lib/dashboard-data";
import { QUOTE_STATUS_LABEL, quoteTotal, type QuoteRow } from "@/lib/quotes";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "My quotes" };

const tone = { sent: "neutral", withdrawn: "warning", won: "success", lost: "danger" } as const;

type Port = { name: string; country: string };
type Row = QuoteRow & {
  job: { id: string; origin: Port | Port[]; destination: Port | Port[]; mode: string } | null;
};

const first = <T,>(v: T | T[]): T => (Array.isArray(v) ? v[0] : v);
const shortName = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, "");

export default async function MyQuotesPage() {
  const t = await getT();
  const me = await requireMember();
  const now = new Date();
  const supabase = await createClient();
  const [{ data }, dash] = await Promise.all([
    supabase
      .from("quotes")
      .select(
        `id, job_id, company_id, valid_until, status, created_at,
         lines:quote_lines(amount_minor, currency),
         job:jobs!job_id(id, mode, origin:ports!origin_port_id(name, country), destination:ports!destination_port_id(name, country))`,
      )
      .eq("company_id", me.company.id)
      .order("created_at", { ascending: false }),
    loadDashboardData(me.company.id, now),
  ]);
  const quotes = ((data ?? []) as unknown as Row[]).map((q) => ({
    ...q,
    job: q.job ? { ...q.job, origin: first(q.job.origin), destination: first(q.job.destination) } : null,
  }));

  const openJobs = dash.board.filter((j) => j.status === "open" && new Date(j.deadline_at) > now);
  const actions = actionsFor(
    buildActionQueue({
      isVerified: me.company.trust_level === "verified",
      myJobs: [],
      myQuotes: dash.myQuotes,
      openJobs,
      myCompanyId: me.company.id,
      tr: t,
      now,
      limit: 50,
    }),
    "quoter",
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-accent">{t("Quoter mode")}</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("My quotes")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("Quotes your company sent. Each one is sealed: only the requester sees it.")}</p>
      </div>

      <ActionList items={actions} />
      <QuoteScorecardView s={buildQuoteScorecard(dash.myQuotes, now)} />

      <section aria-labelledby="sent-heading" className="space-y-3">
        <h2 id="sent-heading" className="text-lg font-semibold tracking-tight">
          {t("Sent quotes")}
        </h2>
        {quotes.length === 0 ? (
          <EmptyState title={t("You have not sent any quotes yet")} body="Switch to the Job board and send a sealed quote on an open job." />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 [&>li]:min-w-0">
            {quotes.map((q) => {
              const o = q.job?.origin as Port | undefined;
              const d = q.job?.destination as Port | undefined;
              return (
                <li key={q.id}>
                  <Link href={`/jobs/${q.job_id}`} className="block h-full">
                    <Card className="h-full space-y-1 transition-colors hover:bg-muted/40">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">
                          {o && d ? (
                            <>
                              <span aria-hidden className="mr-1.5">
                                {flagFor(o.country)}
                                {flagFor(d.country)}
                              </span>
                              <span>
                                {t("{origin} to {destination}", { origin: shortName(o.name), destination: shortName(d.name) })}
                              </span>
                            </>
                          ) : (
                            t("Job")
                          )}
                        </p>
                        <Badge tone={tone[q.status]}>{t(QUOTE_STATUS_LABEL[q.status])}</Badge>
                      </div>
                      <p className="text-lg font-bold">{quoteTotal(q)}</p>
                      <p className="text-xs text-muted-foreground">
                        {q.job?.mode} · {t("valid until {date}", { date: formatDate(q.valid_until) })}
                      </p>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <LaneDemandView d={buildLaneDemand(dash.board, now)} />
    </div>
  );
}
