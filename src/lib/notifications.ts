import "server-only";
import { appUrl } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { planAwardEmails, planNewQuoteEmails } from "@/lib/notification-plan";
import { createAdminClient } from "@/lib/supabase/admin";

type One<T> = T | T[] | null;
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

async function loadRoute(admin: NonNullable<ReturnType<typeof createAdminClient>>, jobId: string) {
  const { data } = await admin
    .from("jobs")
    .select(
      "id, created_by, company:companies(name), origin:ports!origin_port_id(name), destination:ports!destination_port_id(name), poster:profiles!created_by(email)",
    )
    .eq("id", jobId)
    .single();
  if (!data) return null;
  const row = data as unknown as {
    created_by: string;
    company: One<{ name: string }>;
    origin: One<{ name: string }>;
    destination: One<{ name: string }>;
    poster: One<{ email: string }>;
  };
  return {
    route: `${first(row.origin)?.name ?? "Origin"} to ${first(row.destination)?.name ?? "Destination"}`,
    posterCompany: first(row.company)?.name ?? "The poster",
    posterEmail: first(row.poster)?.email ?? null,
  };
}

/**
 * Email notifications. These never throw: a failed email must not fail the quote or the award.
 */
export async function notifyNewQuote(args: { jobId: string; quoteId: string }): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const job = await loadRoute(admin, args.jobId);
    if (!job?.posterEmail) return;
    const { data } = await admin
      .from("quotes")
      .select("company:companies(name)")
      .eq("id", args.quoteId)
      .single();
    const quoterCompany = first((data as unknown as { company: One<{ name: string }> } | null)?.company ?? null)?.name ?? "A forwarder";

    const emails = planNewQuoteEmails({
      baseUrl: appUrl(),
      jobId: args.jobId,
      route: job.route,
      poster: { email: job.posterEmail, company: job.posterCompany },
      quoterCompany,
    });
    await Promise.all(emails.map((m) => sendEmail(m)));
  } catch {
    console.error("[notifications] new quote email failed");
  }
}

export async function notifyAward(args: { jobId: string; winningQuoteId: string }): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const job = await loadRoute(admin, args.jobId);
    if (!job) return;

    const { data } = await admin
      .from("quotes")
      .select("id, status, company:companies(name), author:profiles!created_by(email)")
      .eq("job_id", args.jobId)
      .in("status", ["won", "lost"]);
    const rows = (data ?? []) as unknown as {
      id: string;
      status: "won" | "lost";
      company: One<{ name: string }>;
      author: One<{ email: string }>;
    }[];

    const toPerson = (r: (typeof rows)[number]) => ({
      email: first(r.author)?.email ?? "",
      company: first(r.company)?.name ?? "",
    });
    const winnerRow = rows.find((r) => r.id === args.winningQuoteId && r.status === "won");
    if (!winnerRow) return;
    const winner = toPerson(winnerRow);
    const losers = rows.filter((r) => r.status === "lost").map(toPerson);
    if (!winner.email) return;

    const emails = planAwardEmails({
      baseUrl: appUrl(),
      jobId: args.jobId,
      route: job.route,
      posterCompany: job.posterCompany,
      winner,
      losers: losers.filter((l) => l.email),
    });
    await Promise.all(emails.map((m) => sendEmail(m)));
  } catch {
    console.error("[notifications] award emails failed");
  }
}
