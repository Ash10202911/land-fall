"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/form";

export type Port = { id: number; code: string; name: string; country: string };

function label(p: Port) {
  return `${p.name} (${p.code}), ${p.country}`;
}

/** Typeahead over the seeded port list. Submits the chosen port id in a hidden field. */
export function PortPicker({
  name,
  id,
  ports,
  defaultPortId,
  invalid,
}: {
  name: string;
  id: string;
  ports: Port[];
  defaultPortId?: number | null;
  invalid?: boolean;
}) {
  const listId = useId();
  const initial = ports.find((p) => p.id === defaultPortId) ?? null;
  const [selected, setSelected] = useState<Port | null>(initial);
  const [query, setQuery] = useState(initial ? label(initial) : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || (selected && query === label(selected))) return ports.slice(0, 8);
    return ports
      .filter((p) => `${p.name} ${p.code} ${p.country}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [ports, query, selected]);

  function choose(p: Port) {
    setSelected(p);
    setQuery(label(p));
    setOpen(false);
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid}
        autoComplete="off"
        placeholder="Search by port, code or country"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open && matches[active]) {
            e.preventDefault();
            choose(matches[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-card shadow-sm"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted-foreground">No ports match.</li>
          ) : (
            matches.map((p, i) => (
              <li
                key={p.id}
                role="option"
                aria-selected={selected?.id === p.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(p);
                }}
                className={cn(
                  "min-h-11 cursor-pointer px-3 py-3 text-sm",
                  i === active ? "bg-muted" : "hover:bg-muted",
                )}
              >
                {label(p)}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
