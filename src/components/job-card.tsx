import Link from "next/link";
import { ArrowRight, BadgeCheck, Box, Bug, Flame, MapPin, Repeat, Snowflake } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { ScopeStrip } from "@/components/scope-strip";
import { formatDate, isJobClosed } from "@/lib/domain";
import { LAND_PATH, flagFor, routeGeometry } from "@/lib/geo";
import { cargoSummary, portLabel, type JobRow } from "@/lib/jobs";
import { REPEAT_LABELS, UNLOAD_LABELS, scopeFor } from "@/lib/scope";
import { cn } from "@/lib/utils";

export type Band = "none" | "few" | "busy";

export function JobFlags({ job }: { job: Pick<JobRow, "flag_dg" | "flag_reefer" | "flag_bmsb"> }) {
  if (!job.flag_dg && !job.flag_reefer && !job.flag_bmsb) return null;
  const chip = "inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold";
  return (
    <div className="flex flex-wrap gap-1.5">
      {job.flag_dg ? (
        <span className={cn(chip, "bg-red-100 text-red-800")}>
          <Flame className="h-3.5 w-3.5" aria-hidden />
          Dangerous goods
        </span>
      ) : null}
      {job.flag_reefer ? (
        <span className={cn(chip, "bg-indigo-100 text-indigo-900")}>
          <Snowflake className="h-3.5 w-3.5" aria-hidden />
          Reefer
        </span>
      ) : null}
      {job.flag_bmsb ? (
        <span className={cn(chip, "bg-amber-100 text-amber-900")}>
          <Bug className="h-3.5 w-3.5" aria-hidden />
          BMSB risk
        </span>
      ) : null}
    </div>
  );
}

const shortName = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, "");

function hoursLeft(deadline: string, now: Date) {
  return Math.max(0, (new Date(deadline).getTime() - now.getTime()) / 3_600_000);
}

function leftLabel(h: number) {
  return h >= 48 ? `${Math.floor(h / 24)}d` : `${Math.max(1, Math.floor(h))}h`;
}

