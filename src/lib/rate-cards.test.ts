import { describe, expect, it } from "vitest";
import { MAX_RATE_ROWS, rateCardSchema, rateRowSchema, rowsToRpc, checkValidTo } from "./validation/rate-card";
import { SHEET_TEMPLATE, parseCsv, parseRateSheet } from "./rate-sheet";
import { buildQuoteFromRateCard, pickRateCard, type ChargeRow, type QuoteJob, type RateCard } from "./rate-cards";

const row = (over: Partial<ChargeRow> & { name: string }): ChargeRow => ({
  position: 0,
  kind: "charge",
  category: "destination",
  basis: "per_job",
  amount_minor: 10000,
  gst_included: true,
  postcode_from: null,
  postcode_to: null,
  unload_type: null,
  ...over,
});

const card: RateCard = {
  id: "c1",
  name: "Port Botany",
  currency: "AUD",
  valid_to: "2026-12-31",
  destination_code: "AUSYD",
  charges: [
    row({ position: 0, name: "Port service charge (THC)", basis: "per_40ft", amount_minor: 16500 }),
    row({ position: 1, name: "Delivery order fee", amount_minor: 9500 }),
    row({ position: 2, name: "Customs entry", category: "customs", amount_minor: 12000 }),
    row({ position: 3, name: "Zone 1 inner metro", kind: "zone", category: "delivery", basis: "per_container", amount_minor: 42000, postcode_from: 2000, postcode_to: 2050 }),
    row({ position: 4, name: "Zone 2 western Sydney", kind: "zone", category: "delivery", basis: "per_container", amount_minor: 56000, postcode_from: 2140, postcode_to: 2170 }),
    row({ position: 5, name: "Side-loader", category: "delivery", basis: "per_container", amount_minor: 8000, unload_type: "side_loader" }),
    row({ position: 6, name: "Tailgate truck", category: "delivery", basis: "per_container", amount_minor: 4500, unload_type: "tailgate" }),
  ],
};

const job: QuoteJob = {
  mode: "FCL",
  container_type: "40HC",
  container_qty: 2,
  weight_kg: null,
  volume_cbm: null,
  services: ["destination_charges", "customs_clearance", "delivery"],
  unload_type: "side_loader",
  delivery_suburb: "Wetherill Park NSW",
  delivery_postcode: "2164",
  destination_code: "AUSYD",
};

