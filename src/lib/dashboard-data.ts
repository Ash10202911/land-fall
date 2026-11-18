import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { BoardJob, MarketplaceStats, MyJob, MyQuote } from "@/lib/dashboard";

const DAY = 86_400_000;
const PORTS = "origin:ports!origin_port_id(code, name), destination:ports!destination_port_id(code, name)";

const one = <T,>(v: T | T[] | null): T => (Array.isArray(v) ? v[0] : (v as T));

/**
 * Everything the dashboard reads goes through the signed-in user's own session, so Row Level
 * Security decides what comes back: my jobs and the quotes on them, my own quotes, and the public job
 * board. Other companies' quotes are never requested and could not be returned.
 */
export async function loadDashboardData(companyId: string, now: Date) {
  const supabase = await createClient();
  const since90 = new Date(now.getTime() - 90 * DAY).toISOString();
  const since60 = new Date(now.getTime() - 60 * DAY).toISOString();

  const [jobsRes, quotesRes, boardRes] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        `id, status, deadline_at, created_at, mode, ${PORTS},
         quotes:quotes!job_id(id, status, created_at, lines:quote_lines(amount_minor, currency))`,
      )
      .eq("company_id", companyId)
      .gte("created_at", since90)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("quotes")
      .select(
        `id, job_id, status, created_at, valid_until, lines:quote_lines(amount_minor, currency),
         job:jobs!job_id(status, deadline_at, created_at, mode, ${PORTS})`,
      )
      .eq("company_id", companyId)
      .gte("created_at", since90)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("jobs")
      .select(`id, company_id, status, deadline_at, created_at, mode, flag_dg, flag_reefer, flag_bmsb, ${PORTS}`)
      .gte("created_at", since60)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const myJobs = ((jobsRes.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    ...r,
    origin: one(r.origin as never),
    destination: one(r.destination as never),
  })) as unknown as MyJob[];

  const myQuotes = ((quotesRes.data ?? []) as unknown as Record<string, unknown>[]).map((r) => {
    const job = one(r.job as never) as Record<string, unknown> | null;
    return {
      ...r,
      job: job ? { ...job, origin: one(job.origin as never), destination: one(job.destination as never) } : null,
    };
  }) as unknown as MyQuote[];

  const board = ((boardRes.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    ...r,
    origin: one(r.origin as never),
    destination: one(r.destination as never),
  })) as unknown as BoardJob[];

  return { myJobs, myQuotes, board, failed: Boolean(jobsRes.error || quotesRes.error || boardRes.error) };
}

export type VerificationQueueRow = {
  company_id: string;
  company_name: string;
  company_country: string;
  company_role: "agent" | "forwarder";
  joined_at: string;
  awaiting_jobs: number;
  waiting_quotes: number;
};

/** Admin-only counts from security definer functions. They return no quote contents. */
export async function loadAdminData(days = 30) {
  const supabase = await createClient();
  const [stats, queue] = await Promise.all([
    supabase.rpc("admin_marketplace_stats", { p_days: days }),
    supabase.rpc("admin_verification_queue"),
  ]);
  return {
    stats: (stats.data ?? null) as MarketplaceStats | null,
    queue: (queue.data ?? []) as VerificationQueueRow[],
    failed: Boolean(stats.error || queue.error),
  };
}
