import { loadLocalEnv } from "./env";

/** Fails fast with a clear message when local Supabase is not running. */
export default async function setup() {
  const env = loadLocalEnv();
  const res = await fetch(`${env.API_URL}/auth/v1/health`, {
    headers: { apikey: env.ANON_KEY },
  }).catch(() => null);
  if (!res || !res.ok) {
    throw new Error("Local Supabase is not running. Start it with `npx supabase start`, then re-run `npm run test:rls`.");
  }
}
