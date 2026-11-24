"use client";

import { Languages } from "lucide-react";
import { setLanguage } from "@/app/language-actions";
import { LOCALE_NAMES } from "@/lib/i18n";
import { useT } from "@/components/i18n-provider";

/**
 * One tap switches between English and Chinese. It shows the language you would switch to, in that
 * language, so it can be found even when you cannot read the current one. It is a form, so it works
 * before the page's JavaScript has loaded.
 */
export function LanguageToggle() {
  const t = useT();
  const next = t.locale === "en" ? "zh" : "en";
  return (
    <form action={setLanguage.bind(null, next)}>
      <button
        type="submit"
        lang={next === "zh" ? "zh-Hans" : "en"}
        aria-label={`${t("Switch language")}: ${LOCALE_NAMES[next]}`}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Languages className="h-4 w-4" aria-hidden />
        <span>{next === "zh" ? "中文" : "English"}</span>
      </button>
    </form>
  );
}
