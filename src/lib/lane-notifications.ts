import "server-only";
import { appUrl } from "@/lib/env";
import { parseLocale } from "@/lib/i18n";
import { formatMoney } from "@/lib/domain";
import { sendEmail } from "@/lib/email";
import { planDigest, planInstantAlert, planRun, toBrief, type AlertWithRecipient, type RunEmail, type RunJob } from "@/lib/lane-alerts";
import { loadRateCards } from "@/lib/rate-card-data";
import { buildQuoteFromRateCard, pickRateCard, type QuoteJob } from "@/lib/rate-cards";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type One<T> = T | T[] | null;
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

const JOB_COLUMNS =
  "id, company_id, status, extensions, mode, incoterm, services, container_type, container_qty, weight_kg, volume_cbm, deadline_at, delivery_suburb, delivery_postcode, unload_type, repeat_frequency, repeat_volume, origin_port_id, destination_port_id, origin:ports!origin_port_id(code, name, country), destination:ports!destination_port_id(code, name, country)";

type PortRef = { code: string; name: string; country: string };
type JobRaw = Omit<RunJob, "origin_country" | "origin_name" | "destination_name"> & {
  status: string;
  extensions: number;
  origin: One<PortRef>;
  destination: One<PortRef>;
};

function toRunJob(row: JobRaw): RunJob {
  const o = first(row.origin);
  const d = first(row.destination);
  return { ...row, origin_country: o?.country ?? "", origin_name: o?.name ?? "Origin", destination_name: d?.name ?? "Destination" };
}

type AlertRaw = Omit<AlertWithRecipient, "recipient"> & { company: One<{ status: string }>; author: One<{ email: string; language: string | null }> };

/** Alerts for active companies, with the email of the person who created each one. */
async function loadAlerts(admin: Admin, frequency: "instant" | "daily", destinationPortId?: number): Promise<AlertWithRecipient[]> {
  let query = admin
    .from("lane_alerts")
    .select("id, company_id, created_by, origin_port_id, origin_country, destination_port_id, modes, destination_only, frequency, company:companies(status), author:profiles!created_by(email, language)")
    .eq("frequency", frequency);
  if (destinationPortId !== undefined) query = query.eq("destination_port_id", destinationPortId);
  const { data } = await query;
  return ((data ?? []) as unknown as AlertRaw[])
    .filter((a) => first(a.company)?.status === "active")
    .map((a) => ({
      id: a.id,
      company_id: a.company_id,
      created_by: a.created_by,
      origin_port_id: a.origin_port_id,
      origin_country: a.origin_country,
      destination_port_id: a.destination_port_id,
      modes: a.modes,
      destination_only: a.destination_only,
      frequency: a.frequency,
      recipient: first(a.author)?.email ?? "",
      language: parseLocale(first(a.author)?.language) ?? undefined,
    }));
}

async function loadDelivered(admin: Admin, alerts: AlertWithRecipient[], jobIds: string[], round = 0): Promise<Set<string>> {
  if (alerts.length === 0 || jobIds.length === 0) return new Set();
  const { data } = await admin
    .from("lane_alert_deliveries")
    .select("alert_id, job_id")
    .in("alert_id", alerts.map((a) => a.id))
    .in("job_id", jobIds)
    .eq("round", round);
  return new Set((data ?? []).map((r) => `${r.alert_id}:${r.job_id}`));
}

/**
 * Records that these alerts are being emailed about these jobs. Only rows newly inserted count, so two
 * runs at once never send the same alert twice. Returns the pairs this run now owns.
 */
async function claim(admin: Admin, pairs: RunEmail["pairs"], round = 0) {
  const { data } = await admin
    .from("lane_alert_deliveries")
    .upsert(pairs.map((p) => ({ alert_id: p.alertId, job_id: p.jobId, round })), { onConflict: "alert_id,job_id,round", ignoreDuplicates: true })
    .select("alert_id, job_id");
  const owned = new Set((data ?? []).map((r) => `${r.alert_id}:${r.job_id}`));
  return pairs.filter((p) => owned.has(`${p.alertId}:${p.jobId}`));
}

/** If sending failed, give the claim back so a later run can try again. */
async function release(admin: Admin, pairs: RunEmail["pairs"], round = 0) {
  for (const p of pairs) await admin.from("lane_alert_deliveries").delete().eq("alert_id", p.alertId).eq("job_id", p.jobId).eq("round", round);
}

/**
 * Emails every company with an instant lane alert that matches a newly posted job. Never throws: a failed
 * email must not fail posting the job. Emails carry public job details only, never any quote.
 */
