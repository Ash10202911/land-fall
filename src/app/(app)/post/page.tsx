import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { PostJobForm } from "./post-job-form";

export const metadata = { title: "Post a job" };

export default async function PostPage() {
  const me = await requireMember();
  const supabase = await createClient();
  const { data: ports } = await supabase
    .from("ports")
    .select("id, code, name, country")
    .order("country")
    .order("name");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Post a job</h1>
      {me.company.status === "suspended" ? (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Your company is suspended and cannot post jobs.
        </p>
      ) : (
        <PostJobForm ports={ports ?? []} />
      )}
    </div>
  );
}
