"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { notifyAward } from "@/lib/notifications";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const streetSchema = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().min(3).max(200).optional(),
);

/**
 * Awards one quote and, when the job asks for delivery, stores the street address in the same
 * transaction. The database enforces who may award (SEC-3) and who may read the address.
 */
export async function awardQuote(jobId: string, quoteId: string, formData: FormData): Promise<void> {
  await requireMember();
  if (!UUID.test(jobId) || !UUID.test(quoteId)) redirect("/jobs");

  const street = streetSchema.safeParse(formData.get("street") ?? undefined);
  if (!street.success) redirect(`/jobs/${jobId}?award_error=address`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("award_quote_with_address", {
    p_quote_id: quoteId,
    p_street: street.data ?? null,
  });
  if (error) {
    const reason = /verified/i.test(error.message)
      ? "unverified"
      : /suspended/i.test(error.message)
        ? "suspended"
        : /street address/i.test(error.message)
          ? "address"
          : "failed";
    redirect(`/jobs/${jobId}?award_error=${reason}`);
  }

  await notifyAward({ jobId, winningQuoteId: quoteId });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/quotes");
  revalidatePath("/jobs");
  redirect(`/jobs/${jobId}`);
}
