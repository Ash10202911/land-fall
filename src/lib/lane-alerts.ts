import { formatDateTime, type SERVICES } from "@/lib/domain";
import type { EmailMessage } from "@/lib/email";
import { REPEAT_LABELS, UNLOAD_LABELS, scopeFor } from "@/lib/scope";
import { msg, tEn, type Locale, type Translator } from "@/lib/i18n";
import { translatorFor } from "@/lib/i18n/translator";

export const ALERT_FREQUENCIES = ["instant", "daily", "off"] as const;
export type AlertFrequency = (typeof ALERT_FREQUENCIES)[number];
export const FREQUENCY_LABELS: Record<AlertFrequency, string> = { instant: msg("Instantly"), daily: msg("Daily 7am"), off: msg("Off") };

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

export function briefLines(job: JobBrief, t: Translator = tEn): string[] {
  const modeText = job.mode === "Air" ? t("Air") : job.mode === "FCL" ? t("Sea, full container") : t("Sea, shared container");
  const [regularLabel, ...regularRest] = (job.regular ?? "").split(", ");
  const regular = job.regular ? [t(regularLabel), ...regularRest].join(", ") : "";
  return [
    `${t(job.scope)} · ${job.incoterm} · ${modeText}`,
    job.size + (regular ? ` · ${regular}` : ""),
    job.deliverTo
      ? job.unload
        ? t("Deliver to {place} ({unload})", { place: job.deliverTo, unload: t(job.unload) })
        : t("Deliver to {place}", { place: job.deliverTo })
      : "",
    t("Quotes close {when}", { when: formatDateTime(job.deadlineAt) }),
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
  /** The requester extended the deadline on a job with no quotes yet. */
  extended?: boolean;
  /** The recipient's language. English when not given. */
  language?: Locale;
}): EmailMessage {
  const { baseUrl, to, job, rateCard, extended } = args;
  const t = translatorFor(args.language ?? "en");
  const body = [
    extended
      ? t("The quote deadline was extended on a job on a lane you watch: {route}. No quotes have been sent yet.", { route: job.route })
      : t("A new job was posted on a lane you watch: {route}.", { route: job.route }),
    "",
    ...briefLines(job, t),
    ...(rateCard
      ? ["", t("Your rate card \"{name}\" gives {total} for this job. Open it to review and send.", { name: rateCard.name, total: rateCard.total })]
      : []),
    "",
    `${rateCard ? t("Review and send your quote") : t("View the job")}: ${jobLink(baseUrl, job.id)}`,
    "",
    t("Quotes are sealed: only the requester sees your price."),
  ];
  return {
    to,
    locale: t.locale,
    subject: extended ? t("Deadline extended: {route}", { route: job.route }) : t("New job on your lane: {route}", { route: job.route }),
    text: body.join("\n"),
  };
}

/** One email listing every new job since the last digest. */
export function planDigest(args: { baseUrl: string; to: string; jobs: JobBrief[]; language?: Locale }): EmailMessage {
  const { baseUrl, to, jobs } = args;
  const t = translatorFor(args.language ?? "en");
  const n = jobs.length;
  const sections = jobs.map((j) => [`${j.route}`, ...briefLines(j, t).map((l) => `  ${l}`), `  ${jobLink(baseUrl, j.id)}`].join("\n"));
  return {
    to,
    locale: t.locale,
    subject: t.plural(n, "{n} new job on your lanes", "{n} new jobs on your lanes"),
    text: [
      t.plural(n, "Here is the job posted on your lanes since your last summary.", "Here are the jobs posted on your lanes since your last summary."),
      "",
      sections.join("\n\n"),
      "",
      t("Quotes are sealed: only the requester sees your price."),
    ].join("\n"),
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

/** The hour (0 to 23) in Sydney, which handles daylight saving. */
export function sydneyHour(date: Date): number {
  const h = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", hourCycle: "h23" }).format(date);
  return Number(h);
}

export type AlertWithRecipient = AlertRow & { recipient: string; language?: Locale };
export type RunJob = MatchJob & JobForBrief;
export type RunEmail = { to: string; companyId: string; language?: Locale; jobs: RunJob[]; pairs: { alertId: string; jobId: string }[] };

/**
 * Decides who is emailed about which jobs. For each alert of the given frequency, every matching job it
 * has not already been told about becomes a pair. Pairs are grouped so each person gets one email, with
 * each job listed once even when two of their alerts match it. Pure: the caller reads and writes the database.
 */
export function planRun(args: {
  alerts: AlertWithRecipient[];
  jobs: RunJob[];
  /** "alertId:jobId" for every alert already emailed about a job. */
  delivered: ReadonlySet<string>;
  frequency: "instant" | "daily";
}): RunEmail[] {
  const pairs: { alertId: string; recipient: string; jobId: string; companyId: string; language?: Locale }[] = [];
  for (const alert of args.alerts) {
    if (alert.frequency !== args.frequency || !alert.recipient) continue;
    for (const job of args.jobs) {
      if (args.delivered.has(`${alert.id}:${job.id}`)) continue;
      if (!laneMatches(alert, job)) continue;
      pairs.push({ alertId: alert.id, recipient: alert.recipient, jobId: job.id, companyId: alert.company_id, language: alert.language });
    }
  }
  const byId = new Map(args.jobs.map((j) => [j.id, j]));
  return [...groupForDigest(pairs)].map(([to, g]) => ({
    to,
    companyId: g.pairs[0].companyId,
    language: g.pairs[0].language,
    jobs: g.jobIds.map((id) => byId.get(id)!),
    pairs: g.pairs.map((p) => ({ alertId: p.alertId, jobId: p.jobId })),
  }));
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
