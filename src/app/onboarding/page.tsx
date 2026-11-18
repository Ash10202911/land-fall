import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Set up your company" };

export default async function OnboardingPage() {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  if (me.company) redirect("/jobs");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <p className="text-2xl font-semibold tracking-tight text-primary">Southbound</p>
      <h1 className="mt-6 text-xl font-semibold">Tell us about your company</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Three quick details. An admin can verify your company later so you can award jobs.
      </p>
      <div className="rounded-lg border border-border bg-card p-5">
        <OnboardingForm />
      </div>
    </main>
  );
}
