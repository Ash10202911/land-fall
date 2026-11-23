"use client";

import { createContext, useContext, useMemo } from "react";
import { makeTranslator, type Locale, type Messages, type Translator } from "@/lib/i18n";

const Ctx = createContext<Translator>(makeTranslator("en"));

/** Gives client components the same translator the server uses. */
export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: React.ReactNode }) {
  const t = useMemo(() => makeTranslator(locale, messages), [locale, messages]);
  return <Ctx.Provider value={t}>{children}</Ctx.Provider>;
}

export function useT(): Translator {
  return useContext(Ctx);
}
