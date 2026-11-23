import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChargeRow, RateCard } from "@/lib/rate-cards";

type Raw = {
  id: string;
  name: string;
  currency: string;
  valid_to: string;
  updated_at: string;
  port: { code: string } | { code: string }[] | null;
  charges: ChargeRow[] | null;
};

const SELECT =
  "id, name, currency, valid_to, updated_at, port:ports!destination_port_id(code), charges:rate_card_charges(position, kind, name, category, basis, amount_minor, gst_included, postcode_from, postcode_to, unload_type)";

/**
 * A company's rate cards with their rows. With the signed-in user's client, Row Level Security
 * returns only that company's cards; with the service role (alert emails) pass the company id.
 */
export async function loadRateCards(client: SupabaseClient, companyId: string, destinationCode?: string): Promise<RateCard[]> {
  const { data } = await client.from("rate_cards").select(SELECT).eq("company_id", companyId).order("updated_at", { ascending: false });
  return ((data ?? []) as unknown as Raw[])
    .map((r) => ({
      id: r.id,
      name: r.name,
      currency: r.currency,
      valid_to: r.valid_to,
      updated_at: r.updated_at,
      destination_code: (Array.isArray(r.port) ? r.port[0]?.code : r.port?.code) ?? "",
      charges: r.charges ?? [],
    }))
    .filter((c) => !destinationCode || c.destination_code === destinationCode);
}
