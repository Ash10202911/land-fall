import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/i18n";

export type Company = {
  id: string;
  name: string;
  country: string;
  role: "agent" | "forwarder";
  trust_level: "basic" | "verified";
  status: "active" | "suspended";
};

export type Me = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  is_admin: boolean;
  language: Locale;
  company: Company | null;
};

/** The signed-in user with their profile and company, or null when signed out. */
export const getMe = cache(async (): Promise<Me | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, phone, is_admin, language, company:companies(id, name, country, role, trust_level, status)",
    )
    .eq("id", userId)
    .single();
  if (!data) return null;
  const company = Array.isArray(data.company) ? (data.company[0] ?? null) : data.company;
  return { ...data, company } as Me;
});

/** For pages inside the app: signed in and onboarded, otherwise redirect. */
export async function requireMember(): Promise<Me & { company: Company }> {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  if (!me.company) redirect("/onboarding");
  return me as Me & { company: Company };
}

/** For admin pages: anyone else gets a 404. */
export async function requireAdmin() {
  const me = await getMe();
  if (!me || !me.is_admin) notFound();
  return me;
}
