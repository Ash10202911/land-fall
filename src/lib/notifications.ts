import "server-only";
import { appUrl } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { parseLocale, type Locale } from "@/lib/i18n";
import {
  planAwardEmails,
  planCancelEmails,
  planNewQuoteEmails,
  planQuestionAnsweredEmail,
  planQuestionAskedEmail,
} from "@/lib/notification-plan";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type One<T> = T | T[] | null;
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** The person's own language, from their profile. English when unknown. */
const langOf = (author: One<{ email: string; language?: string | null }>): Locale | undefined =>
  parseLocale(first(author)?.language) ?? undefined;

async function loadRoute(admin: Admin, jobId: string) {
  const { data } = await admin
    .from("jobs")
    .select(
      "id, created_by, company:companies(name), origin:ports!origin_port_id(name), destination:ports!destination_port_id(name), requester:profiles!created_by(email, language)",
    )
    .eq("id", jobId)
    .single();
  if (!data) return null;
  const row = data as unknown as {
    created_by: string;
    company: One<{ name: string }>;
    origin: One<{ name: string }>;
    destination: One<{ name: string }>;
    requester: One<{ email: string; language: string | null }>;
  };
  return {
    route: `${first(row.origin)?.name ?? "Origin"} to ${first(row.destination)?.name ?? "Destination"}`,
    requesterCompany: first(row.company)?.name ?? "The requester",
    requesterEmail: first(row.requester)?.email ?? null,
    requesterLanguage: langOf(row.requester),
  };
}

/**
 * Email notifications. These never throw: a failed email must not fail the quote or the award.
 * Each email is written in the language its recipient chose.
 */
export async function notifyNewQuote(args: { jobId: string; quoteId: string }): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const job = await loadRoute(admin, args.jobId);
    if (!job?.requesterEmail) return;
    const { data } = await admin
      .from("quotes")
      .select("company_id, company:companies(name)")
      .eq("id", args.quoteId)
      .single();
    const row = data as unknown as { company_id: string; company: One<{ name: string }> } | null;
    if (!row) return;

    // Debounce: a company that withdraws and resubmits must not email the requester again each time.
    const { count } = await admin
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("job_id", args.jobId)
      .eq("company_id", row.company_id);
    if ((count ?? 0) > 1) return;

    const quoterCompany = first(row.company)?.name ?? "A forwarder";

    const emails = planNewQuoteEmails({
      baseUrl: appUrl(),
      jobId: args.jobId,
      route: job.route,
      requester: { email: job.requesterEmail, company: job.requesterCompany, language: job.requesterLanguage },
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
      .select("id, status, company:companies(name), author:profiles!created_by(email, language)")
      .eq("job_id", args.jobId)
      .in("status", ["won", "lost"]);
    const rows = (data ?? []) as unknown as {
      id: string;
      status: "won" | "lost";
      company: One<{ name: string }>;
      author: One<{ email: string; language: string | null }>;
    }[];

    const toPerson = (r: (typeof rows)[number]) => ({
      email: first(r.author)?.email ?? "",
      company: first(r.company)?.name ?? "",
      language: langOf(r.author),
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
      requesterCompany: job.requesterCompany,
      winner,
      losers: losers.filter((l) => l.email),
    });
    await Promise.all(emails.map((m) => sendEmail(m)));
  } catch {
    console.error("[notifications] award emails failed");
  }
}

/** Tells every company that had a live quote that the requester cancelled the job. Never throws. */
export async function notifyJobCancelled(args: { jobId: string }): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const job = await loadRoute(admin, args.jobId);
    if (!job) return;
    const { data: jobRow } = await admin.from("jobs").select("status").eq("id", args.jobId).single();
    if (jobRow?.status !== "cancelled") return;

    const { data } = await admin
      .from("quotes")
      .select("company:companies(name), author:profiles!created_by(email, language)")
      .eq("job_id", args.jobId)
      .eq("status", "lost");
    const rows = (data ?? []) as unknown as {
      company: One<{ name: string }>;
      author: One<{ email: string; language: string | null }>;
    }[];
    const quoters = rows.map((r) => ({
      email: first(r.author)?.email ?? "",
      company: first(r.company)?.name ?? "",
      language: langOf(r.author),
    }));

    const emails = planCancelEmails({
      baseUrl: appUrl(),
      jobId: args.jobId,
      route: job.route,
      requesterCompany: job.requesterCompany,
      quoters,
    });
    await Promise.all(emails.map((m) => sendEmail(m)));
  } catch {
    console.error("[notifications] cancel emails failed");
  }
}

/** Tells the requester a question was asked. The asker is not named. Never throws. */
export async function notifyQuestionAsked(args: { jobId: string; questionId: string }): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const job = await loadRoute(admin, args.jobId);
    if (!job?.requesterEmail) return;
    const { data } = await admin.from("job_questions").select("question").eq("id", args.questionId).single();
    if (!data) return;
    await sendEmail(
      planQuestionAskedEmail({
        baseUrl: appUrl(),
        jobId: args.jobId,
        route: job.route,
        requester: { email: job.requesterEmail, company: job.requesterCompany, language: job.requesterLanguage },
        question: data.question as string,
      }),
    );
  } catch {
    console.error("[notifications] question email failed");
  }
}

/** Tells the person who asked that the requester answered. Never throws. */
export async function notifyQuestionAnswered(args: { jobId: string; questionId: string }): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const job = await loadRoute(admin, args.jobId);
    if (!job) return;
    const { data } = await admin
      .from("job_questions")
      .select("question, answer, author:job_question_authors(asker:profiles!created_by(email, language), company:companies(name))")
      .eq("id", args.questionId)
      .single();
    const row = data as unknown as {
      question: string;
      answer: string | null;
      author: One<{ asker: One<{ email: string; language: string | null }>; company: One<{ name: string }> }>;
    } | null;
    const author = first(row?.author ?? null);
    const asker = first(author?.asker ?? null);
    if (!row?.answer || !asker?.email) return;
    await sendEmail(
      planQuestionAnsweredEmail({
        baseUrl: appUrl(),
        jobId: args.jobId,
        route: job.route,
        asker: { email: asker.email, company: first(author?.company ?? null)?.name ?? "", language: langOf(asker) },
        question: row.question,
        answer: row.answer,
      }),
    );
  } catch {
    console.error("[notifications] answer email failed");
  }
}
