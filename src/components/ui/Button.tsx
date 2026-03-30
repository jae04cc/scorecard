"use client";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed select-none";

    const variants = {
      primary: "bg-accent text-white shadow-lg shadow-accent/20",
      secondary: "bg-surface-elevated text-slate-100 border border-slate-600",
      ghost: "bg-transparent text-slate-300",
      danger: "bg-danger/10 text-danger border border-danger/30",
      success: "bg-success/10 text-success border border-success/30",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm gap-1.5 min-h-[36px]",
      md: "px-5 py-2.5 text-base gap-2 min-h-[44px]",
      lg: "px-6 py-3.5 text-lg gap-2 min-h-[52px] w-full",
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
