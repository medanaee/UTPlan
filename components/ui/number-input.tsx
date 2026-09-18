"use client";

import * as React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NumberInputProps
  extends Omit<React.ComponentProps<"input">, "type" | "onChange" | "value"> {
  value?: number | string;
  defaultValue?: number | string;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number | string, e?: React.ChangeEvent<HTMLInputElement>) => void;
  onStep?: (value: number) => void;
  sizeVariant?: "default" | "sm" | "lg";
  inputClassName?: string;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      className,
      inputClassName,
      value: controlledValue,
      defaultValue = "",
      min,
      max,
      step = 1,
      onChange,
      onStep,
      disabled,
      sizeVariant = "default",
      ...props
    },
    ref
  ) => {
    const isControlled = controlledValue !== undefined;
    const [internalValue, setInternalValue] = React.useState<string | number>(
      isControlled ? controlledValue : defaultValue
    );

    const currentValue = isControlled ? controlledValue : internalValue;

    const clamp = (val: number): number => {
      let clamped = val;
      if (min !== undefined && clamped < min) clamped = min;
      if (max !== undefined && clamped > max) clamped = max;
      return clamped;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (!isControlled) {
        setInternalValue(raw);
      }
      onChange?.(raw, e);
    };

    const stepChange = (delta: number) => {
      if (disabled) return;
      const num = typeof currentValue === "number" ? currentValue : parseFloat(String(currentValue));
      const base = isNaN(num) ? (min !== undefined ? min : 0) : num;
      const stepStr = String(step);
      const decimalPlaces = stepStr.includes(".") ? stepStr.split(".")[1].length : 0;
      const rawNext = base + delta * step;
      const rounded = decimalPlaces > 0 ? Number(rawNext.toFixed(decimalPlaces)) : Math.round(rawNext);
      const next = clamp(rounded);

      if (!isControlled) {
        setInternalValue(next);
      }
      onChange?.(next);
      onStep?.(next);
    };

    const isMinReached =
      min !== undefined &&
      currentValue !== "" &&
      !isNaN(Number(currentValue)) &&
      Number(currentValue) <= min;

    const isMaxReached =
      max !== undefined &&
      currentValue !== "" &&
      !isNaN(Number(currentValue)) &&
      Number(currentValue) >= max;

    return (
      <div className={cn("relative flex items-center group", className)}>
        <input
          ref={ref}
          type="number"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          value={currentValue}
          onChange={handleInputChange}
          className={cn(
            "w-full rounded-lg border border-input bg-transparent px-3 text-xs transition-colors outline-none",
            "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
            "dark:bg-input/30 dark:disabled:bg-input/80",
            // Remove native browser spinners
            "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            // Padding for the stepper buttons at the end
            "pe-8",
            sizeVariant === "sm"
              ? "h-6 text-xs px-2.5 pe-7"
              : sizeVariant === "lg"
              ? "h-8 text-xs px-3 pe-8"
              : "h-7",
            inputClassName
          )}
          {...props}
        />

        {/* Custom Stepper Controls */}
        <div className="absolute inset-y-0 end-0 flex flex-col border-s border-input/70 w-6 sm:w-7 overflow-hidden rounded-e-lg bg-muted/20">
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || isMaxReached}
            onClick={() => stepChange(1)}
            aria-label="افزایش"
            className={cn(
              "flex flex-1 items-center justify-center text-muted-foreground/80 hover:bg-muted/80 hover:text-foreground active:bg-primary/20 transition-colors",
              "disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
            )}
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || isMinReached}
            onClick={() => stepChange(-1)}
            aria-label="کاهش"
            className={cn(
              "flex flex-1 items-center justify-center border-t border-input/60 text-muted-foreground/80 hover:bg-muted/80 hover:text-foreground active:bg-primary/20 transition-colors",
              "disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
            )}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }
);

NumberInput.displayName = "NumberInput";

export { NumberInput };
