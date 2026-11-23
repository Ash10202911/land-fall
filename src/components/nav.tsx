"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Briefcase, FilePlus2, FileText, Inbox, User, type LucideIcon } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { LanguageToggle } from "@/components/language-toggle";
import { ModeSwitch } from "@/components/mode-switch";
import { navItemsFor, type NavIcon, type ViewMode } from "@/lib/mode";
import { cn } from "@/lib/utils";

const ICONS: Record<NavIcon, LucideIcon> = {
  requests: Inbox,
  request: FilePlus2,
  board: Briefcase,
  quotes: FileText,
  lanes: Bell,
  profile: User,
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Logo() {
  const t = useT();
  return (
    <Link href="/jobs" className="flex shrink-0 items-center gap-2.5 text-lg font-bold tracking-tight" aria-label={t("Southbound home")}>
      <span
        className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-sm font-extrabold text-primary-foreground shadow-card"
        aria-hidden
      >
        S
      </span>
      <span className="hidden sm:inline">Southbound</span>
    </Link>
  );
}

/** Floating pill tab bar on phones. */
export function BottomNav({ mode }: { mode: ViewMode }) {
  const t = useT();
  const pathname = usePathname();
  const items = navItemsFor(mode);
  return (
    <nav
      aria-label={t("Main")}
      className="fixed inset-x-3 bottom-3 z-20 rounded-2xl border border-white/10 bg-primary/95 shadow-[0_12px_32px_-8px_rgb(12_74_110/0.55)] backdrop-blur md:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-xl gap-1 p-1.5" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ href, label, icon }) => {
          const active = isActive(pathname, href);
          const Icon = ICONS[icon];
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] transition-colors",
                  active ? "bg-accent-soft font-semibold text-primary" : "text-white/80 hover:text-white",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {t(label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Sticky frosted top bar with the Requester / Quoter switch on every screen size. */
export function TopNav({ mode }: { mode: ViewMode }) {
  const t = useT();
  const pathname = usePathname();
  const items = navItemsFor(mode);
  return (
    <header className="sticky top-0 z-10 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
        <Logo />
        <ModeSwitch mode={mode} />
        <nav aria-label={t("Sections")} className="hidden md:block">
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
                    {t(label)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <LanguageToggle />
      </div>
    </header>
  );
}
