"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { setViewMode } from "@/app/(app)/mode-actions";
import { MODE_LABEL, VIEW_MODES, type ViewMode } from "@/lib/mode";
import { cn } from "@/lib/utils";

function Option({ value, active }: { value: ViewMode; active: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="radio"
      aria-checked={active}
      tabIndex={active ? 0 : -1}
      disabled={pending}
      className={cn(
        "min-h-11 rounded-xl px-3 text-sm font-semibold transition-colors sm:px-4",
        active ? "bg-primary text-primary-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
        pending && "opacity-70",
      )}
    >
      {MODE_LABEL[value]}
    </button>
  );
}

/**
 * Segmented Requester / Quoter switch. Each option is a small form posting to a server action, so it
 * works even before the page's JavaScript has loaded. Arrow keys move between the two options.
 */
export function ModeSwitch({ mode }: { mode: ViewMode }) {
  const forms = useRef<Record<ViewMode, HTMLFormElement | null>>({ requester: null, quoter: null });
  return (
    <div
      role="radiogroup"
      aria-label="Working as"
      className="flex rounded-2xl bg-muted p-1"
      onKeyDown={(e) => {
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
          e.preventDefault();
          forms.current[mode === "requester" ? "quoter" : "requester"]?.requestSubmit();
        }
      }}
    >
      {VIEW_MODES.map((m) => (
        <form
          key={m}
          ref={(el) => {
            forms.current[m] = el;
          }}
          action={setViewMode.bind(null, m)}
        >
          <Option value={m} active={m === mode} />
        </form>
      ))}
    </div>
  );
}
