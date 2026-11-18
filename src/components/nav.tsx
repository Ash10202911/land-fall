"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, FilePlus2, FileText, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/post", label: "Post", icon: FilePlus2 },
  { href: "/quotes", label: "My Quotes", icon: FileText },
  { href: "/profile", label: "Profile", icon: User },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Logo() {
  return (
    <Link href="/jobs" className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
      <span
        className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-sm font-extrabold text-accent-foreground shadow-lift"
        aria-hidden
      >
        S
      </span>
      Southbound
    </Link>
  );
}

/** Floating pill tab bar on phones. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3 bottom-3 z-20 rounded-2xl border border-white/10 bg-primary/95 shadow-[0_12px_32px_-8px_rgb(17_27_54/0.55)] backdrop-blur md:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-xl grid-cols-4 gap-1 p-1.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] transition-colors",
                  active
                    ? "bg-accent font-semibold text-accent-foreground"
                    : "text-white/65 hover:text-white",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Sticky frosted top bar on desktop; a slim brand bar on phones. */
export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 md:h-16 md:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1 rounded-full bg-muted p-1">
            {items.map(({ href, label }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium transition-colors",
                      active
                        ? "bg-card font-semibold text-foreground shadow-card"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
