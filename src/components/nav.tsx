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

/** Bottom tab bar on phones. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card md:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs",
                  active ? "font-semibold text-accent" : "text-muted-foreground",
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

/** Simple top nav on desktop. */
export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="hidden border-b border-border bg-primary text-primary-foreground md:block">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/jobs" className="text-lg font-semibold tracking-tight">
          Southbound
        </Link>
        <nav aria-label="Main">
          <ul className="flex items-center gap-1">
            {items.map(({ href, label }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-md px-3 text-sm",
                      active ? "bg-white/15 font-semibold" : "text-white/80 hover:bg-white/10",
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
