import { describe, expect, it } from "vitest";
import { checkJobDates, jobSchema } from "./job";

const base = {
  direction: "import",
  incoterm: "FOB",
  mode: "FCL",
  originPortId: "1",
  destinationPortId: "2",
  containerType: "40HC",
  containerQty: "2",
  cargoDescription: "Furniture",
  readyDate: "2026-07-01",
  services: [],
  flagDg: false,
  flagReefer: false,
  flagBmsb: false,
  deadlineDate: "2026-06-20",
  deadlineTime: "09:00",
};

describe("jobSchema", () => {
  it("accepts a valid FCL job", () => {
    expect(jobSchema.safeParse(base).success).toBe(true);
  });
  it("requires container details for FCL", () => {
    const r = jobSchema.safeParse({ ...base, containerType: "", containerQty: "" });
    expect(r.success).toBe(false);
  });
  it("requires weight and volume for LCL and Air", () => {
    expect(jobSchema.safeParse({ ...base, mode: "LCL" }).success).toBe(false);
    expect(jobSchema.safeParse({ ...base, mode: "Air", weightKg: "420.5", volumeCbm: "2.1" }).success).toBe(true);
  });
  it("rejects identical origin and destination", () => {
    expect(jobSchema.safeParse({ ...base, destinationPortId: "1" }).success).toBe(false);
  });
  it("rejects unknown services and incoterms", () => {
    expect(jobSchema.safeParse({ ...base, services: ["teleport"] }).success).toBe(false);
    expect(jobSchema.safeParse({ ...base, incoterm: "XYZ" }).success).toBe(false);
  });
});

describe("checkJobDates", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  it("rejects a deadline in the past", () => {
    const errors = checkJobDates({ ...base, deadlineDate: "2026-05-31", deadlineTime: "23:00" }, now);
    expect(errors.deadlineDate).toMatch(/future/);
  });
  it("accepts a future deadline", () => {
    expect(checkJobDates(base, now)).toEqual({});
  });
});
