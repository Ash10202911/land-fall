"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Shown when a page throws on the server or in the browser. Never shows internal details. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Only the digest is logged: it ties to the server log without exposing personal data.
    console.error("[app] page error", error.digest ?? "no-digest");
  }, [error]);

  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col items-start justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        We could not load this page. Your data is safe. Try again, and if it keeps happening, come back in a few
        minutes.
      </p>
      {error.digest ? <p className="text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
        <Link href="/jobs" className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium">
          Go to jobs
        </Link>
      </div>
    </main>
  );
}
