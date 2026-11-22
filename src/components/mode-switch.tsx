"use client";

import { useTransition } from "react";
import { setViewMode } from "@/app/(app)/mode-actions";
import { MODE_LABEL, VIEW_MODES, type ViewMode } from "@/lib/mode";
import { cn } from "@/lib/utils";

/** Segmented Requester / Quoter switch. Arrow keys move between the two options. */
export function ModeSwitch({ mode }: { mode: ViewMode }) {
  const [pending, startTransition] = useTransition();
  const choose = (next: ViewMode) => {
    if (next === mode || pending) return;
    startTransition(() => setViewMode(next));
  };

  return (
    <div
      role="radiogroup"
      aria-label="Working as"
      aria-busy={pending || undefined}
      className={cn("flex rounded-2xl bg-muted p-1", pending && "opacity-70")}
      onKeyDown={(e) => {
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
          e.preventDefault();
          choose(mode === "requester" ? "quoter" : "requester");
        }
      }}
    >
      {VIEW_MODES.map((m) => {
        const active = m === mode;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => choose(m)}
            className={cn(
              "min-h-11 rounded-xl px-3 text-sm font-semibold transition-colors sm:px-4",
              active ? "bg-primary text-primary-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {MODE_LABEL[m]}
          </button>
        );
      })}
    </div>
  );
}
