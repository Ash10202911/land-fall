import { FilePlus2, Send } from "lucide-react";
import { setViewMode } from "../mode-actions";
import { getT } from "@/lib/i18n/server";

/**
 * The first screen for everyone: any company can ask for quotes and send quotes, so nobody is sorted by
 * company type. The choice is remembered and can be changed any time with the switch in the header.
 */
export async function ModeChooser() {
  const t = await getT();
  const options = [
    { mode: "requester", icon: FilePlus2, title: t("I need a quote"), body: t("Post a job and compare sealed quotes from forwarders.") },
    { mode: "quoter", icon: Send, title: t("I want to quote"), body: t("Browse open jobs and send a sealed quote.") },
  ] as const;
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("What would you like to do?")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("You can switch any time from the top of the page.")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map(({ mode, icon: Icon, title, body }) => (
          <form key={mode} action={setViewMode.bind(null, mode)}>
            <button
              type="submit"
              className="flex min-h-32 w-full flex-col items-start gap-2 rounded-[22px] border border-border bg-card p-5 text-left shadow-card transition-colors hover:bg-muted/40"
              data-testid={`choose-${mode}`}
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-sea-soft text-sea-ink">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-lg font-bold">{title}</span>
              <span className="text-sm text-muted-foreground">{body}</span>
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
