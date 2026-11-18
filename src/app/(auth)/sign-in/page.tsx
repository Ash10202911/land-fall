import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const me = await getMe();
  if (me) redirect(me.company ? "/jobs" : "/onboarding");
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8">
        <p className="text-2xl font-semibold tracking-tight text-primary">Southbound</p>
        <p className="mt-2 text-muted-foreground">
          Sealed freight quotes for overseas agents and Australian and New Zealand forwarders.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <h1 className="mb-4 text-lg font-semibold">Sign in</h1>
        {error ? (
          <p role="alert" className="mb-4 text-sm text-destructive">
            That sign-in link did not work or has expired. Request a new one below.
          </p>
        ) : null}
        <SignInForm />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        No password needed. New here? Enter your email and we will set you up.
      </p>
    </main>
  );
}
