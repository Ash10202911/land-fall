import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./env";

const env = loadLocalEnv();
const opts = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** Service role client: bypasses RLS. Used only to arrange test data. */
export const admin: SupabaseClient = createClient(env.API_URL, env.SERVICE_ROLE_KEY, opts);

export function anonClient(): SupabaseClient {
  return createClient(env.API_URL, env.ANON_KEY, opts);
}

export type TestUser = {
  id: string;
  email: string;
  companyId: string;
  client: SupabaseClient;
};

const PASSWORD = "Test-password-123!";

export async function makeUser(
  opts2: {
    role?: "agent" | "forwarder";
    trust?: "basic" | "verified";
    status?: "active" | "suspended";
    isAdmin?: boolean;
    companyId?: string;
    name?: string;
  } = {},
): Promise<TestUser> {
  const email = `rls-${randomUUID()}@test.local`;
  const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error("createUser failed");
  const id = created.data.user.id;

  let companyId = opts2.companyId;
  if (!companyId) {
    const { data, error } = await admin
      .from("companies")
      .insert({
        name: opts2.name ?? `Test Co ${randomUUID().slice(0, 8)}`,
        country: "Australia",
        role: opts2.role ?? "forwarder",
        trust_level: opts2.trust ?? "basic",
        status: opts2.status ?? "active",
      })
      .select("id")
      .single();
    if (error) throw error;
    companyId = data.id as string;
  }
  const upd = await admin
    .from("profiles")
    .update({ company_id: companyId, is_admin: opts2.isAdmin ?? false, full_name: "Test Person", phone: "+61 400 000 000" })
    .eq("id", id);
  if (upd.error) throw upd.error;

  const client = createClient(env.API_URL, env.ANON_KEY, opts);
  const signed = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signed.error) throw signed.error;
  return { id, email, companyId, client };
}

let portIds: number[] | null = null;
export async function twoPorts(): Promise<[number, number]> {
  if (!portIds) {
    const { data, error } = await admin.from("ports").select("id").order("id").limit(2);
    if (error || !data || data.length < 2) throw error ?? new Error("Ports are not seeded. Run `npm run db:reset`.");
    portIds = data.map((p) => p.id as number);
  }
  return [portIds[0], portIds[1]];
}

export const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
export const dateInDays = (n: number) => inDays(n).slice(0, 10);

/** Creates an open job for `poster` with the service role. */
export async function makeJob(poster: TestUser, overrides: Record<string, unknown> = {}) {
  const [origin, destination] = await twoPorts();
  const { data, error } = await admin
    .from("jobs")
    .insert({
      company_id: poster.companyId,
      created_by: poster.id,
      direction: "import",
      incoterm: "FOB",
      mode: "FCL",
      origin_port_id: origin,
      destination_port_id: destination,
      container_type: "40HC",
      container_qty: 1,
      cargo_description: "Test cargo",
      ready_date: dateInDays(10),
      services: [],
      deadline_at: inDays(3),
      ...overrides,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export const line = (name = "Destination charges", amount = 85000, currency = "AUD") => ({
  charge_name: name,
  amount_minor: amount,
  currency,
  gst_included: true,
});

/** Submits a quote as `user` through the RPC (RLS applies). Returns the RPC result. */
export function submitQuote(user: TestUser, jobId: string, lines = [line()]) {
  return user.client.rpc("submit_quote", {
    p_job_id: jobId,
    p_valid_until: dateInDays(14),
    p_notes: null,
    p_lines: lines,
  });
}

/** Submits a quote and fails the test if it was rejected. */
export async function mustSubmitQuote(user: TestUser, jobId: string, lines = [line()]) {
  const { data, error } = await submitQuote(user, jobId, lines);
  if (error || !data) throw error ?? new Error("quote was not created");
  return data as string;
}

/** Moves the deadline into the past using the service role (users cannot do this). */
export async function expireJob(jobId: string) {
  const { error } = await admin.from("jobs").update({ deadline_at: inDays(-1) }).eq("id", jobId);
  if (error) throw error;
}