export async function notifyLaneAlertsForJob(jobId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const { data } = await admin.from("jobs").select(JOB_COLUMNS).eq("id", jobId).single();
    if (!data) return;
    const raw = data as unknown as JobRaw;
    if (raw.status !== "open") return;
    const job = toRunJob(raw);
    const destCode = first(raw.destination)?.code ?? "";

    const alerts = await loadAlerts(admin, "instant", job.destination_port_id);
    const delivered = await loadDelivered(admin, alerts, [job.id]);
    const runs = planRun({ alerts, jobs: [job], delivered, frequency: "instant" });

    for (const run of runs) {
      const owned = await claim(admin, run.pairs);
      if (owned.length === 0) continue;

      // If this company has a rate card for the port, say what it would quote.
      let rateCard: { name: string; total: string } | null = null;
      const cards = await loadRateCards(admin, run.companyId, destCode);
      const card = pickRateCard(cards, destCode, new Date().toISOString().slice(0, 10));
      if (card) {
        // The database only allows FCL, LCL or Air here.
        const built = buildQuoteFromRateCard(card, { ...job, mode: job.mode as QuoteJob["mode"], destination_code: destCode });
        if (built.lines.length > 0) rateCard = { name: card.name, total: formatMoney(built.totalMinor, card.currency) };
      }

      const result = await sendEmail(planInstantAlert({ baseUrl: appUrl(), to: run.to, job: toBrief(job), rateCard, language: run.language }));
      if (!result.ok) await release(admin, owned);
    }
  } catch {
    console.error("[lane-alerts] instant alert emails failed");
  }
}

/**
 * After a requester extends a job that has no quotes, tells the lanes again: once per extension. Instant
 * lanes always hear; a daily lane hears only if it was already told about the job, so nobody gets the
 * extension and then the same job again in the summary. Never throws.
 */
export async function notifyLaneAlertsForExtension(jobId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const { data } = await admin.from("jobs").select(JOB_COLUMNS).eq("id", jobId).single();
    if (!data) return;
    const raw = data as unknown as JobRaw;
    const round = Number(raw.extensions ?? 0);
    if (raw.status !== "open" || round < 1) return;
    const job = toRunJob(raw);
    const destCode = first(raw.destination)?.code ?? "";

    const all = [...(await loadAlerts(admin, "instant", job.destination_port_id)), ...(await loadAlerts(admin, "daily", job.destination_port_id))];
    const toldBefore = await loadDelivered(admin, all, [job.id], 0);
    // Plan every eligible alert as instant: one email per person, once per extension.
    const eligible = all.filter((a) => a.frequency === "instant" || toldBefore.has(`${a.id}:${job.id}`)).map((a) => ({ ...a, frequency: "instant" as const }));
    const delivered = await loadDelivered(admin, eligible, [job.id], round);
    const runs = planRun({ alerts: eligible, jobs: [job], delivered, frequency: "instant" });

    for (const run of runs) {
      const owned = await claim(admin, run.pairs, round);
      if (owned.length === 0) continue;
      const result = await sendEmail(planInstantAlert({ baseUrl: appUrl(), to: run.to, job: toBrief(job), extended: true, language: run.language }));
      if (!result.ok) await release(admin, owned, round);
    }
  } catch {
    console.error("[lane-alerts] extension emails failed");
  }
}

/**
 * The daily summary: one email per person listing the jobs posted in the last 3 days on their daily lanes
 * that they have not been told about. Safe to run more than once: nothing is ever sent twice.
 */
export async function sendLaneDigest(now = new Date()): Promise<{ people: number; jobs: number }> {
  const totals = { people: 0, jobs: 0 };
  try {
    const admin = createAdminClient();
    if (!admin) return totals;
    const alerts = await loadAlerts(admin, "daily");
    if (alerts.length === 0) return totals;

    const since = new Date(now.getTime() - 3 * 86_400_000).toISOString();
    const { data } = await admin
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("status", "open")
      .gt("deadline_at", now.toISOString())
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    const jobs = ((data ?? []) as unknown as JobRaw[]).map(toRunJob);
    if (jobs.length === 0) return totals;

    const delivered = await loadDelivered(admin, alerts, jobs.map((j) => j.id));
    for (const run of planRun({ alerts, jobs, delivered, frequency: "daily" })) {
      const owned = await claim(admin, run.pairs);
      if (owned.length === 0) continue;
      const ownedJobIds = new Set(owned.map((p) => p.jobId));
      const sendJobs = run.jobs.filter((j) => ownedJobIds.has(j.id));
      const result = await sendEmail(planDigest({ baseUrl: appUrl(), to: run.to, jobs: sendJobs.map(toBrief), language: run.language }));
      if (result.ok) {
        totals.people += 1;
        totals.jobs += sendJobs.length;
      } else {
        await release(admin, owned);
      }
    }
  } catch {
    console.error("[lane-alerts] daily summary failed");
  }
  return totals;
}
