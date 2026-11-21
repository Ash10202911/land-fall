import Link from "next/link";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { formatDate } from "@/lib/domain";
import { QUOTE_STATUS_LABEL, quoteTotal, type QuoteRow } from "@/lib/quotes";

export const metadata = { title: "My Quotes" };

const tone = { sent: "neutral", withdrawn: "warning", won: "success", lost: "danger" } as const;

type Row = QuoteRow & {
  job: { id: string; origin: { name: string } | { name: string }[]; destination: { name: string } | { name: string }[]; mode: string } | null;
};

const first = <T,>(v: T | T[]): T => (Array.isArray(v) ? v[0] : v);

export default async function MyQuotesPage() {
  const me = await requireMember();
  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select(
      `id, job_id, company_id, valid_until, status, created_at,
       lines:quote_lines(amount_minor, currency),
       job:jobs!job_id(id, mode, origin:ports!origin_port_id(name), destination:ports!destination_port_id(name))`,
    )
    .eq("company_id", me.company.id)
    .order("created_at", { ascending: false });
  const quotes = ((data ?? []) as unknown as Row[]).map((q) => ({
    ...q,
    job: q.job ? { ...q.job, origin: first(q.job.origin), destination: first(q.job.destination) } : null,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My Quotes</h1>
      {quotes.length === 0 ? (
        <EmptyState title="You have not sent any quotes yet" body="Find an open job in the Jobs tab and send a sealed quote." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quotes.map((q) => (
            <li key={q.id}>
              <Link href={`/jobs/${q.job_id}`} className="block">
                <Card className="space-y-1 transition-colors hover:bg-muted/40">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">
                      {q.job ? `${(q.job.origin as { name: string }).name} to ${(q.job.destination as { name: string }).name}` : "Job"}
                    </p>
                    <Badge tone={tone[q.status]}>{QUOTE_STATUS_LABEL[q.status]}</Badge>
                  </div>
                  <p className="text-sm">{quoteTotal(q)}</p>
                  <p className="text-xs text-muted-foreground">
                    {q.job?.mode} · valid until {formatDate(q.valid_until)}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
