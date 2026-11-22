import type { SERVICES } from "@/lib/domain";

type Service = (typeof SERVICES)[number];

export type LegKey = "pickup" | "freight" | "destination" | "customs" | "delivery";
export type Leg = { key: LegKey; label: string; on: boolean };

/** Incoterms where the buyer's forwarder collects the cargo at the seller's premises. */
const PICKUP = new Set(["EXW"]);
/** Incoterms where the buyer's forwarder arranges the main freight. */
const FREIGHT = new Set(["EXW", "FCA", "FAS", "FOB"]);

/**
 * What a quoting forwarder is asked to price. The origin side comes from the Incoterm; the destination
 * side comes from the services the requester ticked.
 */
export function scopeFor(incoterm: string, services: readonly (Service | string)[]): { legs: Leg[]; summary: string } {
  const has = (s: Service) => services.includes(s);
  const legs: Leg[] = [
    { key: "pickup", label: "Pickup", on: PICKUP.has(incoterm) },
    { key: "freight", label: "Freight", on: FREIGHT.has(incoterm) },
    { key: "destination", label: "Dest.", on: has("destination_charges") },
    { key: "customs", label: "Customs", on: has("customs_clearance") },
    { key: "delivery", label: "Delivery", on: has("delivery") },
  ];
  const origin = legs[0].on || legs[1].on;
  const dest = legs.slice(2).some((l) => l.on);
  const summary = legs[0].on && dest
    ? "Door to door"
    : !origin && dest
      ? "Destination only"
      : origin && dest
        ? "Freight + destination"
        : origin
          ? "Freight only"
          : "Nothing to price yet";
  return { legs, summary };
}

export const UNLOAD_TYPES = ["forklift", "tailgate", "side_loader", "dock", "customer_unpacks"] as const;
export const UNLOAD_LABELS: Record<(typeof UNLOAD_TYPES)[number], string> = {
  forklift: "Forklift on site",
  tailgate: "Tailgate truck",
  side_loader: "Side-loader",
  dock: "Dock",
  customer_unpacks: "We unpack",
};

export const REPEAT_FREQUENCIES = ["one_off", "weekly", "monthly", "quarterly"] as const;
export const REPEAT_LABELS: Record<(typeof REPEAT_FREQUENCIES)[number], string> = {
  one_off: "One-off",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};