describe("buildQuoteFromRateCard", () => {
  it("prices a full job: per-container charges, the matching zone and the matching unload rule", () => {
    const r = buildQuoteFromRateCard(card, job);
    expect(r.lines.map((l) => [l.chargeName, l.amount])).toEqual([
      ["Port service charge (THC) · 2 × $165.00", "330.00"],
      ["Delivery order fee", "95.00"],
      ["Customs entry", "120.00"],
      ["Cartage to Wetherill Park NSW · 2 × $560.00", "1120.00"],
      ["Side-loader · 2 × $80.00", "160.00"],
    ]);
    expect(r.totalMinor).toBe(33000 + 9500 + 12000 + 112000 + 16000);
    expect(r.warnings).toEqual([]);
  });

  it("tags where each line came from", () => {
    const sources = buildQuoteFromRateCard(card, job).lines.map((l) => l.source);
    expect(sources).toEqual(["Rate card", "Rate card", "Rate card", "Zone 2 western Sydney · postcode 2164", "Job says Side-loader"]);
  });

  it("only includes charges for the services the job asks for", () => {
    const r = buildQuoteFromRateCard(card, { ...job, services: ["destination_charges"] });
    expect(r.lines.map((l) => l.chargeName)).toEqual(["Port service charge (THC) · 2 × $165.00", "Delivery order fee"]);
    expect(r.warnings).toEqual([]);
  });

  it("skips per-40ft charges on a 20ft job, and per-20ft charges on a 40ft job", () => {
    const small = buildQuoteFromRateCard(card, { ...job, container_type: "20GP", container_qty: 1 });
    expect(small.lines.some((l) => l.chargeName.startsWith("Port service charge"))).toBe(false);
    const twenty = { ...card, charges: [row({ name: "THC 20", basis: "per_20ft", amount_minor: 12000 })] };
    expect(buildQuoteFromRateCard(twenty, job).lines).toEqual([]);
    expect(buildQuoteFromRateCard(twenty, { ...job, container_type: "20GP", container_qty: 3 }).lines[0].amount).toBe("360.00");
  });

  it("uses the unload rule that matches the job and ignores the others", () => {
    const tail = buildQuoteFromRateCard(card, { ...job, unload_type: "tailgate" });
    expect(tail.lines.map((l) => l.chargeName)).toContain("Tailgate truck · 2 × $45.00");
    expect(tail.lines.map((l) => l.chargeName).some((n) => n.startsWith("Side-loader"))).toBe(false);
    const none = buildQuoteFromRateCard(card, { ...job, unload_type: "dock" });
    expect(none.lines.map((l) => l.chargeName).some((n) => /Side-loader|Tailgate/.test(n))).toBe(false);
  });

  it("warns and leaves cartage out when no zone covers the postcode", () => {
    const r = buildQuoteFromRateCard(card, { ...job, delivery_postcode: "2999" });
    expect(r.lines.some((l) => l.chargeName.startsWith("Cartage"))).toBe(false);
    expect(r.warnings[0]).toMatch(/No cartage zone.*2999/);
  });

  it("warns when the job has no postcode or the card has no zones", () => {
    expect(buildQuoteFromRateCard(card, { ...job, delivery_postcode: null }).warnings[0]).toMatch(/no delivery postcode/);
    const noZones = { ...card, charges: card.charges.filter((c) => c.kind !== "zone") };
    expect(buildQuoteFromRateCard(noZones, job).warnings[0]).toMatch(/no cartage zones/);
  });

  it("prices loose cargo by cbm and weight, and rounds to whole cents", () => {
    const loose = {
      ...card,
      charges: [
        row({ name: "Handling", basis: "per_cbm", amount_minor: 3333 }),
        row({ position: 1, name: "Airport fee", basis: "per_kg", amount_minor: 40 }),
        row({ position: 2, name: "Container fee", basis: "per_container", amount_minor: 5000 }),
      ],
    };
    const lcl = buildQuoteFromRateCard(loose, { ...job, mode: "LCL", container_type: null, container_qty: null, weight_kg: "420.5", volume_cbm: "2.1", services: ["destination_charges"] });
    expect(lcl.lines.map((l) => [l.chargeName, l.amount])).toEqual([
      ["Handling · 2.1 cbm × $33.33", "69.99"],
      ["Airport fee · 420.5 kg × $0.40", "168.20"],
    ]);
  });

  it("never returns more than 20 lines and says so", () => {
    const many = { ...card, charges: Array.from({ length: 30 }, (_, i) => row({ position: i, name: `Charge ${i}`, amount_minor: 100 })) };
    const r = buildQuoteFromRateCard(many, job);
    expect(r.lines).toHaveLength(20);
    expect(r.warnings.join(" ")).toMatch(/more than 20/);
  });
});

describe("pickRateCard", () => {
  const cards: RateCard[] = [
    { ...card, id: "old", updated_at: "2026-01-01T00:00:00Z" },
    { ...card, id: "new", updated_at: "2026-06-01T00:00:00Z" },
    { ...card, id: "expired", valid_to: "2026-01-01", updated_at: "2026-09-01T00:00:00Z" },
    { ...card, id: "other-port", destination_code: "AUMEL", updated_at: "2026-10-01T00:00:00Z" },
  ];
  it("takes the newest valid card for the job's port and ignores expired and other-port cards", () => {
    expect(pickRateCard(cards, "AUSYD", "2026-11-23")?.id).toBe("new");
    expect(pickRateCard(cards, "AUFRE", "2026-11-23")).toBeNull();
    expect(pickRateCard(cards.slice(2, 3), "AUSYD", "2026-11-23")).toBeNull();
  });
  it("treats the valid-to day itself as still valid", () => {
    expect(pickRateCard([card], "AUSYD", "2026-12-31")?.id).toBe("c1");
    expect(pickRateCard([card], "AUSYD", "2027-01-01")).toBeNull();
  });
});

