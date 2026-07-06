import * as React from "react";
import { cn } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  src?: string | null;
  fallback?: string;
  size?: "sm" | "md" | "lg";
}

const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, src, fallback, size = "md", ...props }, ref) => {
    const [error, setError] = React.useState(false);
    const initials = fallback
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return (
      <span
        ref={ref}
        className={cn(
          "relative flex shrink-0 overflow-hidden rounded-full items-center justify-center bg-slate-100 text-slate-700 font-medium",
          size === "sm" && "h-7 w-7 text-xs",
          size === "md" && "h-9 w-9 text-sm",
          size === "lg" && "h-12 w-12 text-base",
          className
        )}
        {...props}
      >
        {src && !error ? (
          <img
            src={src}
            alt={fallback || ""}
            className="h-full w-full object-cover"
            onError={() => setError(true)}
          />
        ) : (
          <span>{initials}</span>
        )}
      </span>
    );
  }
);
Avatar.displayName = "Avatar";

export { Avatar };
