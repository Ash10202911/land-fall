import { z } from "zod";

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter your email address")
    .max(254, "That email address is too long")
    .pipe(z.email("Enter a valid email address")),
});

/**
 * A company website. People type "acme.com" as often as "https://acme.com", so a missing scheme is added.
 * Only http and https, a real-looking host, no spaces. Returns the cleaned address.
 */
export const websiteSchema = z
  .string()
  .trim()
  .min(1, "Enter your company website")
  .max(200, "That website address is too long")
  .transform((value, ctx) => {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    try {
      const url = new URL(withScheme);
      const host = url.hostname;
      if ((url.protocol !== "https:" && url.protocol !== "http:") || !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(host)) throw new Error("bad");
      return `${url.protocol}//${host}${url.pathname === "/" ? "" : url.pathname}${url.search}`.slice(0, 200);
    } catch {
      ctx.addIssue({ code: "custom", message: "Enter a website such as acme.com" });
      return z.NEVER;
    }
  });

export const onboardingSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, "Company name must be at least 2 characters")
    .max(120, "Company name must be 120 characters or fewer"),
  country: z
    .string()
    .trim()
    .min(2, "Enter your country")
    .max(80, "Country must be 80 characters or fewer"),
  role: z.enum(["agent", "forwarder"], { error: "Choose agent or forwarder" }),
  website: websiteSchema,
});

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name")
    .max(120, "Name must be 120 characters or fewer"),
  phone: z
    .string()
    .trim()
    .max(40, "Phone must be 40 characters or fewer")
    .regex(/^[0-9+()\-.\s]*$/, "Use digits, spaces, + and - only")
    .optional()
    .transform((v) => (v ? v : null)),
});

/** Only allow same-site relative paths after sign-in. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/jobs";
  }
  return next;
}

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
};

/** Flattens Zod issues to {field: first message}. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
