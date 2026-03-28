import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "accent";
}

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  const variants = {
    default: "bg-slate-700 text-slate-300",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-danger/15 text-danger",
    accent: "bg-accent/15 text-accent-light",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