describe("rate card validation", () => {
  const goodRow = { kind: "charge", name: "THC", category: "destination", basis: "per_40ft", amount: "165.00", gstIncluded: true };

  it("turns the amount into cents and rejects bad amounts", () => {
    const ok = rateRowSchema.safeParse(goodRow);
    expect(ok.success && ok.data.amount).toBe(16500);
    for (const amount of ["", "0", "-5", "abc", "1,2,3"]) expect(rateRowSchema.safeParse({ ...goodRow, amount }).success).toBe(false);
  });

  it("holds zones to a delivery category with an ordered postcode range", () => {
    const zone = { ...goodRow, kind: "zone", category: "delivery", basis: "per_container", postcodeFrom: "2000", postcodeTo: "2050" };
    expect(rateRowSchema.safeParse(zone).success).toBe(true);
    expect(rateRowSchema.safeParse({ ...zone, category: "customs" }).success).toBe(false);
    expect(rateRowSchema.safeParse({ ...zone, postcodeTo: "1999" }).success).toBe(false);
    expect(rateRowSchema.safeParse({ ...zone, postcodeFrom: "" }).success).toBe(false);
    expect(rateRowSchema.safeParse({ ...zone, unloadType: "tailgate" }).success).toBe(false);
  });

  it("keeps postcodes off charges and unload rules to delivery charges", () => {
    expect(rateRowSchema.safeParse({ ...goodRow, postcodeFrom: "2000", postcodeTo: "2050" }).success).toBe(false);
    expect(rateRowSchema.safeParse({ ...goodRow, unloadType: "tailgate" }).success).toBe(false);
    expect(rateRowSchema.safeParse({ ...goodRow, category: "delivery", unloadType: "tailgate" }).success).toBe(true);
    expect(rateRowSchema.safeParse({ ...goodRow, category: "delivery", unloadType: "crane" }).success).toBe(false);
  });

  const card0 = { name: "Port Botany", destinationPortId: "7", currency: "AUD", validTo: "2026-12-31", rows: [goodRow] };
  it("accepts a whole card and shapes it for the database", () => {
    const r = rateCardSchema.safeParse(card0);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.destinationPortId).toBe(7);
      expect(rowsToRpc(r.data.rows)).toEqual([
        { kind: "charge", name: "THC", category: "destination", basis: "per_40ft", amount_minor: 16500, gst_included: true, postcode_from: null, postcode_to: null, unload_type: null },
      ]);
    }
  });

  it("needs at least one line, at most the limit, and a known currency", () => {
    expect(rateCardSchema.safeParse({ ...card0, rows: [] }).success).toBe(false);
    expect(rateCardSchema.safeParse({ ...card0, rows: Array.from({ length: MAX_RATE_ROWS + 1 }, () => goodRow) }).success).toBe(false);
    expect(rateCardSchema.safeParse({ ...card0, currency: "XXX" }).success).toBe(false);
    expect(rateCardSchema.safeParse({ ...card0, name: "x" }).success).toBe(false);
  });

  it("rejects a valid-to date in the past but allows today", () => {
    const now = new Date("2026-11-23T05:00:00Z");
    expect(checkValidTo("2026-11-22", now)).toMatch(/past/);
    expect(checkValidTo("2026-11-23", now)).toBeNull();
    expect(checkValidTo("nope", now)).toMatch(/valid date/);
  });
});

