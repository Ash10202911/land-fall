import { makeTranslator, type Locale, type Translator } from "./index";
import { zh } from "./zh";

/** A translator for a known language, with no request needed. Used to write emails in each person's language. */
export function translatorFor(locale: Locale): Translator {
  return makeTranslator(locale, locale === "zh" ? zh : {});
}
