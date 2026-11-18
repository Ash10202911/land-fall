import { BadgeCheck, Ban, RotateCcw, ShieldOff } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/domain";
import { updateCompany } from "./actions";

export const metadata = { title: "Admin" };

type CompanyRow = {
  id: string;
  name: string;
  country: string;
  role: "agent" | "forwarder";
  trust_level: "basic" | "verified";
  status: "active" | "suspended";
  created_at: string;
};

type AuditRow = {
  id: number;
  field: "trust_level" | "status";
  old_value: string;
  new_value: string;
  created_at: string;
  company: { name: string } | { name: string }[] | null;
};

/** Strips characters that act as wildcards or separators in a PostgREST ilike filter. */
function cleanSearch(q: string | undefined): string {
  return (q ?? "").replace(/[%_,()*\\]/g, " ").trim().slice(0, 60);
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireAdmin();
  const { q } = await searchParams;
  const search = cleanSearch(q);
  const supabase = await createClient();

  let query = supabase
    .from("companies")
    .select("id, name, country, role, trust_level, status, created_at")
    .order("created_at", { ascending: false });
  if (search) query = query.ilike("name", `%${search}%`);
  const { data } = await query;
  const companies = (data ?? []) as CompanyRow[];

  const { data: auditData } = await supabase
    .from("admin_audit_log")
    .select("id, field, old_value, new_value, created_at, company:companies(name)")
    .order("created_at", { ascending: false })
    .limit(15);
  const audit = (auditData ?? []) as unknown as AuditRow[];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Admin: companies</h1>
      <p className="text-sm text-muted-foreground">
        Verify companies so they can award jobs. Suspended companies cannot post, quote or award.
      </p>

      <form role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Search companies
        </label>
        <input
          id="q"
          name="q"
          defaultValue={search}
          placeholder="Search by company name"
          className="block min-h-11 w-full rounded-md border border-input bg-card px-3 text-base"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {companies.length === 0 ? (
        <EmptyState title={search ? "No companies match that search" : "No companies yet"} />
      ) : (
        <ul className="space-y-3">
          {companies.map((c) => (
            <li key={c.id}>
              <Card className="space-y-3" data-testid={`company-${c.name}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.country} · {c.role === "agent" ? "Overseas agent" : "ANZ forwarder"} · joined{" "}
                      {formatDate(c.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {c.trust_level === "verified" ? (
                      <Badge tone="verified">Verified</Badge>
                    ) : (
                      <Badge tone="warning">Basic</Badge>
                    )}
                    {c.status === "suspended" ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Active</Badge>}
                  </div>
                </div>
                {c.id === me.company?.id ? (
                  <p className="text-sm text-muted-foreground">
                    This is your own company. Another admin, or the database, must change its trust level or status.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <form action={updateCompany}>
                      <input type="hidden" name="companyId" value={c.id} />
                      <input type="hidden" name="trustLevel" value={c.trust_level === "verified" ? "basic" : "verified"} />
                      <Button type="submit" variant="outline">
                        {c.trust_level === "verified" ? (
                          <>
                            <ShieldOff className="h-4 w-4" aria-hidden />
                            Set to Basic
                          </>
                        ) : (
                          <>
                            <BadgeCheck className="h-4 w-4" aria-hidden />
                            Verify
                          </>
                        )}
                      </Button>
                    </form>
                    <form action={updateCompany}>
                      <input type="hidden" name="companyId" value={c.id} />
                      <input type="hidden" name="status" value={c.status === "suspended" ? "active" : "suspended"} />
                      <Button type="submit" variant={c.status === "suspended" ? "outline" : "destructive"}>
                        {c.status === "suspended" ? (
                          <>
                            <RotateCcw className="h-4 w-4" aria-hidden />
                            Unsuspend
                          </>
                        ) : (
                          <>
                            <Ban className="h-4 w-4" aria-hidden />
                            Suspend
                          </>
                        )}
                      </Button>
                    </form>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="audit-heading" className="space-y-2">
        <h2 id="audit-heading" className="font-semibold">
          Recent changes
        </h2>
        {audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trust or status changes yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
            {audit.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5 p-3">
                <span className="font-medium">
                  {(Array.isArray(a.company) ? a.company[0] : a.company)?.name ?? "Unknown company"}
                </span>
                <span className="text-muted-foreground">
                  {a.field === "trust_level" ? "Trust level" : "Status"}: {a.old_value} to {a.new_value} on{" "}
                  {formatDate(a.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
