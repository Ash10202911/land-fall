import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { demoKeyMatches, isDemoEmail } from "@/lib/demo-login";

/**
 * Guarded demo sign-in for testing without email. Disabled (404) unless DEMO_KEY (16+ chars),
 * DEMO_EMAIL and DEMO_PASSWORD are set. It can only sign in as a throwaway account on the
 * reserved @example.test domain, never as an admin, and needs ?key=<DEMO_KEY>.
 */
export async function GET(request: NextRequest) {
  const demoEmail = process.env.DEMO_EMAIL?.trim().toLowerCase();
  const demoPassword = process.env.DEMO_PASSWORD;
  const notFound = () => new NextResponse("Not found", { status: 404 });

  if (!process.env.DEMO_KEY || !demoPassword || !isDemoEmail(demoEmail)) return notFound();
  if (!demoKeyMatches(request.nextUrl.searchParams.get("key"), process.env.DEMO_KEY)) return notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: demoEmail, password: demoPassword });
  if (error || !data.user) return notFound();

  // Defence in depth: never leave an admin session open through the demo link.
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", data.user.id).maybeSingle();
  if (profile?.is_admin) {
    await supabase.auth.signOut();
    return notFound();
  }

  const response = NextResponse.redirect(`${request.nextUrl.origin}/jobs`);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
