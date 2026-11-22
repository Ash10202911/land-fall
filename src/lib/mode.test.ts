import { describe, expect, it } from "vitest";
import { defaultModeFor, isNewJob, navItemsFor, parseMode, parseSeen, resolveMode } from "./mode";

describe("view mode", () => {
  it("accepts only requester or quoter", () => {
    expect(parseMode("requester")).toBe("requester");
    expect(parseMode("quoter")).toBe("quoter");
    for (const bad of ["Requester", "admin", "", undefined, null, 1, "quoter;"]) {
      expect(parseMode(bad)).toBeNull();
    }
  });

  it("defaults agents to Requester and forwarders to Quoter", () => {
    expect(defaultModeFor("agent")).toBe("requester");
    expect(defaultModeFor("forwarder")).toBe("quoter");
  });

  it("lets a saved choice win over the default, and ignores a bad cookie", () => {
    expect(resolveMode("quoter", "agent")).toBe("quoter");
    expect(resolveMode("requester", "forwarder")).toBe("requester");
    expect(resolveMode("garbage", "agent")).toBe("requester");
    expect(resolveMode(undefined, "forwarder")).toBe("quoter");
  });

  it("gives each mode its own menu", () => {
    expect(navItemsFor("requester").map((i) => [i.label, i.href])).toEqual([
      ["My requests", "/jobs"],
      ["Request quote", "/post"],
      ["Profile", "/profile"],
    ]);
    expect(navItemsFor("quoter").map((i) => [i.label, i.href])).toEqual([
      ["Job board", "/jobs"],
      ["My quotes", "/quotes"],
      ["Profile", "/profile"],
    ]);
  });
});

describe("new since last visit", () => {
  const now = new Date("2026-11-22T10:00:00Z");

  it("parses only a valid ISO timestamp", () => {
    expect(parseSeen("2026-11-22T09:00:00.000Z")?.toISOString()).toBe("2026-11-22T09:00:00.000Z");
    expect(parseSeen("yesterday")).toBeNull();
    expect(parseSeen(undefined)).toBeNull();
  });

  it("marks jobs posted after the last visit as new", () => {
    const seen = new Date("2026-11-22T08:00:00Z");
    expect(isNewJob("2026-11-22T09:00:00Z", seen, now)).toBe(true);
    expect(isNewJob("2026-11-22T07:00:00Z", seen, now)).toBe(false);
  });

  it("falls back to the last 24 hours when there is no visit saved", () => {
    expect(isNewJob("2026-11-21T12:00:00Z", null, now)).toBe(true);
    expect(isNewJob("2026-11-20T12:00:00Z", null, now)).toBe(false);
  });
});
