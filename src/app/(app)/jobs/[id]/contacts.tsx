import { Mail, MapPin, Phone, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { BANK_WARNING } from "@/lib/domain";

// The database function returns 'poster' for the requester; the interface calls them the Requester.
type Contact = { party: "poster" | "winner"; company_name: string; full_name: string; email: string; phone: string | null };

/**
 * Shows both parties' contact details, and the delivery street address, after an award. The database
 * returns them only to the requester and the winner (SEC-2), so this renders nothing for anyone else.
 */
export async function AwardContacts({ jobId, suburb }: { jobId: string; suburb?: string | null }) {
  const supabase = await createClient();
  const [{ data }, { data: address }] = await Promise.all([
    supabase.rpc("get_award_contacts", { p_job_id: jobId }),
    supabase.from("job_delivery_addresses").select("street").eq("job_id", jobId).maybeSingle(),
  ]);
  const contacts = (data ?? []) as Contact[];
  if (contacts.length === 0) return null;

  return (
    <section aria-labelledby="contacts-heading" className="space-y-3">
      <h2 id="contacts-heading" className="font-semibold">
        Contact details
      </h2>
      <div
        role="note"
        className="flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-foreground"
      >
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
        <p>{BANK_WARNING}</p>
      </div>
      {address?.street ? (
        <Card className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Delivery address</p>
            <p className="font-semibold">
              {address.street}
              {suburb ? `, ${suburb}` : ""}
            </p>
          </div>
        </Card>
      ) : null}
      {contacts.map((c) => (
        <Card key={c.party} className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {c.party === "poster" ? "Requester" : "Winning forwarder"}
          </p>
          <p className="font-semibold">{c.company_name}</p>
          <p className="text-sm">{c.full_name}</p>
          <p className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
            <a className="min-h-6 text-accent underline" href={`mailto:${c.email}`}>
              {c.email}
            </a>
          </p>
          <p className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" aria-hidden />
            {c.phone ? (
              <a className="min-h-6 text-accent underline" href={`tel:${c.phone.replace(/\s+/g, "")}`}>
                {c.phone}
              </a>
            ) : (
              <span className="text-muted-foreground">No phone number provided</span>
            )}
          </p>
        </Card>
      ))}
    </section>
  );
}
