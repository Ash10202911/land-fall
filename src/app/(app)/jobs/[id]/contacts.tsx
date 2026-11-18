import { Mail, Phone, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { BANK_WARNING } from "@/lib/domain";

type Contact = { party: "poster" | "winner"; company_name: string; full_name: string; email: string; phone: string | null };

/**
 * Shows both parties' contact details after an award. The database function returns rows only
 * to the poster and the winner (SEC-2), so this renders nothing for anyone else.
 */
export async function AwardContacts({ jobId }: { jobId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_award_contacts", { p_job_id: jobId });
  const contacts = (data ?? []) as Contact[];
  if (contacts.length === 0) return null;

  return (
    <section aria-labelledby="contacts-heading" className="space-y-3">
      <h2 id="contacts-heading" className="font-semibold">
        Contact details
      </h2>
      <div
        role="note"
        className="flex gap-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-foreground"
      >
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
        <p>{BANK_WARNING}</p>
      </div>
      {contacts.map((c) => (
        <Card key={c.party} className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {c.party === "poster" ? "Job poster" : "Winning forwarder"}
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
