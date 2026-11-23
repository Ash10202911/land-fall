import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PortOption } from "../../add-lane-form";
import { UploadForm } from "./upload-form";

export const metadata = { title: "Upload a rate card" };

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export default async function UploadRateCardPage() {
  const me = await requireMember();
  const supabase = await createClient();
  const { data: ports } = await supabase.from("ports").select("id, code, name, country").order("country").order("name");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <Link href="/lanes" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        My lanes
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Upload a rate card</h1>
        <p className="mt-1 text-sm text-muted-foreground">Already keep your prices in Excel? Fill in our template, save it as CSV and upload it here.</p>
      </div>

      <ol className="space-y-2 rounded-2xl border border-border bg-sea-soft p-4 text-sm">
        <li>
          <strong>1.</strong> Download the template and replace the example rows with your own.
        </li>
        <li>
          <strong>2.</strong> In Excel choose File, Save As, then <em>CSV</em>.
        </li>
        <li>
          <strong>3.</strong> Fill in the form below and upload the file. If a row has a mistake, nothing is saved and we tell you which row.
        </li>
        <li className="pt-1">
          <a
            href="/lanes/rate-cards/template"
            download
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground"
          >
            <Download className="h-4 w-4" aria-hidden />
            Download the template
          </a>
        </li>
      </ol>

      <details className="rounded-2xl border border-border bg-card p-4 text-sm">
        <summary className="min-h-11 cursor-pointer font-semibold">What the columns mean</summary>
        <dl className="mt-2 space-y-1.5 text-muted-foreground">
          <div><dt className="inline font-semibold text-foreground">type</dt>: <dd className="inline">charge, or zone for cartage by postcode.</dd></div>
          <div><dt className="inline font-semibold text-foreground">category</dt>: <dd className="inline">destination, customs or delivery. A zone is always delivery.</dd></div>
          <div><dt className="inline font-semibold text-foreground">basis</dt>: <dd className="inline">per_job, per_container, per_20ft, per_40ft, per_cbm or per_kg.</dd></div>
          <div><dt className="inline font-semibold text-foreground">amount</dt>: <dd className="inline">for example 165.00. Use a full stop for cents.</dd></div>
          <div><dt className="inline font-semibold text-foreground">gst_included</dt>: <dd className="inline">yes or no. Blank means yes.</dd></div>
          <div><dt className="inline font-semibold text-foreground">from_postcode, to_postcode</dt>: <dd className="inline">zones only.</dd></div>
          <div><dt className="inline font-semibold text-foreground">unload_type</dt>: <dd className="inline">forklift, tailgate, side_loader, dock or customer_unpacks. The charge only applies when the job unloads that way.</dd></div>
        </dl>
      </details>

      <UploadForm ports={(ports ?? []) as PortOption[]} defaultCurrency={me.company.country === "New Zealand" ? "NZD" : "AUD"} minDate={inDays(0)} defaultValidTo={inDays(90)} />
    </div>
  );
}
