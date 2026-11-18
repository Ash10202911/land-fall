import { describe, expect, it } from "vitest";
import { demoKeyMatches, isDemoEmail } from "./demo-login";

describe("demo login guards", () => {
  it("only allows reserved test-domain emails", () => {
    expect(isDemoEmail("test.harbour@example.test")).toBe(true);
    expect(isDemoEmail("support@countex.ai")).toBe(false);
    expect(isDemoEmail("@example.test")).toBe(false);
    expect(isDemoEmail("x@example.test.evil.com")).toBe(false);
    expect(isDemoEmail(undefined)).toBe(false);
  });

  it("is disabled unless a long key is configured", () => {
    expect(demoKeyMatches("anything", undefined)).toBe(false);
    expect(demoKeyMatches("short", "short")).toBe(false);
    expect(demoKeyMatches(null, "a-long-enough-secret-key")).toBe(false);
  });

  it("matches only the exact key", () => {
    const key = "a-long-enough-secret-key";
    expect(demoKeyMatches(key, key)).toBe(true);
    expect(demoKeyMatches(`${key}x`, key)).toBe(false);
    expect(demoKeyMatches("b-long-enough-secret-key", key)).toBe(false);
  });
});
