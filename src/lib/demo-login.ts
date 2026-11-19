import { timingSafeEqual } from "node:crypto";

/** Demo sign-in may only ever target throwaway accounts on this reserved test domain. */
export const DEMO_EMAIL_DOMAIN = "@example.test";

export function isDemoEmail(email: string | undefined): email is string {
  return typeof email === "string" && email.toLowerCase().endsWith(DEMO_EMAIL_DOMAIN) && email.length > DEMO_EMAIL_DOMAIN.length;
}

/** Constant-time comparison of the supplied key against the configured one. */
export function demoKeyMatches(supplied: string | null, expected: string | undefined): boolean {
  if (!supplied || !expected || expected.length < 16) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
