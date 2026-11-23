import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getMe } from "@/lib/auth";
import { LOCALE_COOKIE, localeFromAcceptLanguage, makeTranslator, parseLocale, type Locale, type Translator } from "./index";
import { zh } from "./zh";

/**
 * The language for this request: the person's saved choice (cookie), else their profile when signed in,
 * else their browser's language, else English.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const fromCookie = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  if (fromCookie) return fromCookie;
  const me = await getMe();
  if (me) return parseLocale(me.language) ?? "en";
  return localeFromAcceptLanguage((await headers()).get("accept-language"));
});

/** The dictionary to send to the browser. English needs none, so English pages stay light. */
export function messagesFor(locale: Locale) {
  return locale === "zh" ? zh : {};
}

/** A translator for server components and actions. */
export async function getT(): Promise<Translator> {
  const locale = await getLocale();
  return makeTranslator(locale, messagesFor(locale));
}
