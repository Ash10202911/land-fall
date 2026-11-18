import Link from "next/link";
import { Copy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { PostJobForm, type JobDefaults } from "./post-job-form";

export const metadata = { title: "Post a job" };

export default async function PostPage({ searchParams }: { searchParams: Promise<{ repeat?: string }> }) {
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
      "direction, incoterm, mode, origin_port_id, destination_port_id, container_type, container_qty, weight_kg, volume_cbm, cargo_description, services, flag_dg, flag_reefer, flag_bmsb, notes",
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
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Post a job</h1>
      {me.company.status === "suspended" ? (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Your company is suspended and cannot post jobs.
        </p>
      ) : (
        <>
          {last && !defaults ? (
            <Link
              href="/post?repeat=1"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium"
            >
              <Copy className="h-4 w-4" aria-hidden />
              Repeat last job
            </Link>
          ) : null}
          {defaults ? (
            <p role="status" className="rounded-md bg-muted p-3 text-sm">
              Filled in from your last job. Set a new ready date and quote deadline before posting.
            </p>
          ) : null}
          <PostJobForm key={defaults ? "repeat" : "new"} ports={ports ?? []} defaults={defaults} companies={companies} />
        </>
      )}
    </div>
  );
}
