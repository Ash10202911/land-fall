import { z } from "zod";

/**
 * Requester / Quoter view mode. The mode only chooses which screens and lists are shown; it never
 * grants access. All access comes from Row Level Security and ownership checks.
 */
export const VIEW_MODES = ["requester", "quoter"] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export const MODE_COOKIE = "sb_mode";
export const MODE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const modeSchema = z.enum(VIEW_MODES);

export const MODE_LABEL: Record<ViewMode, string> = { requester: "Requester", quoter: "Quoter" };

/** A valid mode, or null for anything else (treated as unset). */
export function parseMode(value: unknown): ViewMode | null {
  const parsed = modeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Agents usually ask for quotes; forwarders usually send them. */
export function defaultModeFor(role: "agent" | "forwarder"): ViewMode {
  return role === "agent" ? "requester" : "quoter";
}

/** The saved choice wins; otherwise the default for the company's role. */
export function resolveMode(cookieValue: unknown, role: "agent" | "forwarder"): ViewMode {
  return parseMode(cookieValue) ?? defaultModeFor(role);
}

export type NavIcon = "requests" | "request" | "board" | "quotes" | "lanes" | "profile";
export type NavItem = { href: string; label: string; icon: NavIcon };

export function navItemsFor(mode: ViewMode): NavItem[] {
  return mode === "requester"
    ? [
        { href: "/jobs", label: "My requests", icon: "requests" },
        { href: "/post", label: "Request quote", icon: "request" },
        { href: "/profile", label: "Profile", icon: "profile" },
      ]
    : [
        { href: "/jobs", label: "Job board", icon: "board" },
        { href: "/quotes", label: "My quotes", icon: "quotes" },
        { href: "/lanes", label: "My lanes", icon: "lanes" },
        { href: "/profile", label: "Profile", icon: "profile" },
      ];
}

// ---------------------------------------------------------------------------
// "New since your last visit" on the job board
// ---------------------------------------------------------------------------

export const SEEN_COOKIE = "sb_seen";
const ISO = z.iso.datetime();

/** The time the user last marked the board as seen, or null when unset or invalid. */
export function parseSeen(value: unknown): Date | null {
  const parsed = ISO.safeParse(value);
  return parsed.success ? new Date(parsed.data) : null;
}

/** A job is new if it was posted after the last "mark seen", or within the last 24 hours when unset. */
export function isNewJob(createdAt: string, seen: Date | null, now: Date): boolean {
  const created = new Date(createdAt).getTime();
  if (seen) return created > seen.getTime();
  return now.getTime() - created < 24 * 60 * 60 * 1000;
}
