"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/env";
import { fieldErrors, signInSchema, type FormState } from "@/lib/validation/auth";

export async function requestMagicLink(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const origin = (await headers()).get("origin") ?? appUrl();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback`, shouldCreateUser: true },
  });
  if (error) {
    return { message: "We could not send the link. Please try again in a minute." };
  }
  return { ok: true, message: "Check your email for a sign-in link." };
}
