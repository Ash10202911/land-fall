// Prints a one-time sign-in link for a LOCAL user, so you can skip the email step in development.
// Usage: node scripts/dev-login-link.mjs fwd1@demo.test
// Refuses to run unless NEXT_PUBLIC_SUPABASE_URL points at localhost.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const host = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname;
if (!["127.0.0.1", "localhost"].includes(host)) {
  console.error("Refusing to run: NEXT_PUBLIC_SUPABASE_URL is not local.");
  process.exit(1);
}
const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/dev-login-link.mjs <email>");
  process.exit(1);
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error) {
  console.error(error.message);
  process.exit(1);
}
const base = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
console.log(`${base}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink`);
