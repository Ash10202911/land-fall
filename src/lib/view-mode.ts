import "server-only";
import { cookies } from "next/headers";
import type { Company } from "@/lib/auth";
import { MODE_COOKIE, SEEN_COOKIE, parseMode, parseSeen, resolveMode, type ViewMode } from "@/lib/mode";

/** The current view mode from the cookie, falling back to the company's role. */
export async function getViewMode(company: Pick<Company, "role">): Promise<ViewMode> {
  const store = await cookies();
  return resolveMode(store.get(MODE_COOKIE)?.value, company.role);
}

/** The mode the person chose, or null if they have not chosen yet (they are then asked). */
export async function getSavedMode(): Promise<ViewMode | null> {
  const store = await cookies();
  return parseMode(store.get(MODE_COOKIE)?.value);
}

/** When the user last marked the job board as seen. */
export async function getSeenAt(): Promise<Date | null> {
  const store = await cookies();
  return parseSeen(store.get(SEEN_COOKIE)?.value);
}
