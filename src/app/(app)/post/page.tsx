import Link from "next/link";
import { Copy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { PostJobForm, type JobDefaults } from "./post-job-form";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Request a quote" };

export default async function PostPage({ searchParams }: { searchParams: Promise<{ repeat?: string }> }) {
  const t = await getT();
  const me = await requireMember();
  const { repeat } = await searchParams;
  const supabase = await createClient();
  const { data: ports } = await supabase
    .from("ports")
    .select("id, code, name, country")
    .order("country")
    .order("name");

  // The company's most recent job, used by "Repeat last job".
  const { data: last } = await supabase
    .from("jobs")
    .select(
      "direction, incoterm, mode, origin_port_id, destination_port_id, container_type, container_qty, weight_kg, volume_cbm, cargo_description, services, flag_dg, flag_reefer, flag_bmsb, notes, delivery_suburb, delivery_postcode, unload_type, repeat_frequency, repeat_volume",
    )
    .eq("company_id", me.company.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const defaults: JobDefaults | undefined =
    repeat === "1" && last
      ? {
          direction: last.direction,
          incoterm: last.incoterm,
          mode: last.mode,
          originPortId: last.origin_port_id,
          destinationPortId: last.destination_port_id,
          containerType: last.container_type,
          containerQty: last.container_qty,
          weightKg: last.weight_kg,
          volumeCbm: last.volume_cbm,
          cargoDescription: last.cargo_description,
          services: last.services ?? [],
          flagDg: last.flag_dg,
          flagReefer: last.flag_reefer,
          flagBmsb: last.flag_bmsb,
          notes: last.notes,
          deliverySuburb: last.delivery_suburb,
          deliveryPostcode: last.delivery_postcode,
          unloadType: last.unload_type,
          repeatFrequency: last.repeat_frequency ?? "one_off",
          repeatVolume: last.repeat_volume,
        }
      : undefined;

  // Admins may post on behalf of any active company.
  let companies: { id: string; name: string }[] | undefined;
  if (me.is_admin) {
    const { data } = await supabase
      .from("companies")
      .select("id, name")
      .eq("status", "active")
      .eq("role", "agent")
      .order("name");
    companies = data ?? [];
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <p className="text-sm font-semibold text-accent">{t("Requester mode")}</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("Request a quote")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("About 30 seconds. Verified forwarders see it on their board and send sealed quotes only you can read.")}
        </p>
      </div>
      {me.company.status === "suspended" ? (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {t("Your company is suspended and cannot request quotes.")}
        </p>
      ) : (
        <>
          {last && !defaults ? (
            <Link
              href="/post?repeat=1"
              className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-4 text-sm font-semibold shadow-card"
            >
              <Copy className="h-5 w-5 text-sea" aria-hidden />
              {t("Repeat last job")}
            </Link>
          ) : null}
          {defaults ? (
            <p role="status" className="rounded-xl bg-sea-soft p-3 text-sm text-sea-ink">
              {t("Filled in from your last job. Set a new ready date before posting.")}
            </p>
          ) : null}
          <PostJobForm key={defaults ? "repeat" : "new"} ports={ports ?? []} defaults={defaults} companies={companies} />
        </>
      )}
    </div>
  );
}
