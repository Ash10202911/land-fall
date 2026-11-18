import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { loadLocalEnv } from "../rls/env";

// The journey runs against the LOCAL stack only (loadLocalEnv refuses anything else).
const env = loadLocalEnv();
export const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const runId = randomUUID().slice(0, 8);
export const emailFor = (label: string) => `e2e-${label}-${runId}@test.local`;

/** Creates a confirmed user (as the signup flow would) and returns a one-time sign-in URL. */
export async function signInUrl(email: string): Promise<string> {
  const existing = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (!existing.data.users.some((u) => u.email === email)) {
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (created.error) throw created.error;
  }
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  return `/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink`;
}

/** The founder's admin account: set up in the database, as it would be in production. */
export async function createAdminUser(email: string) {
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error || !created.data.user) throw created.error;
  const company = await admin
    .from("companies")
    .insert({ name: `E2E HQ ${runId}`, country: "Australia", role: "forwarder", trust_level: "verified" })
    .select("id")
    .single();
  if (company.error) throw company.error;
  await admin
    .from("profiles")
    .update({ company_id: company.data.id, is_admin: true, full_name: "E2E Admin" })
    .eq("id", created.data.user.id);
}

/** Collects browser console errors and failed requests so the journey can assert there are none. */
export function watchErrors(page: Page, bucket: string[], label: string) {
  page.on("console", (msg) => {
    if (msg.type() === "error") bucket.push(`[${label}] console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => bucket.push(`[${label}] pageerror: ${err.message}`));
}

export async function expectNoHorizontalScroll(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}
