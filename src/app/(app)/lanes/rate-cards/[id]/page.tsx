import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ConfirmDelete } from "../confirm-delete";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteRateCard } from "../../actions";
import type { PortOption } from "../../add-lane-form";
import { RateCardForm, type CardDraft, type RowDraft } from "../rate-card-form";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Rate card" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function inDays(n: number) {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

export default async function RateCardPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !UUID.test(id)) notFound();
  const me = await requireMember();
  const supabase = await createClient();
  const { data: ports } = await supabase.from("ports").select("id, code, name, country").order("country").order("name");

  let initial: CardDraft = { name: "", destinationPortId: "", currency: me.company.country === "New Zealand" ? "NZD" : "AUD", validTo: inDays(90), rows: [] };
  if (!isNew) {
    // Row Level Security returns the card only to the company that owns it.
    const { data: card } = await supabase
      .from("rate_cards")
      .select("id, name, destination_port_id, currency, valid_to, charges:rate_card_charges(position, kind, name, category, basis, amount_minor, gst_included, postcode_from, postcode_to, unload_type)")
      .eq("id", id)
      .eq("company_id", me.company.id)
      .maybeSingle();
    if (!card) notFound();
    const rows = (card.charges ?? []) as unknown as {
      position: number; kind: "charge" | "zone"; name: string; category: string; basis: string; amount_minor: number | string;
      gst_included: boolean; postcode_from: number | null; postcode_to: number | null; unload_type: string | null;
    }[];
    initial = {
      id: card.id,
      name: card.name,
      destinationPortId: String(card.destination_port_id),
      currency: card.currency,
      validTo: card.valid_to,
      rows: rows
        .sort((a, b) => a.position - b.position)
        .map<RowDraft>((r) => ({
          kind: r.kind,
          name: r.name,
          category: r.category,
          basis: r.basis,
          amount: (Number(r.amount_minor) / 100).toFixed(2),
          gstIncluded: r.gst_included,
          postcodeFrom: r.postcode_from === null ? "" : String(r.postcode_from).padStart(4, "0"),
          postcodeTo: r.postcode_to === null ? "" : String(r.postcode_to).padStart(4, "0"),
          unloadType: r.unload_type ?? "",
        })),
    };
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <Link href="/lanes" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("My lanes")}
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{isNew ? t("New rate card") : t("Edit rate card")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("Private to {name}. When a job arrives for this port, its quote opens already filled in. You check it and tap Send.", { name: me.company.name })}
        </p>
      </div>
      <RateCardForm key={initial.id ?? "new"} ports={(ports ?? []) as PortOption[]} initial={initial} minDate={inDays(0)} />
      {!isNew ? (
        <div className="border-t border-border pt-4">
          <ConfirmDelete action={deleteRateCard.bind(null, id)} />
        </div>
      ) : null}
    </div>
  );
}
