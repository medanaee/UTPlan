"use client";

import * as React from "react";
import { Clock, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value?: string; // "HH:mm" e.g. "10:30"
  onChange?: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "default";
}

const QUICK_PRESETS = [
  "07:30",
  "08:00",
  "09:30",
  "10:30",
  "12:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "18:00",
  "19:30",
];

export function TimePicker({
  value = "10:30",
  onChange,
  placeholder = "انتخاب ساعت",
  className,
  disabled = false,
  size = "default",
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);

  const [selectedHour, selectedMinute] = React.useMemo(() => {
    if (!value || !value.includes(":")) return ["10", "30"];
    const [h, m] = value.split(":");
    return [h.padStart(2, "0"), m.padStart(2, "0")];
  }, [value]);

  const [hourInput, setHourInput] = React.useState(selectedHour);
  const [minuteInput, setMinuteInput] = React.useState(selectedMinute);

  const hourInputRef = React.useRef<HTMLInputElement | null>(null);
  const minuteInputRef = React.useRef<HTMLInputElement | null>(null);

  // Sync inputs with value
  React.useEffect(() => {
    setHourInput(selectedHour);
    setMinuteInput(selectedMinute);
  }, [selectedHour, selectedMinute]);

  const handleHourChange = (newH: string) => {
    const clean = newH.replace(/\D/g, "").slice(0, 2);
    setHourInput(clean);

    if (clean.length === 2) {
      let num = parseInt(clean, 10);
      if (isNaN(num)) num = 10;
      num = Math.max(0, Math.min(23, num));
      const formatted = String(num).padStart(2, "0");
      setHourInput(formatted);
      onChange?.(`${formatted}:${selectedMinute}`);
      // Auto jump to minute input
      minuteInputRef.current?.focus();
      minuteInputRef.current?.select();
    } else if (clean.length === 1 && parseInt(clean, 10) >= 3) {
      // Single digit 3-9 can only be 03-09 in 24h format -> auto jump
      const formatted = `0${clean}`;
      setHourInput(formatted);
      onChange?.(`${formatted}:${selectedMinute}`);
      minuteInputRef.current?.focus();
      minuteInputRef.current?.select();
    }
  };

  const handleHourBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (!val) {
      setHourInput(selectedHour);
      return;
    }
    let num = parseInt(val, 10);
    if (isNaN(num)) num = parseInt(selectedHour, 10) || 10;
    num = Math.max(0, Math.min(23, num));
    const formatted = String(num).padStart(2, "0");
    setHourInput(formatted);
    onChange?.(`${formatted}:${selectedMinute}`);
  };

  const handleMinuteChange = (newM: string) => {
    const clean = newM.replace(/\D/g, "").slice(0, 2);
    setMinuteInput(clean);

    if (clean.length === 2) {
      let num = parseInt(clean, 10);
      if (isNaN(num)) num = 0;
      num = Math.max(0, Math.min(59, num));
      const formatted = String(num).padStart(2, "0");
      setMinuteInput(formatted);
      onChange?.(`${selectedHour}:${formatted}`);
    } else if (clean.length === 1 && parseInt(clean, 10) >= 6) {
      // Single digit 6-9 -> auto format to 06-09
      const formatted = `0${clean}`;
      setMinuteInput(formatted);
      onChange?.(`${selectedHour}:${formatted}`);
    }
  };

  const handleMinuteBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (!val) {
      setMinuteInput(selectedMinute);
      return;
    }
    let num = parseInt(val, 10);
    if (isNaN(num)) num = parseInt(selectedMinute, 10) || 0;
    num = Math.max(0, Math.min(59, num));
    const formatted = String(num).padStart(2, "0");
    setMinuteInput(formatted);
    onChange?.(`${selectedHour}:${formatted}`);
  };

  const handleStepHour = (step: number) => {
    const currentH = parseInt(selectedHour, 10);
    let newH = currentH + step;
    if (newH < 0) newH = 23;
    if (newH > 23) newH = 0;
    const formatted = String(newH).padStart(2, "0");
    setHourInput(formatted);
    onChange?.(`${formatted}:${selectedMinute}`);
  };

  const handleStepMinute = (stepMinutes: number) => {
    const currentM = parseInt(selectedMinute, 10);
    let newM = currentM + stepMinutes;
    if (newM < 0) newM = 55;
    if (newM > 55) newM = 0;
    const formatted = String(newM).padStart(2, "0");
    setMinuteInput(formatted);
    onChange?.(`${selectedHour}:${formatted}`);
  };

  const handlePresetSelect = (preset: string) => {
    onChange?.(preset);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "justify-between font-mono font-normal transition-all text-xs border-input/80 hover:border-primary/40 shadow-2xs",
            size === "sm" ? "h-6 px-2.5" : "h-7 px-3",
            !value && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-primary/70 shrink-0" />
            <span className="font-bold tracking-wider">{value || placeholder}</span>
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-72 p-3 bg-popover text-popover-foreground shadow-xl border rounded-2xl z-[100]"
      >
        {/* Stepper + Editable Direct Inputs */}
        <div className="space-y-1">
          <div
            className="flex items-center justify-center gap-4 py-2"
            dir="ltr"
          >
            {/* Hour Input + Stepper */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => handleStepHour(1)}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="افزایش ساعت"
              >
                <ChevronUp className="h-4 w-4" />
              </button>

              <input
                ref={hourInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                value={hourInput}
                onChange={(e) => handleHourChange(e.target.value)}
                onBlur={handleHourBlur}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    handleStepHour(1);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    handleStepHour(-1);
                  } else if (e.key === "Tab" || e.key === ":") {
                    e.preventDefault();
                    minuteInputRef.current?.focus();
                    minuteInputRef.current?.select();
                  } else if (e.key === "Enter") {
                    e.currentTarget.blur();
                    setOpen(false);
                  }
                }}
                className="w-11 text-center text-base font-bold font-mono text-primary bg-background/80 focus:bg-background border border-border/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg py-0.5 outline-none transition-all shadow-2xs"
                title="برای تایپ کلیک کنید یا با کلیدهای بالا/پایین تغییر دهید"
              />

              <button
                type="button"
                onClick={() => handleStepHour(-1)}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="کاهش ساعت"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            <span className="text-xl font-bold font-mono text-muted-foreground -mt-1 select-none">
              :
            </span>

            {/* Minute Input + Stepper */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => handleStepMinute(5)}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="افزایش دقیقه"
              >
                <ChevronUp className="h-4 w-4" />
              </button>

              <input
                ref={minuteInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                value={minuteInput}
                onChange={(e) => handleMinuteChange(e.target.value)}
                onBlur={handleMinuteBlur}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    handleStepMinute(5);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    handleStepMinute(-5);
                  } else if (e.key === "Backspace" && minuteInput.length === 0) {
                    e.preventDefault();
                    hourInputRef.current?.focus();
                    hourInputRef.current?.select();
                  } else if (e.key === "Enter") {
                    e.currentTarget.blur();
                    setOpen(false);
                  }
                }}
                className="w-11 text-center text-base font-bold font-mono text-primary bg-background/80 focus:bg-background border border-border/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg py-0.5 outline-none transition-all shadow-2xs"
                title="برای تایپ کلیک کنید یا با کلیدهای بالا/پایین تغییر دهید"
              />

              <button
                type="button"
                onClick={() => handleStepMinute(-5)}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="کاهش دقیقه"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        {/* Quick University Presets */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-muted-foreground block">
            ساعات متداول کلاسی دانشگاه:
          </span>
          <div className="grid grid-cols-5 gap-1">
            {QUICK_PRESETS.map((p) => {
              const isSelected = value === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePresetSelect(p)}
                  className={cn(
                    "text-[11px] font-mono py-1 rounded-md border transition-all select-none text-center",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary font-bold shadow-2xs"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60"
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        

      </PopoverContent>
    </Popover>
  );
}
