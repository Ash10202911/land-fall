import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-card hover:bg-primary/90",
        accent: "bg-accent text-accent-foreground shadow-card hover:bg-accent/90 hover:shadow-lift",
        outline: "border border-input bg-card text-foreground hover:border-accent/50 hover:bg-accent-soft",
        ghost: "text-foreground hover:bg-muted",
        destructive: "bg-destructive text-white shadow-card hover:bg-destructive/90",
      },
      size: {
        default: "",
        sm: "min-h-11 px-3",
        full: "w-full",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
