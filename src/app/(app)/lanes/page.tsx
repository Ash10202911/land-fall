import Link from "next/link";
import { Bell, FileSpreadsheet, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { requireMember } from "@/lib/auth";
import { formatDate } from "@/lib/domain";
import { flagFor } from "@/lib/geo";
import { ALERT_FREQUENCIES, FREQUENCY_LABELS, type AlertFrequency } from "@/lib/lane-alerts";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { AddLaneForm, type PortOption } from "./add-lane-form";
import { deleteLaneAlert, setLaneFrequency } from "./actions";

export const metadata = { title: "My lanes" };

type PortRef = { code: string; name: string; country: string };
type AlertView = {
  id: string;
  origin_country: string | null;
  modes: string[];
  destination_only: boolean;
  frequency: AlertFrequency;
  origin: PortRef | PortRef[] | null;
  destination: PortRef | PortRef[];
};
type CardView = {
  id: string;
  name: string;
  currency: string;
  valid_to: string;
  port: PortRef | PortRef[];
  charges: { count: number }[];
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const shortName = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, "");
const MODE_TAG: Record<string, string> = { FCL: "Sea FCL", LCL: "Sea LCL", Air: "Air" };

export default async function LanesPage() {
  const me = await requireMember();
  const supabase = await createClient();
  const [{ data: alertRows }, { data: cardRows }, { data: ports }] = await Promise.all([
    supabase
      .from("lane_alerts")
      .select(
        "id, origin_country, modes, destination_only, frequency, origin:ports!origin_port_id(code, name, country), destination:ports!destination_port_id(code, name, country)",
      )
      .eq("company_id", me.company.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("rate_cards")
      .select("id, name, currency, valid_to, port:ports!destination_port_id(code, name, country), charges:rate_card_charges(count)")
      .eq("company_id", me.company.id)
      .order("updated_at", { ascending: false }),
    supabase.from("ports").select("id, code, name, country").order("country").order("name"),
  ]);
  const alerts = (alertRows ?? []) as unknown as AlertView[];
  const cards = (cardRows ?? []) as unknown as CardView[];
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const soon = new Date(now.getTime() + 14 * 86_400_000).toISOString().slice(0, 10);
  const usableCodes = new Set(cards.filter((c) => c.valid_to >= today).map((c) => one(c.port)?.code));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold text-accent">Quoter mode</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My lanes</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Get an email the moment a matching job is posted. Add a rate card and the quote is filled in for you.
        </p>
      </div>

      <section aria-labelledby="alerts-heading" className="space-y-3">
        <h2 id="alerts-heading" className="text-lg font-semibold tracking-tight">
          Lane alerts
        </h2>
        {alerts.length === 0 ? (
          <EmptyState title="No lane alerts yet" body="Add a lane such as China to Sydney and we will email you when a matching job is posted." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 [&>li]:min-w-0">
            {alerts.map((a) => {
              const o = one(a.origin);
              const d = one(a.destination)!;
              const originLabel = o ? shortName(o.name) : a.origin_country ? `${a.origin_country} (any port)` : "Anywhere";
              const hasCard = usableCodes.has(d.code);
              return (
                <li key={a.id}>
                  <Card className="flex h-full flex-col gap-3">
                    <p className="flex flex-wrap items-center gap-x-2 font-bold">
                      <span aria-hidden>{o ? flagFor(o.country) : a.origin_country ? flagFor(a.origin_country) : ""}</span>
                      {originLabel}
                      <span className="text-sea" aria-hidden>
                        →
                      </span>
                      <span className="sr-only">to</span>
                      <span aria-hidden>{flagFor(d.country)}</span>
                      {shortName(d.name)}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(a.modes.length > 0 ? a.modes.map((m) => MODE_TAG[m] ?? m) : ["Every mode"]).map((t) => (
                        <span key={t} className="rounded-lg border border-border bg-sea-soft px-2 py-1 text-xs font-semibold">
                          {t}
                        </span>
                      ))}
                      {a.destination_only ? (
                        <span className="rounded-lg border border-border bg-sea-soft px-2 py-1 text-xs font-semibold">Destination only</span>
                      ) : null}
                    </div>
                    <div>
                      <p id={`freq-${a.id}`} className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Email me
                      </p>
                      <div role="group" aria-labelledby={`freq-${a.id}`} className="flex gap-1 rounded-xl bg-muted p-1">
                        {ALERT_FREQUENCIES.map((f) => (
                          <form key={f} action={setLaneFrequency.bind(null, a.id, f)} className="flex-1">
                            <button
                              type="submit"
                              aria-pressed={a.frequency === f}
                              className={cn(
                                "min-h-10 w-full rounded-lg px-2 text-xs font-bold transition-colors",
                                a.frequency === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {FREQUENCY_LABELS[f]}
                            </button>
                          </form>
                        ))}
                      </div>
                    </div>
                    <p
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold",
                        hasCard ? "bg-sea-soft text-sea-ink" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <FileText className="h-4 w-4 shrink-0" aria-hidden />
                      {hasCard ? `Quotes fill in from your ${shortName(d.name)} rate card` : `No rate card for ${shortName(d.name)} yet`}
                    </p>
                    <form action={deleteLaneAlert.bind(null, a.id)} className="mt-auto">
                      <button
                        type="submit"
                        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-destructive"
                        aria-label={`Remove the lane ${originLabel} to ${shortName(d.name)}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        Remove
                      </button>
                    </form>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
        <AddLaneForm ports={(ports ?? []) as PortOption[]} />
      </section>

      <section aria-labelledby="cards-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="cards-heading" className="text-lg font-semibold tracking-tight">
              Rate cards
            </h2>
            <p className="text-sm text-muted-foreground">Your destination prices. Private to your company. Nothing is sent without you.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/lanes/rate-cards/new"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" aria-hidden />
              New rate card
            </Link>
            <Link
              href="/lanes/rate-cards/upload"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-input bg-card px-4 text-sm font-semibold"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden />
              Upload a sheet
            </Link>
          </div>
        </div>
        {cards.length === 0 ? (
          <EmptyState title="No rate cards yet" body="Add your port charges and cartage prices once, and every matching job opens with the quote already filled in." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 [&>li]:min-w-0">
            {cards.map((c) => {
              const port = one(c.port);
              const expired = c.valid_to < today;
              const expiring = !expired && c.valid_to <= soon;
              return (
                <li key={c.id}>
                  <Card className="flex h-full flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{c.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {port ? shortName(port.name) : "Port"} · {c.currency} · {c.charges?.[0]?.count ?? 0} lines
                        </p>
                      </div>
                      {expired ? <Badge tone="danger">Expired</Badge> : expiring ? <Badge tone="warning">Expires soon</Badge> : <Badge tone="success">Active</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">Valid to {formatDate(c.valid_to)}</p>
                    <Link href={`/lanes/rate-cards/${c.id}`} className="mt-auto inline-flex min-h-11 items-center gap-2 text-sm font-bold text-accent">
                      <Pencil className="h-4 w-4" aria-hidden />
                      Edit
                    </Link>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 text-sm shadow-card">
        <p className="flex items-center gap-2 font-bold">
          <Bell className="h-4 w-4 text-sea" aria-hidden />
          How alerts work
        </p>
        <p className="mt-2 text-muted-foreground">
          Instant alerts email you as each matching job is posted. The daily summary is one email at 7am Sydney time. Emails show public job
          details only and never any quote, and the link opens the job with your rate card already applied.
        </p>
      </section>
    </div>
  );
}
