import Link from "next/link";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col items-start justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">That page does not exist, or you do not have access to it.</p>
      <Link href="/jobs" className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium">
        Go to jobs
      </Link>
    </main>
  );
}
