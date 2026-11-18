"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { notifyAward } from "@/lib/notifications";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Awards one quote. The database enforces who may do this (SEC-3); this only reports the outcome. */
export async function awardQuote(jobId: string, quoteId: string): Promise<void> {
  await requireMember();
  if (!UUID.test(jobId) || !UUID.test(quoteId)) redirect("/jobs");

  const supabase = await createClient();
  const { error } = await supabase.rpc("award_quote", { p_quote_id: quoteId });
  if (error) {
    const reason = /verified/i.test(error.message)
      ? "unverified"
      : /suspended/i.test(error.message)
        ? "suspended"
        : "failed";
    redirect(`/jobs/${jobId}?award_error=${reason}`);
  }

  await notifyAward({ jobId, winningQuoteId: quoteId });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/quotes");
  revalidatePath("/jobs");
  redirect(`/jobs/${jobId}`);
}
