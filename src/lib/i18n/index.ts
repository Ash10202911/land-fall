import { z } from "zod";

/**
 * Languages. The English text in the source is the key: t("Open jobs") returns English as written, or
 * the Chinese for that exact English text from the dictionary. Anything missing falls back to English,
 * so a gap shows English rather than a blank. A unit test checks that every t("...") in the source has a
 * Chinese entry, so gaps are caught before they reach a person.
 */
export const LOCALES = ["en", "zh"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = "sb_lang";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", zh: "简体中文" };
/** The `lang` attribute for each locale. Dates stay DD/MM/YYYY in both. */
export const HTML_LANG: Record<Locale, string> = { en: "en-AU", zh: "zh-Hans" };

const localeSchema = z.enum(LOCALES);

/** A valid locale, or null for anything else. */
export function parseLocale(value: unknown): Locale | null {
  const parsed = localeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** The first language in an Accept-Language header that we support. Any Chinese variant gives zh. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  for (const part of (header ?? "").split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase();
    if (tag.startsWith("zh")) return "zh";
    if (tag.startsWith("en")) return "en";
  }
  return "en";
}

export type Params = Record<string, string | number>;
export type Messages = Readonly<Record<string, string>>;

/** Replaces {name} with the value. A placeholder with no value is left as written. */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in params ? String(params[key]) : whole));
}

/**
 * Marks a piece of text in a constant (a label table, a validation message) as translatable. It returns
 * the text unchanged; the screen translates it where it is shown, with t(label). The coverage test finds
 * these marks, so every one must have a Chinese entry.
 */
export const msg = (text: string): string => text;

export type Translator = {
  (text: string, params?: Params): string;
  /** Picks the singular for exactly 1 in English. {n} is the count. Chinese has one form. */
  plural(n: number, one: string, other: string, params?: Params): string;
  locale: Locale;
};

export function makeTranslator(locale: Locale, messages: Messages = {}): Translator {
  const lookup = (text: string) => (locale === "en" ? text : (messages[text] ?? text));
  const t = ((text: string, params?: Params) => interpolate(lookup(text), params)) as Translator;
  t.plural = (n, one, other, params) => interpolate(lookup(locale === "en" && n === 1 ? one : other), { n, ...params });
  t.locale = locale;
  return t;
}

/** A translator that always answers in English. For code that has no person to ask. */
export const tEn = makeTranslator("en");
