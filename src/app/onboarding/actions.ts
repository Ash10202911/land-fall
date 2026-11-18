"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, onboardingSchema, type FormState } from "@/lib/validation/auth";

export async function completeOnboarding(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = onboardingSchema.safeParse({
    companyName: formData.get("companyName"),
    country: formData.get("country"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("onboard", {
    p_company_name: parsed.data.companyName,
    p_country: parsed.data.country,
    p_role: parsed.data.role,
  });
  if (error) {
    if (error.code === "23505") redirect("/jobs"); // already onboarded
    return { message: "We could not create your company. Please try again." };
  }
  redirect("/jobs");
}
