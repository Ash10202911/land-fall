import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { isJobClosed } from "@/lib/domain";
import { EditJobForm } from "./edit-job-form";

export const metadata = { title: "Edit job" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const me = await requireMember();
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, company_id, cargo_description, ready_date, deadline_at, notes, status")
    .eq("id", id)
    .maybeSingle();
  if (!job || job.company_id !== me.company.id) notFound();

  const closed = isJobClosed(job);
  const { count } = await supabase
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .eq("job_id", id)
    .eq("status", "sent");
  const deadline = new Date(job.deadline_at).toISOString();

  return (
    <div className="space-y-4">
      <Link href={`/jobs/${id}`} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to job
      </Link>
      <h1 className="text-xl font-semibold">Edit job</h1>
      {closed ? (
        <p role="status" className="rounded-md bg-muted p-3 text-sm">
          This job is closed and can no longer be edited.
        </p>
      ) : (
        <EditJobForm
          jobId={id}
          currentDeadline={deadline}
          cargoLocked={(count ?? 0) > 0}
          defaults={{
            cargoDescription: job.cargo_description,
            readyDate: job.ready_date,
            deadlineDate: deadline.slice(0, 10),
            deadlineTime: deadline.slice(11, 16),
            notes: job.notes ?? "",
          }}
        />
      )}
    </div>
  );
}
