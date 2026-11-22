import { describe, expect, it } from "vitest";
import { checkJobDates, deadlineFor, jobSchema } from "./job";

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
  it("uses the quote window preset when there is no custom date", () => {
    const noDate = { ...base, deadlineDate: undefined, deadlineTime: undefined };
    expect(deadlineFor({ ...noDate, closeIn: "48" }, now).toISOString()).toBe("2026-06-03T00:00:00.000Z");
    expect(deadlineFor({}, now).toISOString()).toBe("2026-06-03T00:00:00.000Z");
    expect(deadlineFor({ ...noDate, closeIn: "168" }, now).toISOString()).toBe("2026-06-08T00:00:00.000Z");
    expect(checkJobDates({ ...noDate, closeIn: "24" }, now)).toEqual({});
  });
});

describe("v2 job fields", () => {
  const delivery = { ...base, services: ["delivery"] };

  it("requires suburb, postcode and unload type when delivery is ticked", () => {
    const r = jobSchema.safeParse(delivery);
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["deliverySuburb", "deliveryPostcode", "unloadType"]));
    const ok = jobSchema.safeParse({ ...delivery, deliverySuburb: "Wetherill Park NSW", deliveryPostcode: "2164", unloadType: "side_loader" });
    expect(ok.success).toBe(true);
  });

  it("rejects a bad postcode, an unknown unload type and a needed-by date before the ready date", () => {
    const good = { ...delivery, deliverySuburb: "Wetherill Park NSW", deliveryPostcode: "2164", unloadType: "side_loader" };
    expect(jobSchema.safeParse({ ...good, deliveryPostcode: "216" }).success).toBe(false);
    expect(jobSchema.safeParse({ ...good, unloadType: "crane" }).success).toBe(false);
    expect(jobSchema.safeParse({ ...good, requiredBy: "2026-06-30" }).success).toBe(false);
    expect(jobSchema.safeParse({ ...good, requiredBy: "2026-07-01" }).success).toBe(true);
  });

  it("defaults to a one-off job and accepts regular work with a volume", () => {
    const r = jobSchema.safeParse(base);
    expect(r.success && r.data.repeatFrequency).toBe("one_off");
    expect(jobSchema.safeParse({ ...base, repeatFrequency: "monthly", repeatVolume: "About 4 x 40HC" }).success).toBe(true);
    expect(jobSchema.safeParse({ ...base, repeatFrequency: "daily" }).success).toBe(false);
  });

  it("needs a date and time for a custom quote window", () => {
    const noDate = { ...base, deadlineDate: undefined, deadlineTime: undefined };
    expect(jobSchema.safeParse({ ...noDate, closeIn: "custom" }).success).toBe(false);
    expect(jobSchema.safeParse({ ...noDate, closeIn: "72" }).success).toBe(true);
    expect(jobSchema.safeParse({ ...noDate, closeIn: "5" }).success).toBe(false);
  });
});
