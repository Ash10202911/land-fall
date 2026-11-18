import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { demoKeyMatches, isDemoEmail } from "@/lib/demo-login";

/**
 * Guarded demo sign-in for testing without email. Disabled (404) unless DEMO_KEY (16+ chars),
 * DEMO_EMAIL and SUPABASE_SERVICE_ROLE_KEY are set. It can only sign in as a throwaway
 * account on the reserved @example.test domain, never as an admin, and needs ?key=<DEMO_KEY>.
 */
export async function GET(request: NextRequest) {
  const demoEmail = process.env.DEMO_EMAIL?.trim().toLowerCase();
  const notFound = () => new NextResponse("Not found", { status: 404 });

  if (!process.env.DEMO_KEY || !isDemoEmail(demoEmail)) return notFound();
  if (!demoKeyMatches(request.nextUrl.searchParams.get("key"), process.env.DEMO_KEY)) return notFound();

  const admin = createAdminClient();
  if (!admin) return notFound();

  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("email", demoEmail)
    .maybeSingle();
  if (!profile || profile.is_admin) return notFound();

  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: demoEmail });
  const tokenHash = link?.properties?.hashed_token;
  if (error || !tokenHash) return notFound();

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (verifyError) return notFound();

  const response = NextResponse.redirect(`${request.nextUrl.origin}/jobs`);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
