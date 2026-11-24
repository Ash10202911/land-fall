import { describe, expect, it } from "vitest";
import { onboardingSchema, profileSchema, safeNextPath, signInSchema, websiteSchema } from "./auth";

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
    const r = onboardingSchema.safeParse({ companyName: "Acme Freight", country: "China", role: "agent", website: "acme.com" });
    expect(r.success).toBe(true);
  });
  it("rejects an unknown role and a short name", () => {
    const ok = { country: "China", website: "acme.com" };
    expect(onboardingSchema.safeParse({ ...ok, companyName: "A", role: "agent" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...ok, companyName: "Acme", role: "admin" }).success).toBe(false);
  });
  it("needs a website", () => {
    expect(onboardingSchema.safeParse({ companyName: "Acme", country: "China", role: "agent" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ companyName: "Acme", country: "China", role: "agent", website: "  " }).success).toBe(false);
  });
});

describe("websiteSchema", () => {
  it("adds https when the scheme is missing and keeps the path", () => {
    expect(websiteSchema.parse("acme.com")).toBe("https://acme.com");
    expect(websiteSchema.parse("  WWW.Acme-Freight.com.au/about ")).toBe("https://www.acme-freight.com.au/about");
    expect(websiteSchema.parse("http://acme.cn")).toBe("http://acme.cn");
  });
  it("rejects things that are not a website", () => {
    for (const bad of ["acme", "not a website", "javascript:alert(1)", "ftp://acme.com", "https://", "a b.com", "localhost", "https://192.168.0.1"]) {
      expect(websiteSchema.safeParse(bad).success, bad).toBe(false);
    }
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
