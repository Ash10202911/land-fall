import { formatDateTime, type SERVICES } from "@/lib/domain";
import type { EmailMessage } from "@/lib/email";
import { REPEAT_LABELS, UNLOAD_LABELS, scopeFor } from "@/lib/scope";

export const ALERT_FREQUENCIES = ["instant", "daily", "off"] as const;
export type AlertFrequency = (typeof ALERT_FREQUENCIES)[number];
export const FREQUENCY_LABELS: Record<AlertFrequency, string> = { instant: "Instantly", daily: "Daily 7am", off: "Off" };

export type AlertRow = {
  id: string;
  company_id: string;
  created_by: string;
  origin_port_id: number | null;
  origin_country: string | null;
  destination_port_id: number;
  modes: string[];
  destination_only: boolean;
  frequency: AlertFrequency;
};

/** The parts of a job an alert is matched against. */
export type MatchJob = {
  company_id: string;
  mode: string;
  incoterm: string;
  services: readonly (typeof SERVICES)[number][] | readonly string[];
  origin_port_id: number;
  origin_country: string;
  destination_port_id: number;
};

/**
 * Does this alert want this job? A company never gets an alert about its own jobs. An alert with no
 * origin matches any origin; one with no modes matches every mode.
 */
export function laneMatches(alert: AlertRow, job: MatchJob): boolean {
  if (alert.frequency === "off") return false;
  if (alert.company_id === job.company_id) return false;
  if (alert.destination_port_id !== job.destination_port_id) return false;
  if (alert.origin_port_id !== null) {
    if (alert.origin_port_id !== job.origin_port_id) return false;
  } else if (alert.origin_country) {
    if (alert.origin_country.trim().toLowerCase() !== job.origin_country.trim().toLowerCase()) return false;
  }
  if (alert.modes.length > 0 && !alert.modes.includes(job.mode)) return false;
  if (alert.destination_only && scopeFor(job.incoterm, job.services).summary !== "Destination only") return false;
  return true;
}

/** What an alert email says about one job. Public job details only: never a street address or any quote. */
export type JobBrief = {
  id: string;
  route: string;
  scope: string;
  incoterm: string;
  mode: string;
  size: string;
  deliverTo: string | null;
  unload: string | null;
  regular: string | null;
  deadlineAt: string;
};

export function briefLines(job: JobBrief): string[] {
  return [
    `${job.scope} · ${job.incoterm} · ${job.mode === "Air" ? "Air" : job.mode === "FCL" ? "Sea, full container" : "Sea, shared container"}`,
    job.size + (job.regular ? ` · ${job.regular}` : ""),
    job.deliverTo ? `Deliver to ${job.deliverTo}${job.unload ? ` (${job.unload})` : ""}` : "",
    `Quotes close ${formatDateTime(job.deadlineAt)}`,
  ].filter(Boolean);
}

export function jobLink(baseUrl: string, jobId: string) {
  return `${baseUrl.replace(/\/$/, "")}/jobs/${jobId}`;
}

/** One email for one new job on a lane the company watches. */
export function planInstantAlert(args: {
  baseUrl: string;
  to: string;
  job: JobBrief;
  rateCard?: { name: string; total: string } | null;
}): EmailMessage {
  const { baseUrl, to, job, rateCard } = args;
  const body = [
    `A new job was posted on a lane you watch: ${job.route}.`,
    "",
    ...briefLines(job),
    ...(rateCard ? ["", `Your rate card "${rateCard.name}" gives ${rateCard.total} for this job. Open it to review and send.`] : []),
    "",
    `${rateCard ? "Review and send your quote" : "View the job"}: ${jobLink(baseUrl, job.id)}`,
    "",
    "Quotes are sealed: only the requester sees your price.",
  ];
  return { to, subject: `New job on your lane: ${job.route}`, text: body.join("\n") };
}

/** One email listing every new job since the last digest. */
export function planDigest(args: { baseUrl: string; to: string; jobs: JobBrief[] }): EmailMessage {
  const { baseUrl, to, jobs } = args;
  const n = jobs.length;
  const sections = jobs.map((j) => [`${j.route}`, ...briefLines(j).map((l) => `  ${l}`), `  ${jobLink(baseUrl, j.id)}`].join("\n"));
  return {
    to,
    subject: `${n} new ${n === 1 ? "job" : "jobs"} on your lanes`,
    text: [`Here ${n === 1 ? "is the job" : "are the jobs"} posted on your lanes since your last summary.`, "", sections.join("\n\n"), "", "Quotes are sealed: only the requester sees your price."].join("\n"),
  };
}

export type JobForBrief = {
  id: string;
  mode: string;
  incoterm: string;
  services: readonly string[];
  container_type: string | null;
  container_qty: number | null;
  weight_kg: number | string | null;
  volume_cbm: number | string | null;
  deadline_at: string;
  delivery_suburb: string | null;
  delivery_postcode: string | null;
  unload_type: string | null;
  repeat_frequency: string;
  repeat_volume: string | null;
  origin_name: string;
  destination_name: string;
};

const shortName = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, "");

export function toBrief(j: JobForBrief): JobBrief {
  const regular = j.repeat_frequency !== "one_off";
  return {
    id: j.id,
    route: `${shortName(j.origin_name)} to ${shortName(j.destination_name)}`,
    scope: scopeFor(j.incoterm, j.services).summary,
    incoterm: j.incoterm,
    mode: j.mode,
    size: j.mode === "FCL" ? `${j.container_qty ?? 1} × ${j.container_type ?? ""}`.trim() : `${j.weight_kg ?? 0} kg · ${j.volume_cbm ?? 0} cbm`,
    deliverTo: j.delivery_suburb ? `${j.delivery_suburb} ${j.delivery_postcode ?? ""}`.trim() : null,
    unload: j.unload_type ? (UNLOAD_LABELS[j.unload_type as keyof typeof UNLOAD_LABELS] ?? null) : null,
    regular: regular ? `${REPEAT_LABELS[j.repeat_frequency as keyof typeof REPEAT_LABELS] ?? j.repeat_frequency}${j.repeat_volume ? `, ${j.repeat_volume}` : ""}` : null,
    deadlineAt: j.deadline_at,
  };
}

/** Groups matched jobs per recipient and per job, so one person gets one email and each job appears once. */
export function groupForDigest<T extends { alertId: string; recipient: string; jobId: string }>(
  pairs: T[],
): Map<string, { jobIds: string[]; pairs: T[] }> {
  const out = new Map<string, { jobIds: string[]; pairs: T[] }>();
  for (const p of pairs) {
    const g = out.get(p.recipient) ?? { jobIds: [], pairs: [] };
    g.pairs.push(p);
    if (!g.jobIds.includes(p.jobId)) g.jobIds.push(p.jobId);
    out.set(p.recipient, g);
  }
  return out;
}
