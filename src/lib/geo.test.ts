import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PORT_COORDS, flagFor, routeGeometry } from "./geo";
import { scopeFor } from "./scope";

describe("route maps", () => {
  it("has coordinates for every port in the reference data migration", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261119000300_ports_reference_data.sql"), "utf8");
    const codes = [...sql.matchAll(/\('([A-Z]{5})',/g)].map((m) => m[1]);
    expect(codes.length).toBeGreaterThanOrEqual(43);
    expect(codes.filter((c) => !PORT_COORDS[c])).toEqual([]);
  });

  it("frames a route to the requested aspect ratio with both ends inside", () => {
    const g = routeGeometry("CNSZX", "AUSYD", 3)!;
    const [, , w, h] = g.viewBox.split(" ").map(Number);
    // The view box is rounded to 0.01 degrees, so the ratio is exact to about 3 decimal places.
    expect(w / h).toBeCloseTo(3, 3);
    for (const p of [g.origin, g.destination]) {
      expect(p.px).toBeGreaterThan(0);
      expect(p.px).toBeLessThan(100);
      expect(p.py).toBeGreaterThan(0);
      expect(p.py).toBeLessThan(100);
    }
  });

  it("crosses the Pacific the short way", () => {
    const g = routeGeometry("USLAX", "AUBNE", 3)!;
    expect(Math.abs(g.origin.x - g.destination.x)).toBeLessThan(180);
  });

  it("returns null for an unknown port and an empty flag for an unknown country", () => {
    expect(routeGeometry("XXXXX", "AUSYD", 3)).toBeNull();
    expect(flagFor("Atlantis")).toBe("");
    expect(flagFor("Australia")).toBe("🇦🇺");
  });
});

describe("scope of work", () => {
  const all = ["destination_charges", "customs_clearance", "delivery"];

  it("CIF and CFR jobs are destination only", () => {
    for (const term of ["CIF", "CFR", "CPT", "CIP"]) {
      const s = scopeFor(term, all);
      expect(s.summary).toBe("Destination only");
      expect(s.legs.filter((l) => l.on).map((l) => l.key)).toEqual(["destination", "customs", "delivery"]);
    }
  });

  it("FOB adds the main freight, EXW adds pickup too", () => {
    expect(scopeFor("FOB", all).summary).toBe("Freight + destination");
    expect(scopeFor("EXW", all).summary).toBe("Door to door");
    expect(scopeFor("EXW", all).legs.every((l) => l.on)).toBe(true);
  });

  it("follows the ticked services on the destination side", () => {
    const s = scopeFor("CIF", ["customs_clearance"]);
    expect(s.legs.map((l) => l.on)).toEqual([false, false, false, true, false]);
    expect(scopeFor("FOB", []).summary).toBe("Freight only");
    expect(scopeFor("DDP", []).summary).toBe("Nothing to price yet");
  });
});
