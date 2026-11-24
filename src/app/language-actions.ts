"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/auth";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, parseLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

/**
 * Saves the language for this browser and, when signed in, on the person's profile, so their emails
 * follow it too. Works for signed-out visitors (the sign-in page) as well.
 */
export async function setLanguage(value: unknown): Promise<void> {
  const locale = parseLocale(value);
  if (!locale) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    path: "/",
  });
  const me = await getMe();
  if (me && me.language !== locale) {
    const supabase = await createClient();
    await supabase.from("profiles").update({ language: locale }).eq("id", me.id);
  }
  revalidatePath("/", "layout");
}
