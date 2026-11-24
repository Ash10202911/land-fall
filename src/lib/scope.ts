import type { SERVICES } from "@/lib/domain";
import { msg } from "@/lib/i18n";

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
    { key: "pickup", label: msg("Pickup"), on: PICKUP.has(incoterm) },
    { key: "freight", label: msg("Freight"), on: FREIGHT.has(incoterm) },
    { key: "destination", label: msg("Dest."), on: has("destination_charges") },
    { key: "customs", label: msg("Customs"), on: has("customs_clearance") },
    { key: "delivery", label: msg("Delivery"), on: has("delivery") },
  ];
  const origin = legs[0].on || legs[1].on;
  const dest = legs.slice(2).some((l) => l.on);
  const summary = legs[0].on && dest
    ? msg("Door to door")
    : !origin && dest
      ? msg("Destination only")
      : origin && dest
        ? msg("Freight + destination")
        : origin
          ? msg("Freight only")
          : msg("Nothing to price yet");
  return { legs, summary };
}

export const UNLOAD_TYPES = ["forklift", "tailgate", "side_loader", "dock", "customer_unpacks"] as const;
export const UNLOAD_LABELS: Record<(typeof UNLOAD_TYPES)[number], string> = {
  forklift: msg("Forklift on site"),
  tailgate: msg("Tailgate truck"),
  side_loader: msg("Side-loader"),
  dock: msg("Dock"),
  customer_unpacks: msg("We unpack"),
};

export const REPEAT_FREQUENCIES = ["one_off", "weekly", "monthly", "quarterly"] as const;
export const REPEAT_LABELS: Record<(typeof REPEAT_FREQUENCIES)[number], string> = {
  one_off: msg("One-off"),
  weekly: msg("Weekly"),
  monthly: msg("Monthly"),
  quarterly: msg("Quarterly"),
};
