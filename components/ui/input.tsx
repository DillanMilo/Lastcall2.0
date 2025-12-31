import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, icon, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            "flex h-11 w-full rounded-lg border bg-background px-4 py-2 text-base sm:text-sm transition-all duration-200",
            "placeholder:text-muted-foreground/60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium",
            // Touch-friendly sizing
            "touch-manipulation",
            // Prevent iOS zoom on focus (font-size >= 16px)
            "[font-size:max(16px,1rem)] sm:[font-size:0.875rem]",
            icon && "pl-10",
            error
              ? "border-destructive focus-visible:ring-destructive"
              : "border-input hover:border-muted-foreground/30",
            className
          )}
          ref={ref}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
