import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card p-4 text-card-foreground shadow-card sm:p-5",
        className,
      )}
      {...props}
    />
  );
}

type BadgeTone = "neutral" | "verified" | "warning" | "danger" | "success";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  verified: "bg-accent-soft text-accent",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  success: "bg-success/10 text-success",
};

const dots: Record<BadgeTone, string> = {
  neutral: "bg-muted-foreground/60",
  verified: "bg-accent",
  warning: "bg-warning",
  danger: "bg-destructive",
  success: "bg-success",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className,
      )}
      {...props}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dots[tone])} aria-hidden />
      {children}
    </span>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-input bg-card/60 p-10 text-center">
      <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-accent-soft" aria-hidden />
      <p className="font-semibold">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{body}</p> : null}
    </div>
  );
}
