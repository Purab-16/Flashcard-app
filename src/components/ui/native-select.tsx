import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// A plain <select> (works with forms and the keyboard everywhere) dressed to match the inputs.
export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <span className={cn("relative inline-flex", className?.includes("w-full") && "w-full")}>
      <select
        className={cn(
          "h-9 w-full appearance-none rounded-lg border border-input bg-card pr-8 pl-3 text-sm text-foreground outline-none transition-colors hover:border-ring/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </span>
  );
}
