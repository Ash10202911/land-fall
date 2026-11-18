"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

const schema = z.object({
  companyId: z.uuid(),
  trustLevel: z.enum(["basic", "verified"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

/** Changes a company's trust level or status. The database also requires is_admin (SEC-6). */
export async function updateCompany(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = schema.safeParse({
    companyId: formData.get("companyId"),
    trustLevel: formData.get("trustLevel") ?? undefined,
    status: formData.get("status") ?? undefined,
  });
  if (!parsed.success) return;

  const patch: { trust_level?: string; status?: string } = {};
  if (parsed.data.trustLevel) patch.trust_level = parsed.data.trustLevel;
  if (parsed.data.status) patch.status = parsed.data.status;
  if (Object.keys(patch).length === 0) return;

  const supabase = await createClient();
  await supabase.from("companies").update(patch).eq("id", parsed.data.companyId);
  revalidatePath("/admin");
}
