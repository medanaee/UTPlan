import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  icon?: React.ReactNode;
}

function Input({ className, type, icon, dir, ...props }: InputProps) {
  if (icon) {
    const isLtr = dir === "ltr" || className?.includes("dir-ltr");

    return (
      <div dir={dir} className="relative flex items-center w-full">
        <span
          className={cn(
            "pointer-events-none absolute flex items-center justify-center text-muted-foreground [&_svg]:h-3.5 [&_svg]:w-3.5",
            isLtr ? "left-2.5" : "right-2.5"
          )}
        >
          {icon}
        </span>
        <input
          type={type}
          dir={dir}
          data-slot="input"
          className={cn(
            "h-7 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-xs dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
            isLtr ? "pl-8 pr-2.5" : "pr-8 pl-2.5",
            className
          )}
          {...props}
        />
      </div>
    )
  }

  return (
    <input
      type={type}
      dir={dir}
      data-slot="input"
      className={cn(
        "h-7 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-xs dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }


