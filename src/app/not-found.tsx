import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Not found" };

export default async function NotFound() {
  const t = await getT();
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col items-start justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold">{t("Page not found")}</h1>
      <p className="text-sm text-muted-foreground">{t("That page does not exist, or you do not have access to it.")}</p>
      <Link href="/jobs" className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium">
        {t("Go to jobs")}
      </Link>
    </main>
  );
}
