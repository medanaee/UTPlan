"use client";

import { useTheme } from "./theme-provider";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className={`h-8 w-8 p-0 rounded-lg border border-border/80 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors shadow-2xs ${className || ""}`}
      title={resolvedTheme === "dark" ? "تغییر به حالت روشن" : "تغییر به حالت تاریک"}
      aria-label="Toggle theme"
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform rotate-0 scale-100" />
      ) : (
        <Moon className="h-4 w-4 text-slate-700 transition-transform rotate-0 scale-100" />
      )}
    </Button>
  );
}