/** Circular countdown to the quote deadline; red under 24 hours. */
function CountdownRing({ job, now }: { job: JobRow; now: Date }) {
  const left = hoursLeft(job.deadline_at, now);
  const total = Math.max(1, (new Date(job.deadline_at).getTime() - new Date(job.created_at).getTime()) / 3_600_000);
  const circ = 2 * Math.PI * 21;
  const frac = Math.max(0.04, Math.min(1, left / total));
  const urgent = left < 24;
  const text = left >= 48 ? `${Math.floor(left / 24)} days` : `${Math.max(1, Math.floor(left))} hours`;
  return (
    <div
      className="absolute right-2 top-2 grid h-14 w-14 place-items-center rounded-full bg-card shadow-card"
      role="img"
      aria-label={`Quotes close in ${text}`}
    >
      <svg width="56" height="56" viewBox="0 0 54 54" className="absolute inset-0" aria-hidden>
        <circle cx="27" cy="27" r="21" fill="none" stroke="var(--muted)" strokeWidth="5" />
        <circle
          cx="27"
          cy="27"
          r="21"
          fill="none"
          stroke={urgent ? "#dc2626" : "var(--sea)"}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(circ * frac).toFixed(1)} ${circ.toFixed(1)}`}
          transform="rotate(-90 27 27)"
        />
      </svg>
      <span className="relative flex flex-col items-center leading-none">
        <span className={cn("text-sm font-extrabold", urgent ? "text-red-700" : "text-foreground")}>{leftLabel(left)}</span>
        <span className="mt-0.5 text-[9px] font-semibold text-muted-foreground">to quote</span>
      </span>
    </div>
  );
}

/**
 * A port name pill placed on the far side of its port from the other port, so it never covers the
 * route line, and clamped inside the strip.
 */
function PortLabel({
  name,
  country,
  px,
  py,
  otherPy,
}: {
  name: string;
  country: string;
  px: number;
  py: number;
  otherPy: number;
}) {
  const left = Math.min(78, Math.max(22, px));
  const below = Math.abs(py - otherPy) < 15 ? py < 52 : py > otherPy;
  return (
    <span
      className="absolute inline-flex h-7 -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-card pl-1.5 pr-2.5 text-xs font-bold shadow-card"
      style={{
        left: `${left}%`,
        top: below ? `min(calc(100% - 32px), calc(${py}% + 10px))` : `max(4px, calc(${py}% - 38px))`,
      }}
    >
      <span aria-hidden>{flagFor(country)}</span>
      {shortName(name)}
    </span>
  );
}

/**
 * The world outline, defined once per page. Every route map references it with <use>, so a board of
 * many cards does not repeat the outline in each one.
 */
export function LandDefs() {
  return (
    <svg width="0" height="0" aria-hidden className="absolute" focusable="false">
      <defs>
        <path id="sb-land" d={LAND_PATH} strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
      </defs>
    </svg>
  );
}

/** Route map strip: land, a curved route, both ports with flags. */
function RouteMap({ job, air }: { job: JobRow; air: boolean }) {
  const g = routeGeometry(job.origin.code, job.destination.code, 3);
  const color = air ? "var(--air)" : "var(--sea)";
  return (
    <div className={cn("relative h-32 overflow-hidden", air ? "bg-air-soft" : "bg-sea-soft")}>
      {g ? (
        <svg
          viewBox={g.viewBox}
          preserveAspectRatio="xMidYMid slice"
          className="block h-full w-full"
          role="img"
          aria-label={`Route map: ${shortName(job.origin.name)} to ${shortName(job.destination.name)}`}
        >
          <use href="#sb-land" fill={air ? "#d7e9f4" : "#c9e2ea"} stroke={air ? "#b8d7ea" : "#a9ceda"} />
          <path d={g.arc} fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path
            d={g.arc}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={air ? "2 6" : undefined}
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={g.origin.x} cy={g.origin.y} r={g.dotRadius} fill="#fff" stroke="var(--foreground)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <circle className="ping-dot" cx={g.destination.x} cy={g.destination.y} r={g.dotRadius} fill={color} />
          <circle cx={g.destination.x} cy={g.destination.y} r={g.dotRadius} fill={color} stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      ) : null}
      {g ? (
        <>
          <PortLabel name={job.origin.name} country={job.origin.country} px={g.origin.px} py={g.origin.py} otherPy={g.destination.py} />
          <PortLabel
            name={job.destination.name}
            country={job.destination.country}
            px={g.destination.px}
            py={g.destination.py}
            otherPy={g.origin.py}
          />
        </>
      ) : (
        <p className="absolute inset-x-4 top-1/2 -translate-y-1/2 truncate text-lg font-semibold">
          {shortName(job.origin.name)} → {shortName(job.destination.name)}
        </p>
      )}
    </div>
  );
}

/** Small container pictures: 40ft drawn longer, high cube taller, reefers in indigo. */
function Containers({ job }: { job: JobRow }) {
  if (job.mode !== "FCL" || !job.container_type) {
    return <Box className={cn("h-6 w-6", job.mode === "Air" ? "text-air-ink" : "text-sea-ink")} aria-hidden />;
  }
  const qty = job.container_qty ?? 1;
  const long = job.container_type.startsWith("40");
  const tall = job.container_type === "40HC";
  const reefer = job.container_type.endsWith("RF");
  return (
    <span className="flex items-end gap-1" aria-hidden>
      {Array.from({ length: Math.min(qty, 4) }, (_, i) => (
        <span
          key={i}
          className={cn(
            "block rounded-[3px] border-2",
            long ? "w-[34px]" : "w-5",
            tall ? "h-[18px]" : "h-[15px]",
            reefer ? "border-indigo-800 bg-indigo-100" : "border-sea-ink bg-cyan-100",
          )}
          style={{
            backgroundImage: `repeating-linear-gradient(90deg, transparent 0 3px, ${reefer ? "rgb(199 210 254)" : "rgb(165 243 252)"} 3px 6px)`,
          }}
        />
      ))}
      {qty > 4 ? <span className="ml-0.5 text-xs font-bold text-sea-ink">+{qty - 4}</span> : null}
    </span>
  );
}

const BAND_TEXT: Record<Band, string> = {
  none: "No quotes yet. Be first",
  few: "A few quotes in",
  busy: "Busy: many quotes",
};

function CompetitionMeter({ band, air }: { band: Band; air: boolean }) {
  const lit = band === "none" ? 1 : band === "few" ? 2 : 3;
  return (
    <span className="flex flex-col gap-1.5" role="img" aria-label={`Competition: ${BAND_TEXT[band]}`}>
      <span className="flex gap-1" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span key={n} className={cn("block h-2 w-6 rounded-full", n <= lit ? (air ? "bg-air" : "bg-sea") : "bg-muted")} />
        ))}
      </span>
      <span className="text-xs font-semibold text-muted-foreground">{BAND_TEXT[band]}</span>
    </span>
  );
}

/**
 * The redesigned job card. On the board it shows the competition band and "Send quote"; on the
 * requester's own list it shows the quote count and "Compare quotes".
 */
export function JobCard({
  job,
  now,
  isNew = false,
  band,
  quoteCount,
}: {
  job: JobRow;
  now: Date;
  isNew?: boolean;
  band?: Band;
  quoteCount?: number;
}) {
  const air = job.mode === "Air";
  const closed = isJobClosed(job, now);
  const scope = scopeFor(job.incoterm, job.services);
  const regular = job.repeat_frequency !== "one_off";
  const mine = quoteCount !== undefined;
  const status = job.status === "awarded" ? "Awarded" : job.status === "cancelled" ? "Cancelled" : closed ? "Closed" : null;

  return (
    <Link
      href={`/jobs/${job.id}`}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-[22px] border bg-card shadow-card transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
        isNew && !closed ? (air ? "glow-air border-2 border-air" : "glow-sea border-2 border-sea") : "border-border",
      )}
    >
      <div className="relative">
        <RouteMap job={job} air={air} />
        {isNew && !closed ? (
          <span
            className={cn(
              "absolute left-2.5 top-2.5 inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-extrabold tracking-wide text-foreground",
              air ? "bg-sky-300" : "bg-cyan-300",
            )}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground motion-reduce:animate-none" aria-hidden />
            NEW
          </span>
        ) : null}
        {status ? (
          <span className="absolute right-2.5 top-2.5">
            <Badge tone={job.status === "awarded" ? "success" : job.status === "cancelled" ? "danger" : "neutral"}>{status}</Badge>
          </span>
        ) : (
          <CountdownRing job={job} now={now} />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xl font-bold leading-tight tracking-tight">{scope.summary}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {job.incoterm} · {air ? "Air freight" : job.mode === "FCL" ? "Sea · full container" : "Sea · shared container"}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold",
              regular ? "bg-green-100 text-green-900" : "bg-muted text-muted-foreground",
            )}
          >
            <Repeat className="h-3.5 w-3.5" aria-hidden />
            {regular ? `${REPEAT_LABELS[job.repeat_frequency]}${job.repeat_volume ? ` · ${job.repeat_volume}` : ""}` : "One-off"}
          </span>
        </div>

        <ScopeStrip legs={scope.legs} air={air} compact />

        {job.delivery_suburb ? (
          <div className="flex items-start gap-2.5 rounded-2xl border border-border bg-background/60 p-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Deliver to</p>
              <p className="truncate text-sm font-bold">
                {job.delivery_suburb} {job.delivery_postcode}
              </p>
            </div>
            {job.unload_type ? (
              <span className="shrink-0 rounded-lg border border-border bg-card px-2 py-1 text-xs font-bold">
                {UNLOAD_LABELS[job.unload_type]}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className={cn("flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5", air ? "bg-air-soft" : "bg-sea-soft")}>
          <Containers job={job} />
          <p className="min-w-0 text-right">
            <span className="block text-sm font-bold">{cargoSummary(job)}</span>
            <span className="block truncate text-xs text-muted-foreground">{job.cargo_description}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl border border-border bg-background/60 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ready</p>
            <p className="mt-1 font-bold">{formatDate(job.ready_date)}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/60 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Needed by</p>
            <p className="mt-1 font-bold">{job.required_by ? formatDate(job.required_by) : "Flexible"}</p>
          </div>
        </div>

        <JobFlags job={job} />

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
          {mine ? (
            <span className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold">{quoteCount}</span>
              <span className="text-sm text-muted-foreground">{quoteCount === 1 ? "quote received" : "quotes received"}</span>
            </span>
          ) : band ? (
            <CompetitionMeter band={band} air={air} />
          ) : (
            <span />
          )}
          {!closed ? (
            <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">
              {mine ? "Compare quotes" : "Send quote"}
              <ArrowRight className="h-4 w-4 text-cyan-200" aria-hidden />
            </span>
          ) : null}
        </div>

        {!mine ? (
          <p className="-mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            {job.company?.trust_level === "verified" ? (
              <BadgeCheck className="h-3.5 w-3.5 text-success" aria-label="Verified" />
            ) : null}
            <span className="truncate">{job.company?.name ?? "Unknown company"}</span>
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export { portLabel };
