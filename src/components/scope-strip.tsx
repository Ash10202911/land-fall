"use client";

import { Anchor, FileCheck2, MapPin, Plane, Ship, Truck, type LucideIcon } from "lucide-react";
import type { Leg, LegKey } from "@/lib/scope";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

const ICON: Record<LegKey, LucideIcon> = {
  pickup: Truck,
  freight: Ship,
  destination: Anchor,
  customs: FileCheck2,
  delivery: MapPin,
};

/**
 * The five legs of a job, lit when the forwarder prices them. With `onToggle`, the destination legs
 * become buttons (used on the request form); the origin legs follow the Incoterm and stay fixed.
 */
export function ScopeStrip({
  legs,
  air = false,
  onToggle,
  compact = false,
}: {
  legs: Leg[];
  air?: boolean;
  onToggle?: (key: LegKey) => void;
  compact?: boolean;
}) {
  const t = useT();
  return (
    <ul className="grid grid-cols-5 gap-1.5" aria-label={t("What the forwarder prices")}>
      {legs.map((leg) => {
        const Icon = leg.key === "freight" && air ? Plane : ICON[leg.key];
        const fixed = leg.key === "pickup" || leg.key === "freight";
        const tile = cn(
          "grid w-full place-items-center rounded-xl border-2",
          compact ? "h-9" : "h-10",
          leg.on
            ? air
              ? "border-air bg-air-soft text-air-ink"
              : "border-sea bg-sea-soft text-sea-ink"
            : "border-dashed border-input bg-muted/40 text-muted-foreground/70",
        );
        const label = cn(
          "text-[11px] leading-none",
          leg.on ? "font-bold text-foreground" : "font-medium text-muted-foreground line-through",
        );
        const content = (
          <>
            <span className={tile} aria-hidden>
              <Icon className="h-5 w-5" />
            </span>
            <span className={label}>{leg.label}</span>
          </>
        );
        return (
          <li key={leg.key} className="min-w-0">
            {onToggle && !fixed ? (
              <button
                type="button"
                onClick={() => onToggle(leg.key)}
                aria-pressed={leg.on}
                className="flex min-h-11 w-full flex-col items-center gap-1"
              >
                {content}
                <span className="sr-only">{leg.on ? "included, tap to remove" : "not included, tap to add"}</span>
              </button>
            ) : (
              <div className="flex flex-col items-center gap-1">
                {content}
                <span className="sr-only">{leg.on ? "you price this" : "not needed"}</span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
