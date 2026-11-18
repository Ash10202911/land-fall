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

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("id, name, country, role, trust_level, status, created_at")
    .order("created_at", { ascending: false });
  const companies = (data ?? []) as CompanyRow[];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Admin: companies</h1>
      <p className="text-sm text-muted-foreground">
        Verify companies so they can award jobs. Suspended companies cannot post, quote or award.
      </p>

      {companies.length === 0 ? (
        <EmptyState title="No companies yet" />
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
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