describe("rate sheet (CSV)", () => {
  it("reads the downloadable template without errors", () => {
    const r = parseRateSheet(SHEET_TEMPLATE);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(7);
    expect(r.rows.filter((x) => x.kind === "zone")).toHaveLength(2);
    const parsed = rateCardSchema.safeParse({ name: "From sheet", destinationPortId: 1, currency: "AUD", validTo: "2026-12-31", rows: r.rows });
    expect(parsed.success).toBe(true);
  });

  it("handles quotes, commas in names, Excel's BOM and semicolon separators", () => {
    const csv = '﻿type;name;category;basis;amount\r\ncharge;"Handling; special";destination;per job;1,50\r\n';
    expect(parseCsv('a,"b,c","d ""x"""\r\n1,2,3')).toEqual([["a", "b,c", 'd "x"'], ["1", "2", "3"]]);
    const semi = parseRateSheet(csv);
    expect(semi.errors).toEqual([]);
    expect(semi.rows[0]).toMatchObject({ name: "Handling; special", basis: "per_job", amount: "1.50" });
    const european = parseRateSheet("type;name;category;basis;amount\ncharge;A;destination;per_job;1.250,50\ncharge;B;destination;per_job;95\n");
    expect(european.rows.map((r) => r.amount)).toEqual(["1250.50", "95"]);
    // In a comma file, a lone decimal comma is ambiguous, so it is rejected rather than guessed.
    const ambiguous = parseRateSheet('type,name,category,basis,amount\ncharge,A,destination,per_job,"1,50"\n');
    expect(ambiguous.errors[0]).toMatch(/Row 2: Enter an amount/);
    const quoted = parseRateSheet('type,name,category,basis,amount\ncharge,"Fee, fixed",customs,per_job,"1,250.50"\n');
    expect(quoted.errors).toEqual([]);
    expect(quoted.rows[0]).toMatchObject({ name: "Fee, fixed", amount: "1,250.50" });
  });

  it("accepts a currency symbol or code in front of the amount, and blank GST as included", () => {
    const r = parseRateSheet("type,name,category,basis,amount\ncharge,A,destination,per_job,$95.00\ncharge,B,destination,per_job,AUD 12.50\n");
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => x.amount)).toEqual(["95.00", "12.50"]);
    expect(r.rows.every((x) => x.gstIncluded === true)).toBe(true);
  });

  it("names the row and the problem, and rejects the whole file", () => {
    const r = parseRateSheet("type,name,category,basis,amount,gst_included\ncharge,Ok,destination,per_job,10,yes\ncharge,Bad,destination,per_banana,10,yes\ncharge,Worse,customs,per_job,abc,maybe\n");
    expect(r.rows).toEqual([]);
    expect(r.errors[0]).toMatch(/^Row 3: .*\(basis\)/);
    expect(r.errors[1]).toMatch(/^Row 4: gst_included must be yes or no/);
  });

  it("explains a missing column, an empty file, a header with no rows and an oversized file", () => {
    expect(parseRateSheet("name,amount\nA,1\n").errors[0]).toMatch(/Missing: type, category, basis/);
    expect(parseRateSheet("").errors[0]).toMatch(/empty/);
    expect(parseRateSheet("type,name,category,basis,amount\n").errors[0]).toMatch(/no charges/);
    expect(parseRateSheet("x".repeat(100_001)).errors[0]).toMatch(/too large/);
    const many = `type,name,category,basis,amount\n${"charge,A,destination,per_job,1\n".repeat(41)}`;
    expect(parseRateSheet(many).errors[0]).toMatch(/at most 40/);
  });

  it("checks zone rows too", () => {
    const r = parseRateSheet("type,name,category,basis,amount,from_postcode,to_postcode\nzone,Z,delivery,per_container,100,2100,2000\n");
    expect(r.errors[0]).toMatch(/Row 2: .*to postcode/i);
  });

  it("limits how many errors it lists", () => {
    const bad = `type,name,category,basis,amount\n${"charge,A,destination,per_job,abc\n".repeat(15)}`;
    const r = parseRateSheet(bad);
    expect(r.errors).toHaveLength(11);
    expect(r.errors[10]).toMatch(/And 5 more/);
  });
});
