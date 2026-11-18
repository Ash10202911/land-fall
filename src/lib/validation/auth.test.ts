import { describe, expect, it } from "vitest";
import { onboardingSchema, profileSchema, safeNextPath, signInSchema } from "./auth";

describe("signInSchema", () => {
  it("normalises a valid email", () => {
    expect(signInSchema.parse({ email: "  Agent@Demo.TEST " }).email).toBe("agent@demo.test");
  });
  it("rejects a bad email", () => {
    expect(signInSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("onboardingSchema", () => {
  it("accepts the three fields", () => {
    const r = onboardingSchema.safeParse({ companyName: "Acme Freight", country: "China", role: "agent" });
    expect(r.success).toBe(true);
  });
  it("rejects an unknown role and a short name", () => {
    expect(onboardingSchema.safeParse({ companyName: "A", country: "China", role: "agent" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ companyName: "Acme", country: "China", role: "admin" }).success).toBe(false);
  });
});

describe("profileSchema", () => {
  it("turns an empty phone into null", () => {
    expect(profileSchema.parse({ fullName: "Li Wei", phone: "" }).phone).toBeNull();
  });
  it("rejects letters in a phone number", () => {
    expect(profileSchema.safeParse({ fullName: "Li Wei", phone: "call me" }).success).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("allows relative paths and blocks open redirects", () => {
    expect(safeNextPath("/jobs/123")).toBe("/jobs/123");
    expect(safeNextPath("//evil.com")).toBe("/jobs");
    expect(safeNextPath("https://evil.com")).toBe("/jobs");
    expect(safeNextPath(null)).toBe("/jobs");
  });
});
