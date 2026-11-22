import "server-only";
import { cookies } from "next/headers";
import type { Company } from "@/lib/auth";
import { MODE_COOKIE, SEEN_COOKIE, parseSeen, resolveMode, type ViewMode } from "@/lib/mode";

/** The current view mode from the cookie, falling back to the company's role. */
export async function getViewMode(company: Pick<Company, "role">): Promise<ViewMode> {
  const store = await cookies();
  return resolveMode(store.get(MODE_COOKIE)?.value, company.role);
}

/** When the user last marked the job board as seen. */
export async function getSeenAt(): Promise<Date | null> {
  const store = await cookies();
  return parseSeen(store.get(SEEN_COOKIE)?.value);
}
