import { execSync } from "node:child_process";

export type LocalEnv = { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string; DB_URL: string };

let cached: LocalEnv | null = null;

/**
 * RLS tests create and change data, so they only ever run against the LOCAL stack.
 * Values come from `supabase status`, never from .env files that might point elsewhere.
 */
export function loadLocalEnv(): LocalEnv {
  if (cached) return cached;
  const out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const map: Record<string, string> = {};
  for (const line of out.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0) map[line.slice(0, i)] = line.slice(i + 1).replace(/^"|"$/g, "");
  }
  const env = {
    API_URL: map.API_URL,
    ANON_KEY: map.ANON_KEY,
    SERVICE_ROLE_KEY: map.SERVICE_ROLE_KEY,
    DB_URL: map.DB_URL,
  };
  if (!env.API_URL || !env.ANON_KEY || !env.SERVICE_ROLE_KEY || !env.DB_URL) {
    throw new Error("Could not read local Supabase settings. Is `npx supabase start` running?");
  }
  const host = new URL(env.API_URL).hostname;
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) {
    throw new Error(`Refusing to run RLS tests against a non-local host: ${host}`);
  }
  cached = env;
  return env;
}
