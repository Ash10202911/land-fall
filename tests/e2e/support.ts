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

/** Creates a confirmed user with a company, as onboarding would, and returns their ids. */
export async function createMember(
  email: string,
  opts: { name: string; role: "agent" | "forwarder"; trust?: "basic" | "verified"; country?: string },
) {
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error || !created.data.user) throw created.error;
  const company = await admin
    .from("companies")
    .insert({ name: opts.name, country: opts.country ?? "Australia", role: opts.role, trust_level: opts.trust ?? "basic" })
    .select("id")
    .single();
  if (company.error) throw company.error;
  await admin
    .from("profiles")
    .update({ company_id: company.data.id, full_name: opts.name, phone: "+61 400 000 000" })
    .eq("id", created.data.user.id);
  return { userId: created.data.user.id, companyId: company.data.id as string };
}

/** Inserts an open job with the service role (a stand-in for another company posting it). */
export async function insertJob(
  who: { userId: string; companyId: string },
  route: { origin: string; destination: string },
  extra: Record<string, unknown> = {},
) {
  const ports = await admin.from("ports").select("id, code").in("code", [route.origin, route.destination]);
  const id = (code: string) => ports.data?.find((p) => p.code === code)?.id;
  const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
  const { data, error } = await admin
    .from("jobs")
    .insert({
      company_id: who.companyId,
      created_by: who.userId,
      direction: "import",
      incoterm: "CIF",
      mode: "FCL",
      origin_port_id: id(route.origin),
      destination_port_id: id(route.destination),
      container_type: "40HC",
      container_qty: 2,
      cargo_description: "E2E cargo",
      ready_date: day(10).slice(0, 10),
      services: ["destination_charges", "customs_clearance", "delivery"],
      delivery_suburb: "Eagle Farm QLD",
      delivery_postcode: "4009",
      unload_type: "side_loader",
      deadline_at: day(3),
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
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

/** Everyone starts on a "What would you like to do?" screen. Picks a side if it is showing. */
export async function chooseMode(page: import("@playwright/test").Page, mode: "requester" | "quoter") {
  const button = page.getByTestId(`choose-${mode}`);
  await button.waitFor({ timeout: 8000 }).catch(() => {});
  if (await button.isVisible().catch(() => false)) await button.click();
}
